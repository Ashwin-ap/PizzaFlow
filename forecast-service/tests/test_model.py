"""DB-free unit tests for the forecast model (run with `pytest`).

These guard the load-bearing logic — IST bucketing, zero-fill, lag features, the
leak-free temporal split, RMSE, and the clamped forward forecast — without Supabase, so
they run in CI without any secrets.
"""

import numpy as np
import pandas as pd

from model import (
    FEATURE_COLS,
    OPERATING_HOURS,
    add_features,
    build_hourly_grid,
    forecast_next_7_days,
    rmse,
    temporal_split,
)


class ConstModel:
    def __init__(self, value):
        self.value = value

    def predict(self, x):
        return np.full(len(x), self.value)


class Lag7Model:
    """Echoes the lag_7d feature — lets us assert lag sourcing."""

    def predict(self, x):
        return x["lag_7d"].to_numpy()


def test_build_hourly_grid_ist_bucketing_and_zero_fill():
    # 08:30Z → 14:00 IST (hour 14); 06:00Z → 11:30 IST (hour 11); 18:00Z → 23:30 IST (dropped).
    placed_at = [
        "2026-07-03T06:00:00Z",
        "2026-07-04T08:30:00Z",
        "2026-07-04T18:00:00Z",  # outside operating hours → ignored
    ]
    grid = build_hourly_grid(placed_at)

    # Two dates × 12 operating hours, fully dense.
    assert len(grid) == 2 * len(OPERATING_HOURS)
    assert sorted(grid["hour_of_day"].unique()) == OPERATING_HOURS

    def count_at(date, hour):
        row = grid[(grid["date"] == pd.Timestamp(date)) & (grid["hour_of_day"] == hour)]
        return int(row["count"].iloc[0])

    assert count_at("2026-07-03", 11) == 1
    assert count_at("2026-07-04", 14) == 1
    assert count_at("2026-07-04", 23 - 1) == 0  # a quiet hour is zero-filled
    assert grid["count"].sum() == 2  # the 23:30 order was excluded


def test_build_hourly_grid_empty():
    assert build_hourly_grid([]).empty


def test_add_features_lags_and_weekend():
    grid = pd.DataFrame(
        {
            "date": pd.to_datetime(["2026-07-01", "2026-07-02"]),  # Wed, Thu
            "hour_of_day": [19, 19],
            "count": [5, 8],
        }
    )
    out = add_features(grid).set_index("date")

    assert int(out.loc["2026-07-02", "lag_1d"]) == 5  # yesterday same hour
    assert int(out.loc["2026-07-01", "lag_1d"]) == 0  # no prior day → 0
    assert int(out.loc["2026-07-02", "lag_7d"]) == 0  # no week prior → 0
    assert int(out.loc["2026-07-02", "day_of_week"]) == 3  # Thursday
    assert int(out.loc["2026-07-02", "is_weekend"]) == 0


def test_add_features_marks_weekend():
    grid = pd.DataFrame(
        {"date": pd.to_datetime(["2026-07-04"]), "hour_of_day": [20], "count": [9]}  # Sat
    )
    out = add_features(grid)
    assert int(out["is_weekend"].iloc[0]) == 1
    assert int(out["day_of_week"].iloc[0]) == 5


def test_temporal_split_no_leakage():
    dates = pd.to_datetime([f"2026-07-{d:02d}" for d in range(1, 6)])  # 5 dates
    grid = pd.DataFrame(
        {"date": np.repeat(dates, 2), "hour_of_day": [11, 12] * 5, "count": range(10)}
    )
    train, test = temporal_split(grid, test_frac=0.2)

    assert set(train["date"]).isdisjoint(set(test["date"]))
    assert train["date"].max() < test["date"].min()
    assert test["date"].nunique() == 1  # ceil(5 * 0.2)


def test_rmse():
    assert rmse([1, 2, 3], [1, 2, 3]) == 0.0
    assert rmse([0, 0], [2, 0]) == np.sqrt(2)


def test_forecast_shape_and_clamping():
    start = pd.Timestamp("2026-07-08")
    history = pd.DataFrame(
        {"date": pd.to_datetime(["2026-07-01"]), "hour_of_day": [19], "count": [9]}
    )

    rows = forecast_next_7_days(ConstModel(3.0), history, start)
    assert len(rows) == 7 * len(OPERATING_HOURS)
    assert {r["hour_of_day"] for r in rows} == set(OPERATING_HOURS)
    assert all(r["predicted_orders"] == 3.0 for r in rows)
    # 7 distinct target dates starting at `start`.
    assert rows[0]["target_date"] == "2026-07-08"
    assert len({r["target_date"] for r in rows}) == 7

    # Negative model output is clamped to 0.
    neg = forecast_next_7_days(ConstModel(-5.0), history, start)
    assert all(r["predicted_orders"] == 0.0 for r in neg)


def test_forecast_lag7_sourced_from_actuals():
    start = pd.Timestamp("2026-07-08")  # day 0's prev-week is 2026-07-01
    history = pd.DataFrame(
        {"date": pd.to_datetime(["2026-07-01"]), "hour_of_day": [19], "count": [9]}
    )
    rows = forecast_next_7_days(Lag7Model(), history, start)
    day0_h19 = next(r for r in rows if r["target_date"] == "2026-07-08" and r["hour_of_day"] == 19)
    assert day0_h19["predicted_orders"] == 9.0


def test_feature_cols_stable():
    assert FEATURE_COLS == ["hour_of_day", "day_of_week", "is_weekend", "lag_1d", "lag_7d"]

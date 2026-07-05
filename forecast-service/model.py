"""Demand-forecasting model (PizzaFlow / SliceMatic Stage 3, Feature C — PRD §13).

Pure, DB-free pipeline so the load-bearing logic (IST bucketing, zero-fill, leak-free
temporal split, RMSE) is unit-testable without Supabase:

  build_hourly_grid  → count orders per (IST date, operating hour), zero-filling gaps
  add_features       → hour_of_day, day_of_week, is_weekend, lag_1d, lag_7d
  temporal_split     → last ~20% of DATES as test (never random → no leakage)
  train_and_eval     → RandomForestRegressor + LinearRegression baseline, RMSE for both
  forecast_next_7_days → next 7 IST days × operating hours, clamped >= 0

The RandomForest predictions are what get stored (model_version "rf-v1"); LinearRegression
is a reported baseline only.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

IST_OFFSET_MIN = 5 * 60 + 30  # +05:30, no DST — mirrors web/lib/metrics.ts
OPERATING_HOURS = list(range(11, 23))  # 11..22 IST (23:00 is close)
FEATURE_COLS = ["hour_of_day", "day_of_week", "is_weekend", "lag_1d", "lag_7d"]
MODEL_VERSION = "rf-v1"


def build_hourly_grid(placed_at: list[str]) -> pd.DataFrame:
    """Orders per (IST date, hour) over operating hours, dense (zero-filled).

    Returns columns: date (naive datetime64, midnight), hour_of_day (int), count (int).
    Orders outside operating hours are dropped (the model only covers 11–22).
    """
    cols = ["date", "hour_of_day", "count"]
    if not placed_at:
        return pd.DataFrame(columns=cols)

    # format="ISO8601" handles a mix of fractional (UI orders via now()) and
    # whole-second (seeded) timestamps — without it, pandas infers one format from
    # the first row and rejects the rest.
    utc = pd.to_datetime(pd.Series(placed_at), utc=True, format="ISO8601")
    ist = (utc + pd.Timedelta(minutes=IST_OFFSET_MIN)).dt.tz_localize(None)
    df = pd.DataFrame({"date": ist.dt.normalize(), "hour_of_day": ist.dt.hour})
    df = df[df["hour_of_day"].isin(OPERATING_HOURS)]

    counts = (
        df.groupby(["date", "hour_of_day"]).size().reset_index(name="count")
        if not df.empty
        else pd.DataFrame(columns=cols)
    )

    if counts.empty:
        return pd.DataFrame(columns=cols)

    all_dates = pd.date_range(counts["date"].min(), counts["date"].max(), freq="D")
    grid = pd.MultiIndex.from_product(
        [all_dates, OPERATING_HOURS], names=["date", "hour_of_day"]
    ).to_frame(index=False)
    grid = grid.merge(counts, on=["date", "hour_of_day"], how="left")
    grid["count"] = grid["count"].fillna(0).astype(int)
    return grid.sort_values(["date", "hour_of_day"]).reset_index(drop=True)


def add_features(grid: pd.DataFrame) -> pd.DataFrame:
    """Attach calendar + lag features. Missing lags (first day / first week) → 0."""
    if grid.empty:
        return grid.assign(**{c: pd.Series(dtype="int64") for c in FEATURE_COLS})

    out = grid.copy()
    out["day_of_week"] = out["date"].dt.dayofweek  # Mon=0..Sun=6
    out["is_weekend"] = (out["day_of_week"] >= 5).astype(int)

    for name, days in (("lag_1d", 1), ("lag_7d", 7)):
        prev = out[["date", "hour_of_day", "count"]].copy()
        prev["date"] = prev["date"] + pd.Timedelta(days=days)
        prev = prev.rename(columns={"count": name})
        out = out.merge(prev, on=["date", "hour_of_day"], how="left")
        out[name] = out[name].fillna(0).astype(int)

    return out


def temporal_split(
    df: pd.DataFrame, test_frac: float = 0.2
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split on whole DATES — the last ~test_frac of dates become the test set.

    Never splits on rows, so a test row's lags reference only strictly-earlier dates
    (no leakage). With <2 distinct dates the split is degenerate and returns (df, df).
    """
    dates = sorted(df["date"].unique())
    if len(dates) < 2:
        return df, df
    n_test = max(1, int(np.ceil(len(dates) * test_frac)))
    test_dates = set(dates[-n_test:])
    train = df[~df["date"].isin(test_dates)]
    test = df[df["date"].isin(test_dates)]
    assert train["date"].max() < test["date"].min(), "temporal split leaked"
    return train, test


def rmse(y_true, y_pred) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def train_and_eval(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Fit RF + Linear baseline; return the fitted RF and both test RMSEs (orders/hour)."""
    x_train, y_train = train[FEATURE_COLS], train["count"]
    rf = RandomForestRegressor(n_estimators=200, random_state=42)
    rf.fit(x_train, y_train)
    lin = LinearRegression()
    lin.fit(x_train, y_train)

    x_test, y_test = test[FEATURE_COLS], test["count"]
    return {
        "rf": rf,
        "lin": lin,
        "rf_rmse": rmse(y_test, rf.predict(x_test)),
        "lin_rmse": rmse(y_test, lin.predict(x_test)),
    }


def forecast_next_7_days(
    model, history_grid: pd.DataFrame, start_date: pd.Timestamp
) -> list[dict]:
    """Predict the next 7 IST days × operating hours.

    lag_7d uses the ACTUAL count 7 days prior (always known for the first horizon week).
    lag_1d is recursive: day 1 uses the last actual, later days use the prior prediction.
    Predictions are clamped to max(0, round(., 2)) so they fit numeric(6,2) and never go
    negative (LinearRegression could; RF cannot).
    """
    actual = {
        (row.date, int(row.hour_of_day)): float(row.count)
        for row in history_grid.itertuples(index=False)
    }
    predicted: dict[tuple[pd.Timestamp, int], float] = {}
    start = pd.Timestamp(start_date).normalize()
    rows: list[dict] = []

    for day in range(7):
        target = start + pd.Timedelta(days=day)
        dow = int(target.dayofweek)
        is_weekend = int(dow >= 5)
        prev_day = target - pd.Timedelta(days=1)
        prev_week = target - pd.Timedelta(days=7)

        for hour in OPERATING_HOURS:
            lag_1d = predicted.get((prev_day, hour), actual.get((prev_day, hour), 0.0))
            lag_7d = actual.get((prev_week, hour), 0.0)
            features = pd.DataFrame(
                [[hour, dow, is_weekend, lag_1d, lag_7d]], columns=FEATURE_COLS
            )
            pred = max(0.0, round(float(model.predict(features)[0]), 2))
            predicted[(target, hour)] = pred
            rows.append(
                {
                    "target_date": target.strftime("%Y-%m-%d"),
                    "hour_of_day": hour,
                    "predicted_orders": pred,
                }
            )

    return rows


def train_and_forecast(placed_at: list[str], start_date: pd.Timestamp) -> dict:
    """End-to-end: build features, split, train, forecast. Used by app.py /train."""
    grid = add_features(build_hourly_grid(placed_at))
    if grid.empty:
        raise ValueError("no operating-hour orders to train on")
    train, test = temporal_split(grid)
    evaluation = train_and_eval(train, test)
    predictions = forecast_next_7_days(evaluation["rf"], grid, start_date)
    return {
        "predictions": predictions,
        "rf_rmse": evaluation["rf_rmse"],
        "lin_rmse": evaluation["lin_rmse"],
    }

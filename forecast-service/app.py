"""FastAPI forecast service (PRD §13.2).

  POST /train    — retrain + write next-7-day forecasts (token-guarded)
  GET  /forecast — latest forecast run (optional convenience read)
  GET  /health   — liveness

No Python at request time for the app: the Next.js dashboard reads demand_forecasts
directly. This service is triggered by /api/cron/forecast (Vercel Cron, daily) or run
locally against the seeded synthetic history.
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException

from db import client, fetch_placed_at, write_forecasts
from model import MODEL_VERSION, train_and_forecast

load_dotenv()

app = FastAPI(title="SliceMatic forecast service")


def _require_token(token: str) -> None:
    expected = os.environ.get("FORECAST_SERVICE_TOKEN", "")
    # Constant-time compare; also reject when the server has no token configured.
    if not expected or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/train")
def train(x_forecast_token: str = Header(default="")) -> dict:
    _require_token(x_forecast_token)

    sb = client()
    placed_at = fetch_placed_at(sb)
    if not placed_at:
        raise HTTPException(status_code=422, detail="no orders to train on")

    # Forecast horizon starts tomorrow, in IST calendar days.
    start = pd.Timestamp(datetime.now(ZoneInfo("Asia/Kolkata")).date()) + pd.Timedelta(days=1)
    result = train_and_forecast(placed_at, start)

    # ONE generated_at for the whole run so "latest run" selection returns a full batch.
    generated_at = datetime.now(timezone.utc).isoformat()
    rmse = round(result["rf_rmse"], 3)
    rows = [
        {**p, "generated_at": generated_at, "model_version": MODEL_VERSION, "rmse": rmse}
        for p in result["predictions"]
    ]
    write_forecasts(sb, rows)

    return {
        "model": MODEL_VERSION,
        "rfRmse": rmse,
        "linRmse": round(result["lin_rmse"], 3),
        "rowsWritten": len(rows),
        "generatedAt": generated_at,
    }


@app.get("/forecast")
def forecast() -> dict:
    sb = client()
    latest = (
        sb.table("demand_forecasts")
        .select("generated_at")
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not latest:
        return {"generatedAt": None, "points": []}
    generated_at = latest[0]["generated_at"]
    data = (
        sb.table("demand_forecasts")
        .select("target_date, hour_of_day, predicted_orders, model_version, rmse")
        .eq("generated_at", generated_at)
        .order("target_date")
        .order("hour_of_day")
        .execute()
        .data
    )
    return {"generatedAt": generated_at, "points": data}

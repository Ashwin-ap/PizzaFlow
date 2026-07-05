"""Run one training + 7-day forecast locally and write it to demand_forecasts.

A CLI convenience that mirrors app.py's POST /train without starting the FastAPI
server or needing the token. Use after seeding orders so the dashboard forecast
reflects the fresh history:

    cd forecast-service
    .venv/Scripts/python.exe train_local.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pandas as pd
from dotenv import load_dotenv

from db import client, fetch_placed_at, write_forecasts
from model import MODEL_VERSION, train_and_forecast

load_dotenv()

sb = client()
placed_at = fetch_placed_at(sb)
print(f"orders fetched: {len(placed_at)}")
if not placed_at:
    raise SystemExit("no orders to train on — seed orders first")

start = pd.Timestamp(datetime.now(ZoneInfo("Asia/Kolkata")).date()) + pd.Timedelta(days=1)
result = train_and_forecast(placed_at, start)

generated_at = datetime.now(timezone.utc).isoformat()
rmse = round(result["rf_rmse"], 3)
rows = [
    {**p, "generated_at": generated_at, "model_version": MODEL_VERSION, "rmse": rmse}
    for p in result["predictions"]
]
write_forecasts(sb, rows)
print(
    f"wrote {len(rows)} forecast rows | rf_rmse={rmse} "
    f"lin_rmse={round(result['lin_rmse'], 3)} | generated_at={generated_at}"
)

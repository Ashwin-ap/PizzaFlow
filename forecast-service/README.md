# SliceMatic forecast service (Feature C)

Python + scikit-learn demand-forecasting service (PRD §13). Trains on `orders.placed_at`
from Supabase and writes next-7-day hourly predictions into `demand_forecasts`. The Next.js
app only **reads** that table — no Python at request time.

- `model.py` — pure pipeline: IST hourly grid + zero-fill → calendar/lag features →
  leak-free temporal split → RandomForest (+ LinearRegression baseline) → next-7-day forecast.
- `db.py` — Supabase service-role access (paginates past PostgREST's 1000-row cap).
- `app.py` — FastAPI: `POST /train` (token-guarded), `GET /forecast`, `GET /health`.

## Run locally

```bash
cd forecast-service
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # fill SUPABASE_URL, SUPABASE_SERVICE_KEY, FORECAST_SERVICE_TOKEN
uvicorn app:app --port 8000
```

Seed synthetic history first (`npm run seed:menu && npm run seed:orders` in `web/`), then:

```bash
curl -X POST localhost:8000/train -H "x-forecast-token: <FORECAST_SERVICE_TOKEN>"
# → { model: "rf-v1", rfRmse, linRmse, rowsWritten: 84, generatedAt }
```

## Test

```bash
pytest        # DB-free unit tests for the model pipeline
```

## Deploy (Phase 8)

Deploy to Render/Railway free tier, set the three env vars, hit `/train` once to populate
`demand_forecasts`, and wire Vercel Cron → `POST /api/cron/forecast` (daily). Note free-tier
cold starts — warm it before a demo.

"""Supabase access for the forecast service (service-role, bypasses RLS).

Uses supabase-py so it reuses the same secret key the Next app uses. The one gotcha is
PostgREST's default 1000-row read cap — fetch_placed_at paginates so the model trains on
ALL orders (synthetic + real), not just the first 1000.
"""

from __future__ import annotations

import os

from supabase import Client, create_client


def client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def fetch_placed_at(sb: Client) -> list[str]:
    """Every order's placed_at (ISO UTC), paginated past the 1000-row PostgREST cap."""
    out: list[str] = []
    page, size = 0, 1000
    while True:
        resp = (
            sb.table("orders")
            .select("placed_at")
            .order("placed_at")
            .range(page * size, page * size + size - 1)
            .execute()
        )
        rows = resp.data or []
        out.extend(r["placed_at"] for r in rows)
        if len(rows) < size:
            break
        page += 1
    return out


def write_forecasts(sb: Client, rows: list[dict]) -> None:
    """Insert a forecast run. All rows share one generated_at (set by the caller)."""
    if rows:
        sb.table("demand_forecasts").insert(rows).execute()

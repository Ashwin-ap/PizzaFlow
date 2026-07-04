# Demo & Q&A prep (PRD §21)

Graders will ask **each member** to (1) explain a random function, (2) walk a table schema and
justify it, and (3) modify a live feature. Be ready for all three.

## 1. The live-modify demo — "change the discount threshold from 5 to 3"

Because pricing is **server-authoritative and single-sourced**, this is a **one-line, one-place** edit.

1. Open `web/lib/pricing.ts`, change `export const DISCOUNT_THRESHOLD = 5;` → `= 3;`.
2. Save. Local dev hot-reloads; on Vercel, redeploy (or edit + push → auto-deploy).
3. Place a **3-pizza** order → the 10% discount now applies (it didn't before). The client preview
   and the server bill both change, to the paise, because both import the same `computeBill`.

_Talking point:_ no other file changes — the browser never computes prices, so there's nothing else
to keep in sync. This is the payoff of the server-authoritative design (PRD §9).

## 2. Explain-a-function cheat sheet

| Function | File | One-liner |
|---|---|---|
| `computeBill` | `web/lib/pricing.ts` | Unit = base+pizza+topping → subtotal → 10% off at qty ≥ 5 → 18% GST on the discounted total. Integer paise; rounds only at the discount + GST steps. |
| Zod validators | `web/lib/validation.ts` | `nameSchema` / `phoneSchema` / `qtySchema` / `paymentSchema` / `orderBodySchema` — same schemas on client and server; `.strip()` drops any injected price fields. |
| `is_admin()` | `supabase/migrations/0002_rls.sql` | `SECURITY DEFINER` SQL fn checking `admin_users.user_id = auth.uid()`; used by RLS policies and `requireAdmin`. |
| `/api/orders` pricing | `web/app/api/orders/route.ts` | Resolves codes → DB rows, rebuilds `Selected[]` from **DB prices**, calls `computeBill`, writes atomically via the `create_order` RPC; replay → 409. |
| OpenRouter wrapper | `web/lib/openrouter.ts` | Server-side chat call: 4 s timeout, defensive JSON extraction, 429/timeout rotation to the fallback `:free` model. |
| Forecast feature-builder + RMSE | `forecast-service/model.py` | IST hourly grid + zero-fill → `hour/day_of_week/is_weekend/lag_1d/lag_7d` → leak-free temporal split → RF + Linear baseline → RMSE (orders/hr). |

## 3. Justify-a-schema cheat sheet

- **Snapshot columns vs FK on `order_line_items`.** Each line stores both the `menu_items` FK **and**
  a name/price snapshot, so a historical order shows what the customer actually paid even after a
  menu swap or price change (FK is `ON DELETE SET NULL`, snapshots preserve truth).
- **Money as integer paise, never floats.** Avoids floating-point rounding drift; the pricer rounds
  deterministically only at the discount and GST steps.
- **One `menu_items` table + a `category` enum** (base/pizza/topping) instead of three tables —
  swap-resilient and simple; the grader can replace the `.txt` files and re-seed.
- **RLS on everything.** Anon reads only available menu items; orders/metrics/forecast are admin-only
  via `is_admin()`; writes go through the service-role key server-side. Defense in depth: even the
  admin reads run through the user-scoped client so RLS is enforced, not just app logic.

## 4. Loom (3–5 min) sequence

Ordering flow (including a recommendation) → admin login → filters / revenue / top pizza / busiest
hour → CSV download → the forecast chart + top-3 peak hours.

## 5. Suggested team speaking split

FE / ordering · DB / schema + RLS · Feature A (recommendation) · Feature C (forecast + dashboard).
Every member should still be able to speak to the whole system at a high level.

## Pre-demo checklist (PRD §18)

- [ ] Warm the Vercel app and (if deployed) the Render forecast service — avoid cold starts.
- [ ] `/api/health` and `/api/ready` return 200.
- [ ] Place one live test order → it appears in the dashboard.
- [ ] Forecast chart renders; CSV downloads.
- [ ] `npm audit` clean; CI green on `main`.
- [ ] Re-verify both OpenRouter `:free` slugs are still live (roster rotates weekly).

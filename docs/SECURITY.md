# Security checklist audit (PRD §17)

Every item below is checked against the actual code, with evidence. Status ✅ = implemented and
verified; ⚠️ = accepted risk with rationale.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Service-role + OpenRouter keys are server-only (no `NEXT_PUBLIC_`) | ✅ | `web/lib/env.schema.ts` — `SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY` are non-public; used only in `web/lib/supabase/server.ts` and `web/app/api/recommend/route.ts`. |
| 2 | Browser uses the anon key; RLS enforces public-read-menu / admin-read-orders | ✅ | `web/app/api/menu/route.ts` (`createAnonClient`); policies in `supabase/migrations/0002_rls.sql` (`menu_public_read`, orders admin-only). |
| 3 | RLS enabled on ALL tables; `is_admin()` gates admin reads; verified with a non-admin | ✅ | `supabase/migrations/0002_rls.sql` (RLS on all 5 tables + `rate_limits`); `web/lib/admin-auth.ts` (`rpc("is_admin")`); non-admin → 403 in `web/tests/admin.integration.test.ts`. |
| 4 | Order creation is server-authoritative — client prices ignored, recomputed from DB | ✅ | `web/app/api/orders/route.ts` (rebuilds `Selected[]` from DB rows, calls `computeBill`); `web/lib/validation.ts` `.strip()` drops injected `price*`; single pricer `web/lib/pricing.ts`. |
| 5 | Every route re-validates input with the shared Zod schemas | ✅ | orders (`orderBodySchema`), recommend (`phoneSchema`), admin (`adminOrdersQuery`/`adminMetricsQuery`/`adminExportQuery` in `web/lib/admin-query.ts`). |
| 6 | Rate limits on `POST /api/orders` + `/api/recommend` via a DURABLE store; health/ready exempt | ✅ | `web/lib/ratelimit.ts` → Supabase `check_rate_limit` RPC (`supabase/migrations/0004_ratelimit.sql`); both routes call `rateLimit(..., 10, 60)`; `/api/health` + `/api/ready` have no limiter. Fails open on limiter error. |
| 7 | Request body capped (~10 kB) — oversized → `VALIDATION_ERROR` | ✅ | `web/lib/http.ts` (`readJsonWithCap`, `MAX_BODY_BYTES`); orders + recommend map `too_large` → 400. |
| 8 | Admin auth delegated to Supabase Auth (never hand-rolled) | ✅ | `web/lib/admin-auth.ts` + `web/lib/supabase/server-ssr.ts` (cookie SSR via `@supabase/ssr`); no password/JWT handling in app code. |
| 9 | Admin routes require a valid Supabase session AND `is_admin()` | ✅ | `requireAdmin()` in `web/lib/admin-auth.ts`; every `/api/admin/*` route guards `if (gate instanceof NextResponse) return gate`. |
| 10 | CSV export escapes formula-injection (prefix `= + - @` tab/CR with `'`) | ✅ | `web/lib/csv.ts` guard; `web/lib/csv.test.ts` covers each leading char + the CR-in-quotes case. |
| 11 | OpenRouter output is schema-validated AND menu-validated before use | ✅ | `web/lib/openrouter.ts` (`extractJsonObject`, defensive parse); `web/lib/recommend.ts` (`validateModelPick` rejects off-menu codes → deterministic fallback). |
| 12 | Cron endpoint guarded by `CRON_SECRET`; forecast service guarded by a shared token | ✅ | `web/app/api/cron/forecast/route.ts` (constant-time SHA-256 compare, `Authorization: Bearer` + `x-cron-secret`); `forecast-service/app.py` `_require_token` (`hmac.compare_digest`). |
| 13 | Env validated with Zod at boot; process exits on misconfig | ✅ | `web/lib/env.ts` (`loadEnv` → `process.exit(1)`, throws under VITEST); schema `web/lib/env.schema.ts`. |
| 14 | Next.js pinned to a PATCHED 16.2.x; `npm audit` clean; no secrets in client bundle | ✅ / ⚠️ | `web/package.json` → `next@16.2.10`. `npm audit --audit-level=high` exits 0. ⚠️ 2 **moderate** `postcss` advisories remain **below** the high gate (fix = breaking `next` downgrade) — accepted; see below. |
| 15 | `.gitignore` verified — `.env` never committed; only `.env.example`; `.cursorignore` mirrors it | ✅ | Root `.gitignore` + `.cursorignore` ignore `Supabase_OpenRouter_Credentials.txt`, `web/.env.local`, `forecast-service/.env` (all `git check-ignore`-confirmed); `git grep` of tracked files finds no real secret (only `*_xxx` placeholders + Postgres `service_role` grants). |
| 16 | Structured server-side logging — no secrets, tokens, PII, or full payloads | ✅ | Routes log messages only (e.g. `web/app/api/recommend/route.ts` logs `model=… latency=…ms`, never the phone or key); errors log `e`/`.message` server-side, never tokens or order bodies. |
| 17 | CI runs on every PR: `npm ci → tsc --noEmit → lint → (test) → (build) → npm audit --audit-level=high` | ✅ | `.github/workflows/ci.yml` `web` job (adds `npm test` + `next build` beyond the PRD minimum); `forecast` job runs `pytest`. |
| 18 | Error responses carry no stack traces; generic message on 500 | ✅ | `web/lib/response.ts` `err()` returns `{ code, message }` only; routes return generic `err("INTERNAL", "Failed to …")` and log the exception server-side. |

## Accepted risk — postcss moderate advisories

`npm audit` reports **2 moderate** `postcss < 8.5.10` advisories (GHSA-qx2v-qp2m-jg93, XSS via an
unescaped `</style>`), pulled transitively through `next`. They are **below** the `--audit-level=high`
CI gate, so CI passes. The only offered fix (`npm audit fix --force`) downgrades `next` to `9.3.3` — a
massive breaking change — so it is **deliberately not applied**. postcss runs at build time on our own
CSS (no untrusted input), so the practical risk is negligible. Re-evaluate when `next` ships a patched
transitive `postcss`.

## Notes for the deploy

- Set all server-only env vars in the Vercel dashboard (never `NEXT_PUBLIC_` for secrets).
- `CRON_SECRET`, `FORECAST_SERVICE_TOKEN` must match between the web app and the forecast service.
- The synthetic forecast-seed orders (phone prefix `9990`) are excluded from admin metrics and the
  recommendation popularity counts, so customer-facing numbers reflect only real orders.

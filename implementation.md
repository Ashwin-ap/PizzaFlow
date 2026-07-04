# PizzaFlow — SliceMatic Stage 3 · Implementation Plan

> **Companion to `PizzaFlow_Stage3_PRD.md`.** The PRD is the *specification* (what & why); this file is the *build order* (how & when). Read **both** at the start of every session.
>
> **Goal:** ship the full Stage 3 system and earn the complete **50 pts + 10 bonus** (see the Rubric Map at the bottom).
>
> **Stack is locked** (PRD §4): Next.js 16 App Router · Supabase (Postgres + Auth) · OpenRouter (`:free` model) · Python/scikit-learn forecast service · Vercel. Test tooling (Vitest, Playwright, pytest) is **dev-only** and does not change the runtime stack. Verify every dependency version live per the PRD's **Version Safety Rule** before writing any manifest.

---

## How to use this document (the session protocol)

Each phase is **one session**. In a session:

1. **Read** `implementation.md` (this file) + `PizzaFlow_Stage3_PRD.md`.
2. **Pick** the first phase whose status is ⬜ in the Progress Tracker (do them in order — later phases depend on earlier ones).
3. **Implement** only that phase. Follow its *Steps*, build against the referenced PRD sections.
4. **Verify** — make every item in that phase's *Definition of Done* pass, including its automated tests (`npm test` / `pytest`) and the live-deploy smoke check.
5. **Commit & push** a focused commit (the phase's suggested message), then **redeploy** (deploy-early model — every phase after Phase 1 ships to the live URL).
6. **Update the tracker** — set the phase to ✅ and paste the commit short-hash. Add a one-line "notes / gotchas" for the next session if anything is non-obvious.
7. **Exit** the session.

**Rule:** never start a phase before its prerequisites (prior phases) are ✅. If a phase feels too big for one context window, stop at a clean sub-boundary, commit, and mark it 🔄 with a note on where to resume.

---

## Progress Tracker

| # | Phase | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Prerequisites (accounts, keys, local tooling) | ⬜ | — | one-time setup, not a code session |
| 1 | Foundation & first deploy | ⬜ | — | |
| 2 | Database — schema, RLS, seed | ⬜ | — | |
| 3 | Core domain libs + `/api/menu` + `/api/orders` | ⬜ | — | |
| 4 | Customer ordering UI (stepper + design system) | ⬜ | — | |
| 5 | AI Feature A — Recommendation engine | ⬜ | — | |
| 6 | Admin auth + dashboard (metrics, filters, CSV) | ⬜ | — | |
| 7 | AI Feature C — Demand forecasting (★ bonus) | ⬜ | — | |
| 8 | Harden, document & demo-ready | ⬜ | — | |

Legend: ⬜ todo · 🔄 in progress · ✅ done

---

## Global conventions (apply in every phase)

- **Version Safety** (PRD top): before editing `package.json` / `requirements.txt`, `npm show <pkg> version` + a CVE search; Node = current Active LTS; Next.js = patched **16.2.x**; OpenRouter slug must carry the `:free` suffix. State what you verified in the commit message.
- **Repo layout** follows PRD §5 (`web/`, `forecast-service/`, `supabase/`, `docs/`, root `README.md` / `.gitignore` / `.cursorignore`, `.github/workflows/ci.yml`). The three `Types_of_*.txt` menu files are the **seed source** for `seed_menu.py`. The Stage-2 `Submit.py` / `orders_log.txt` are reference artifacts — leave them or move to an `archive/` folder; they are not part of the Stage-3 build.
- **Secrets:** only `NEXT_PUBLIC_*` reach the browser; the service-role and OpenRouter keys are server-only. Never commit `.env` (PRD §6, §17). Validate all env with Zod at boot and `process.exit(1)` on failure.
- **One envelope, one pricer:** every route returns the PRD §11.1 envelope via `lib/response.ts`; **all** money math lives only in `lib/pricing.ts` (PRD §9). Server prices are authoritative — the client never sends prices.
- **Test stack:** `web/` → **Vitest** (unit) + **@testing-library/react** (components) + **Playwright** (e2e). `forecast-service/` → **pytest**. Every phase adds the tests listed in its *Definition of Done*; CI (`ci.yml`) runs `npm ci → tsc --noEmit → lint → test → npm audit --audit-level=high` and must stay green. (This exceeds the PRD §19 "no test suite" minimum — deliberately, for correctness and Q&A talking points.)
- **Commit rhythm:** one focused commit per phase (or per clean sub-step), pushed to `origin/main`, then redeploy.

---

## Phase 0 — Prerequisites (one-time setup)

**Goal:** every account, key, and local tool ready so no later phase is blocked. Not a coding session — a checklist.

- [ ] **Accounts:** GitHub (✅ `Ashwin-ap/PizzaFlow` exists), **Supabase** (free), **OpenRouter** (free — no card), **Vercel** (Hobby), **Render** or Railway (free) for the forecast service.
- [ ] **OpenRouter:** create an API key; on `openrouter.ai/models` (filter Price → Free) confirm `meta-llama/llama-4-scout:free` + `meta-llama/llama-3.3-70b-instruct:free` are live $0 endpoints (PRD §12.2 — re-verify before submit).
- [ ] **Local tooling:** Node.js Active LTS (20+, verify), npm, Python 3.11+ (verify), Git, and optionally the Supabase CLI.
- [ ] **Supabase project:** create it now (empty); copy the **project URL**, **anon key**, **service-role key** for Phase 1's env.
- [ ] Have the three `Types_of_*.txt` menu files on hand (they are the seed source).

**Definition of Done:** all keys captured in a local scratch note (never committed); Supabase project exists; `node -v` / `python --version` confirm supported versions.

---

## Phase 1 — Foundation & first deploy

**Goal:** a live, deployed Next.js skeleton with the design system, env validation, health probes, and CI — so every later phase is verifiable on the public URL.

**PRD refs:** §4 (stack), §5 (repo layout), §6 (env), §10.3 (NFRs), §11.1/§11.5 (envelope, health), §16 (frontend + full design system §16.2), §17/§18 (CI, security).

**Steps:**
1. Scaffold `web/` — Next.js 16 (App Router, **TypeScript strict**, no `any`), Tailwind **v4**.
2. Wire the **design system** from PRD §16.2: put all colour/shadow/typography tokens in a Tailwind v4 `@theme{}` block; dark surfaces overridden under `.dark`; `next/font` for Inter + JetBrains Mono; `lucide-react` for icons; the no-flash inline script in `app/layout.tsx` (`<head>`, `suppressHydrationWarning` on `<html>`); a `ThemeToggle` component.
3. `lib/env.ts` — Zod-validated env (§6), crash on bad config.
4. `lib/response.ts` — success/error/paginated envelope helpers + the §11.2 error codes.
5. `app/api/health/route.ts` (200, no DB) and `app/api/ready/route.ts` (light Supabase check → 503 if down).
6. Repo hygiene: root `.gitignore` + `.cursorignore` (§5), `.github/workflows/ci.yml` (§18 CI gate).
7. A minimal landing `app/page.tsx` (branded shell, design tokens visible) — real flow comes in Phase 4.
8. **Deploy:** import `web/` to Vercel, set env vars, get the **public URL**.

**Definition of Done:**
- [ ] Live Vercel URL renders the branded shell in **light + dark** (no flash), responsive desktop + mobile.
- [ ] `/api/health` → 200; `/api/ready` → 200 when Supabase reachable.
- [ ] CI is green; `npm audit` clean; Next.js on patched 16.2.x.
- [ ] **Tests:** unit for `lib/env.ts` (rejects bad config) and `lib/response.ts` (envelope shapes); a smoke render test for the layout.
- [ ] Commit: `feat: foundation — next16+tailwind design system, env, health, CI, first deploy (verified next@16.2.x, npm audit clean)`

---

## Phase 2 — Database: schema, RLS, seed

**Goal:** the 5-table Supabase schema live, RLS enforced, menu seeded swap-safely, one admin user provisioned.

**PRD refs:** §7 (full schema, RLS, `is_admin()`, seeding), §14 (admin seed), §17 (RLS checklist).

**Steps:**
1. `supabase/migrations/0001_schema.sql` — verbatim from §7.2 (5 tables, enums, indexes, integer paise, snapshot columns).
2. `0002_rls.sql` — `is_admin()` + RLS policies from §7.3.
3. `0003_views.sql` — optional metric RPC/views (§14 reference queries) — either now or in Phase 6; note the choice.
4. `supabase/seed/seed_menu.py` — defensive parse of the three `Types_of_*.txt` (§7.4 rules: strip, split on `;`, skip malformed/non-positive, tolerate BOM), rupees→paise ×100, upsert on `(category, code)`.
5. `supabase/seed/seed_orders.py` — leave the generator here but only *run* it in Phase 7 (it needs no app). Stub it now or build it fully — note which.
6. Apply migrations + `seed_menu.py` to the Supabase project. Create the **grader admin auth user** and insert its `admin_users` row.

**Definition of Done:**
- [ ] All 5 tables exist with constraints; RLS **enabled on every table**.
- [ ] Anon key can read available `menu_items`; anon **cannot** read `orders` (verify with a non-admin query).
- [ ] `seed_menu.py` is idempotent and swap-safe (re-run against altered files re-seeds cleanly).
- [ ] **Tests:** an integration test asserting RLS (anon reads menu OK, anon reads orders DENIED) and seed idempotency (re-run → same row count).
- [ ] Commit: `feat: supabase schema + RLS + is_admin + swap-safe menu seed`

---

## Phase 3 — Core domain libs + `/api/menu` + `/api/orders`

**Goal:** the server-authoritative heart — pricing engine, validators, Supabase clients, and the two core public routes.

**PRD refs:** §8 (FR-7, FR-8, FR-10, FR-12), §9 (pricing engine, verbatim), §10.1/§10.2 (validation + 8 edge cases), §11 (contract, codes, rate limits, body cap, idempotency), §23 (worked bill traces).

**Steps:**
1. `lib/pricing.ts` — verbatim §9 (`MIN/MAX_QTY`, `DISCOUNT_THRESHOLD=5`, `DISCOUNT_RATE=0.10`, `GST_RATE=0.18`, `computeBill`, `rupees`). This is the single source of truth and the live-demo edit point.
2. `lib/validation.ts` — Zod schemas for name/phone/qty/choice/payment (§10.1), reused client + server.
3. `lib/supabase/{browser,server,admin}.ts` — anon / service-role / auth-scoped clients (§16, §3 key separation).
4. `lib/ratelimit.ts` — per-IP durable limiter (Supabase counter or edge KV; §11.5 numbers).
5. `app/api/menu/route.ts` — GET live menu grouped bases/pizzas/toppings (§11.3).
6. `app/api/orders/route.ts` — POST: re-validate (Zod), look up each `code` in `menu_items`, build `Selected[]` from **DB prices**, `computeBill`, insert `orders` + `order_line_items` **atomically** with snapshots; rate-limit + body cap + idempotency guard; envelope + error codes.

**Definition of Done:**
- [ ] `GET /api/menu` returns the seeded menu with `pricePaise`.
- [ ] `POST /api/orders` prices server-side, **ignores client-sent prices**, persists order + line items atomically; returns `{ order, bill }`.
- [ ] Rejects: bad name/phone/qty/payment → `VALIDATION_ERROR`; unknown code → `MENU_ITEM_NOT_FOUND`; replay → `CONFLICT`; flood → `RATE_LIMITED`.
- [ ] **Tests (critical):** `computeBill` unit tests hitting the §23 traces exactly — 5× Cheese Burst/BBQ/Extra-Cheese → **₹3594.87** (359487 paise), single Thin/Margherita/Olives → **₹586.46**, and the qty=4 vs qty=5 discount boundary; validator unit tests covering all §10.1 rules and the 8 edge cases (§10.2); integration tests for `/api/orders` (happy, validation, menu-not-found, tampered-price ignored, idempotency).
- [ ] Commit: `feat: pricing engine + validators + server-authoritative /api/menu & /api/orders`

---

## Phase 4 — Customer ordering UI (stepper + design system)

**Goal:** the complete customer flow on the live URL — intake → quantity → menu builder → bill → payment → confirm — wired to the Phase 3 APIs, styled with the design system.

**PRD refs:** §8 (FR-1…FR-12), §10.2 (8 edge cases in UI), §10.3 (a11y, no white-screen), §15.1 (flow diagram), §16 (architecture + design system), §9 (client preview bill uses the same constants).

**Steps:**
1. `Stepper` state machine for the 6 steps; leave a slot for the recommendation card (filled Phase 5).
2. Components: `MenuList`, `PizzaBuilderRow` (reveal exactly *qty* rows), `BillTable` (itemised, `tnum` numbers, ₹ right-aligned — a real table, not a textbox), payment selector, confirmation summary, `ThemeToggle`.
3. Forms via **React Hook Form + the shared Zod schemas**; inline errors with `aria-live`; stay-on-step on error.
4. Fetch menu (cached) from `/api/menu`; submit to `/api/orders`; explicit **loading + error** states; root `ErrorBoundary`; menu-load failure disables ordering (FR-9) without crashing.
5. Apply `.btn` (primary invert-on-hover + scale), `.input` focus rings, card recipes, `canvas-soft` bill panel, full light/dark, responsive (desktop + mobile).

**Definition of Done:**
- [ ] Full order placeable end-to-end on the live URL; confirmation echoes the saved order; "New order" resets.
- [ ] All 8 edge cases (§10.2) handled in-UI with the exact PRD error messages; no unhandled exception / white-screen.
- [ ] Client preview bill equals the server bill to the paise.
- [ ] Dark mode + responsive verified; a11y (labels, focus, contrast AA, `aria-live`).
- [ ] **Tests:** component tests for each validated field (accept/reject); **Playwright e2e** — happy-path order + at least edge cases #1/#3/#5; a dark-mode toggle + no-flash check.
- [ ] Commit: `feat: customer ordering stepper wired to server pricing, full design system`

---

## Phase 5 — AI Feature A — Recommendation engine

**Goal:** a personalised pizza+topping suggestion after intake that never blocks ordering. (12 rubric pts.)

**PRD refs:** §8 (FR-4), §12 (flow, model choice, guardrails), §11 (`/api/recommend`, rate limit), §23.3 (system prompt, output schema).

**Steps:**
1. `lib/openrouter.ts` — OpenAI-compatible chat wrapper: server-side key, 4 s timeout, **defensive JSON parse** (don't trust strict `json_schema`), 429/failure rotation to the fallback `:free` model, logs model actually used + latency.
2. `app/api/recommend/route.ts` — take `{ phone }`, query recent history (join `order_line_items`), build compact summary, call OpenRouter with the §23.3 system prompt + live menu + history, **menu-validate** returned codes, else deterministic **popular/house-favourite** fallback (from `order_line_items` counts). Never block ordering.
3. `RecommendCard` in the stepper (after intake, before quantity): pizza + topping + one-line reason + "Use this" prefill.

**Definition of Done:**
- [ ] Returning phone → tailored pick; new phone → popular fallback framed as such (cold start).
- [ ] Model error/timeout/invalid-code → deterministic fallback; **ordering never blocks**.
- [ ] Recommendation call is server-side only; per-IP rate limited; model+latency logged for the demo.
- [ ] **Tests:** unit for the defensive JSON parser, menu-validation, and fallback selector (mock OpenRouter); integration for `/api/recommend` — valid, model-returns-bad-code, timeout→fallback, empty-history cold-start.
- [ ] Commit: `feat: AI recommendation engine (Feature A) with deterministic fallback`

---

## Phase 6 — Admin auth + dashboard

**Goal:** authenticated owner dashboard — orders list with filters, revenue, top pizza, busiest hour, CSV export. (8 rubric pts, + DB integration pts.)

**PRD refs:** §7.3 (`is_admin()`), §8 (FR-13…FR-18), §11 (admin routes, pagination), §14 (widgets + reference SQL), §15.2 (admin flow), §17 (CSV injection guard, admin auth Supabase-managed).

**Steps:**
1. `app/admin/login/page.tsx` — Supabase Auth (email/password); `app/admin/page.tsx` protected; server checks `is_admin()` → non-admins 403.
2. Routes: `/api/admin/orders` (date + payment filters, `page`/`limit` pagination), `/api/admin/metrics` (revenue = Σ`total_paise`, top pizza, busiest hour in **IST**), `/api/admin/export` (CSV, RFC-4180, **formula-injection guard** in `lib/csv.ts`).
3. Dashboard UI: `OrdersTable`, `MetricCards` (count-up, `tnum`), filter `.chip` row, `ExportButton` — all on the design system.

**Definition of Done:**
- [ ] Admin login works; non-admin gets 403; missing session gets 401.
- [ ] Filters, revenue, top pizza, busiest-hour (IST) all correct and respect filters.
- [ ] CSV downloads; cells starting with `= + - @` (and tab/CR) are prefixed with `'`.
- [ ] **Tests:** unit for the CSV injection guard + metric computations; integration for admin routes (401 no session, 403 non-admin, 200 admin, pagination); Playwright e2e — login → filter → export.
- [ ] Commit: `feat: admin auth + dashboard (orders, revenue, top pizza, busiest hour, CSV export)`

---

## Phase 7 — AI Feature C — Demand forecasting (★ bonus)

**Goal:** the 7-day hourly forecast pipeline + dashboard chart with top-3 peak hours and RMSE. (+10 bonus pts.)

**PRD refs:** §8 (FR-19/FR-20), §7.4 (`seed_orders.py`), §13 (pipeline, model, eval, serving, cold start), §11 (`/api/cron/forecast`, `/api/admin/forecast`), §18 (Render deploy).

**Steps:**
1. `supabase/seed/seed_orders.py` — generate ~60–90 days synthetic history matching the §7.4 curve (weekday/weekend volumes, lunch + dinner peaks), **clearly labelled** (recognisable phone prefix) so it's excludable. Run it to give the model signal.
2. `forecast-service/model.py` — aggregate orders per `(date, hour)` within 11:00–23:00 IST; features `hour_of_day`, `day_of_week`, `is_weekend`, lag (prev day / prev week); **RandomForestRegressor** + **LinearRegression baseline**; temporal train/test split (last ~20% dates — never random); report **RMSE** for both; predict next 7 days × hours → upsert `demand_forecasts`.
3. `forecast-service/app.py` — FastAPI `POST /train` (token-guarded) + `GET /forecast`; `requirements.txt` (verify versions).
4. `app/api/cron/forecast/route.ts` — `CRON_SECRET`-guarded trigger; Vercel Cron daily. `app/api/admin/forecast/route.ts` — latest forecast for the dashboard.
5. `ForecastChart` (Recharts) + **top-3 predicted peak hours** on the admin dashboard; document model + RMSE.
6. **Deploy** the service to Render; hit `/train` once; warm it before demos (cold-start note §13.2).

**Definition of Done:**
- [ ] `/train` populates `demand_forecasts`; dashboard renders the chart + top-3 peaks; RMSE shown; cron wired.
- [ ] No Python at request time — Next.js only reads `demand_forecasts`.
- [ ] **Tests:** pytest for the feature builder, the temporal split (no leakage), and RMSE calc; integration for `/api/cron/forecast` auth (bad secret → 401) and `/api/admin/forecast`.
- [ ] Commit: `feat: demand forecasting service + dashboard (Feature C, bonus)`

---

## Phase 8 — Harden, document & demo-ready

**Goal:** pass the full security checklist, complete the README, and make the submission checklist all-green.

**PRD refs:** §17 (security checklist), §18 (deploy runbook + demo checklist), §21 (demo & Q&A prep), §22 (README + submission checklist), §2 (rubric traceability).

**Steps:**
1. Walk **every** §17 checklist item: keys server-only, RLS verified with a real non-admin user, server-authoritative pricing, Zod re-validation, rate limits, CSV guard, LLM output menu-validated, cron secret, env crash-on-misconfig, patched Next 16.2.x, `npm audit` clean, no `.env` in git, no stack traces.
2. **README.md** (§22): architecture diagram (reuse §3), setup (env/migrations/seed/run/deploy), **AI A + C descriptions with UX value**, **full Feature A system prompt** (§23.3) + model rationale (§12.2), Feature C model/features/RMSE, per-endpoint API docs (§11.4), public Vercel URL, read-only Supabase access, forecast-service URL.
3. Share **read-only** Supabase access with the grader; provision the grader admin account.
4. Configure Vercel Cron; warm Render + Vercel; run the §18 demo-day checklist (health probes, live test order → appears in dashboard, forecast renders, CSV downloads).
5. Prep §21 Q&A: rehearse `computeBill`, the validators, `is_admin()`, `/api/orders` pricing, the OpenRouter wrapper, the forecast feature-builder + RMSE; rehearse the live **"change `DISCOUNT_THRESHOLD` 5→3"** edit.
6. Loom (3–5 min): ordering (with a recommendation) → admin login → filters/revenue/top pizza/busiest hour → CSV → forecast chart.

**Definition of Done:**
- [ ] Full test suite green in CI; `npm audit` clean.
- [ ] End-to-end smoke on the live URL: ordering + both AI features + admin all work.
- [ ] §22 submission checklist fully ticked; §2 rubric map (below) all covered.
- [ ] Commit: `chore: security pass, README + system prompts, demo-ready`

---

## Rubric Map (how the phases earn 50 + 10)

| Rubric component (PRD §2) | Pts | Delivered by |
|---|---|---|
| Vercel frontend — live, responsive, full flow, no crashes | 10 | Phases 1, 4 (+ every redeploy) |
| Supabase DB — 3+ tables, orders saved, menu from DB, dashboard | 12 | Phases 2, 3, 6 |
| Auth + admin dashboard — login, filters, revenue, CSV | 8 | Phase 6 |
| AI feature — OpenRouter, system prompt in README, real UX value | 12 | Phases 5, 8 |
| Live demo + Q&A — runs live, explains each part | 8 | Phase 8 (Q&A prep + tests throughout) |
| ★ Bonus — second AI feature, documented | +10 | Phases 7, 8 |
| **Total** | **60** | Phases 1–8 |

---

*PizzaFlow · SliceMatic Stage 3 · Implementation Plan · build order for `PizzaFlow_Stage3_PRD.md`*

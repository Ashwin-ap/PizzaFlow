# PizzaFlow — SliceMatic Stage 3 · Implementation Plan

> **Companion to `PizzaFlow_Stage3_PRD.md`.** The PRD is the *specification* (what & why); this file is the *build order* (how & when). Read **both** at the start of every session.
>
> **Goal:** ship the full Stage 3 system and earn the complete **50 pts + 10 bonus** (see the Rubric Map at the bottom).
>
> **Stack is locked** (PRD §4): Next.js 16 App Router · Supabase (Postgres + Auth) · OpenRouter (`:free` model) · Python/scikit-learn forecast service · Vercel. Test tooling (Vitest, Playwright, pytest) is **dev-only** and does not change the runtime stack. Verify every dependency version live per the PRD's **Version Safety Rule** before writing any manifest.
>
> **Deployment model — local-first (project decision):** every phase is built and verified on **`localhost`** (`npm run dev` + the phase's tests). We do **not** deploy to Vercel during development. A single **manual** Vercel deploy is done by the developer from the GitHub repo at the very end (Phase 8). This changes only *where you verify* (local, not a live URL) — it does **not** relax any testing, validation, or Definition-of-Done item.
>
> **Credentials/env flow:** the raw keys live in a git-ignored scratch file **`Supabase_OpenRouter_Credentials.txt`** (repo root). In Phase 1 they are transcribed into **`web/.env.local`** (also git-ignored — this is the real `.env` for local dev). At the final manual deploy they are pasted into the **Vercel dashboard** env vars. The `.txt` and every `.env*` file are **never committed**.

---

## How to use this document (the session protocol)

Each phase is **one session**. In a session:

1. **Read** `implementation.md` (this file) + `PizzaFlow_Stage3_PRD.md`.
2. **Pick** the first phase whose status is ⬜ in the Progress Tracker (do them in order — later phases depend on earlier ones).
3. **Implement** only that phase. Follow its *Steps*, build against the referenced PRD sections.
4. **Verify** — make every item in that phase's *Definition of Done* pass, including its automated tests (`npm test` / `pytest`) and a **local** smoke check (`localhost:3000`).
5. **Commit & push** a focused commit (the phase's suggested message) to `origin/main`. **No Vercel redeploy** — per the local-first model, the live deploy happens once, manually, in Phase 8.
6. **Update the tracker** — set the phase to ✅ and paste the commit short-hash. Add a one-line "notes / gotchas" for the next session if anything is non-obvious.
7. **Exit** the session.

**Rule:** never start a phase before its prerequisites (prior phases) are ✅. If a phase feels too big for one context window, stop at a clean sub-boundary, commit, and mark it 🔄 with a note on where to resume.

---

## Progress Tracker

| # | Phase | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Prerequisites (accounts, keys, local tooling) | ✅ | — | Supabase `SliceMatic_Grp8` live; CLI logged in; secrets git-ignored; new sb_ keys |
| 1 | Foundation & first deploy | ✅ | cb69f8b | local-first (no deploy); next@16.2.10, tailwind@4.3.2; env names use PUBLISHABLE/SECRET; tests 10✓ |
| 2 | Database — schema, RLS, seed | ✅ | 3963dde | 5 tables + RLS live via `supabase db push`; **TS seed** (`web/scripts/`, not Python) reuses supabase-js; 23 items seeded, swap-safe; admin `admin@slicematic.dev` provisioned; `0003_views` deferred→P6; `seed_orders` stubbed→P7; RLS test local-only (`npm run test:rls`) |
| 3 | Core domain libs + `/api/menu` + `/api/orders` | ✅ | 44287e0 | server-authoritative pricing (`lib/pricing.ts`, integer paise); **atomic `create_order` RPC**; idempotency via `Idempotency-Key` header + unique col; durable Supabase rate limiter; **RPCs revoked from anon** (verified 42501); admin client → P6; route+RLS tests opt-in (`npm run test:integration` / `test:rls`) |
| 4 | Customer ordering UI (stepper + design system) | ✅ | 387c057 | 7-step client `Stepper` (`components/order/`) wired to `/api/menu` + `/api/orders`; client preview reuses `lib/pricing.ts` (== server to the paise, §23 verified); **selection builder** (dropdowns) → edge #4/#5 server-guarded not in-UI; **native React + Zod** (no RHF); **Playwright deferred → P8** (Vitest+RTL now, 20 new tests); root `app/error.tsx` (Next 16 `unstable_retry`); FR-9 menu-fail blocks+retry; live smoke: page 200, menu API 23 items, SSR renders stepper |
| 5 | AI Feature A — Recommendation engine | ✅ | ae8cd20 | `POST /api/recommend` (server-only) + `lib/openrouter.ts` (4s timeout, 429→fallback-model rotation, defensive `extractJsonObject`) + pure `lib/recommend.ts` (verbatim §23.3 prompt, **menu-validation** guardrail, deterministic picker). **Cold start / no key → deterministic, NO LLM**; LLM only for returning phones w/ history. **House default = priciest pizza+topping** (empty counts). `AI_UNAVAILABLE`→**200-with-fallback** (never blocks); rate 10/60. `RecommendCard` "Use this" prefills `selections[0]` (base stays default). **⚠ Version-Safety: PRD's `llama-4-scout:free` DISCONTINUED (404) → primary now `llama-3.2-3b-instruct:free`, fallback `llama-3.3-70b-instruct:free`** (env.schema default + `.env.local` updated). 16 new tests; live smoke: cold-start 200 (P7+T2 priciest), bad phone 400 |
| 6 | Admin auth + dashboard (metrics, filters, CSV) | ⬜ | — | |
| 7 | AI Feature C — Demand forecasting (★ bonus) | ⬜ | — | |
| 8 | Harden, document & demo-ready | ⬜ | — | |

Legend: ⬜ todo · 🔄 in progress · ✅ done

---

## Global conventions (apply in every phase)

- **Version Safety** (PRD top): before editing `package.json` / `requirements.txt`, `npm show <pkg> version` + a CVE search; Node = current Active LTS; Next.js = patched **16.2.x**; OpenRouter slug must carry the `:free` suffix. State what you verified in the commit message.
- **Repo layout** follows PRD §5 (`web/`, `forecast-service/`, `supabase/`, `docs/`, root `README.md` / `.gitignore` / `.cursorignore`, `.github/workflows/ci.yml`). The three `Types_of_*.txt` menu files are the **seed source** for `seed_menu.py`. The Stage-2 `Submit.py` / `orders_log.txt` are reference artifacts — leave them or move to an `archive/` folder; they are not part of the Stage-3 build.
- **Secrets:** only `NEXT_PUBLIC_*` reach the browser; the service-role and OpenRouter keys are server-only. Never commit `.env` (PRD §6, §17). Validate all env with Zod at boot and `process.exit(1)` on failure. The captured keys live in the git-ignored `Supabase_OpenRouter_Credentials.txt`; Phase 1 transcribes them into `web/.env.local` (git-ignored) for local dev, and they go into the Vercel dashboard at the final manual deploy.
- **One envelope, one pricer:** every route returns the PRD §11.1 envelope via `lib/response.ts`; **all** money math lives only in `lib/pricing.ts` (PRD §9). Server prices are authoritative — the client never sends prices.
- **Test stack:** `web/` → **Vitest** (unit) + **@testing-library/react** (components) + **Playwright** (e2e). `forecast-service/` → **pytest**. Every phase adds the tests listed in its *Definition of Done*; CI (`ci.yml`) runs `npm ci → tsc --noEmit → lint → test → npm audit --audit-level=high` and must stay green. (This exceeds the PRD §19 "no test suite" minimum — deliberately, for correctness and Q&A talking points.)
- **Commit rhythm:** one focused commit per phase (or per clean sub-step), pushed to `origin/main`. No per-phase redeploy — the single Vercel deploy is manual and happens in Phase 8.

---

## Phase 0 — Prerequisites (one-time setup)

**Goal:** every account, key, and local tool ready so no later phase is blocked. Not a coding session — a checklist.

- [x] **Accounts:** GitHub (✅ exists), **Supabase** (✅ project `SliceMatic_Grp8` created), **OpenRouter** (✅ key ready), **Vercel** (✅ account exists — used only for the final manual deploy). **Render/Railway** for the forecast service is **deferred** (bonus Phase 7 only).
- [x] **OpenRouter:** create an API key; on `openrouter.ai/models` (filter Price → Free) confirm `meta-llama/llama-4-scout:free` + `meta-llama/llama-3.3-70b-instruct:free` are live $0 endpoints (PRD §12.2 — re-verify before submit). ✓ both confirmed live.
- [x] **Local tooling:** Node.js **24.14.0** (Active LTS ✓), npm 11.9.0, Python **3.13.7**, Git 2.52, and the **Supabase CLI v2.109.0** (via `npx supabase`) — `supabase login` done (projects list OK).
- [x] **Supabase project:** created; **bare project URL**, **publishable key**, **secret key**, and **DB password** captured in the git-ignored `Supabase_OpenRouter_Credentials.txt` (bare URL, not the `/rest/v1/` endpoint). Transcribed into `web/.env.local` in Phase 1. *(Admin email/password still to pick — Phase 2, not a Phase 0 blocker.)*
- [x] Have the three `Types_of_*.txt` menu files on hand (they are the seed source).

**Definition of Done:** ✅ all keys captured in the git-ignored `Supabase_OpenRouter_Credentials.txt` (never committed — transcribed into `web/.env.local` in Phase 1), protected by a root `.gitignore` (`git check-ignore` verified); Supabase project exists (ACTIVE_HEALTHY); Supabase CLI installed + `supabase login` done; `node -v` / `python --version` confirm supported versions.

---

## Phase 1 — Foundation & first deploy

**Goal:** a live, deployed Next.js skeleton with the design system, env validation, health probes, and CI — so every later phase is verifiable on the public URL.

**PRD refs:** §4 (stack), §5 (repo layout), §6 (env), §10.3 (NFRs), §11.1/§11.5 (envelope, health), §16 (frontend + full design system §16.2), §17/§18 (CI, security).

**Steps:**
1. Scaffold `web/` — Next.js 16 (App Router, **TypeScript strict**, no `any`), Tailwind **v4**.
2. Wire the **design system** from PRD §16.2: put all colour/shadow/typography tokens in a Tailwind v4 `@theme{}` block; dark surfaces overridden under `.dark`; `next/font` for Inter + JetBrains Mono; `lucide-react` for icons; the no-flash inline script in `app/layout.tsx` (`<head>`, `suppressHydrationWarning` on `<html>`); a `ThemeToggle` component.
3. `lib/env.ts` — Zod-validated env (§6), crash on bad config. Create **`web/.env.local`** (git-ignored) by transcribing the values from `Supabase_OpenRouter_Credentials.txt` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY`). *(Accurate new key names — deviates from PRD's legacy ANON/SERVICE_ROLE naming.)*
4. `lib/response.ts` — success/error/paginated envelope helpers + the §11.2 error codes.
5. `app/api/health/route.ts` (200, no DB) and `app/api/ready/route.ts` (light Supabase check → 503 if down).
6. Repo hygiene: root `.gitignore` + `.cursorignore` (§5), `.github/workflows/ci.yml` (§18 CI gate).
7. A minimal landing `app/page.tsx` (branded shell, design tokens visible) — real flow comes in Phase 4.
8. **Run & verify locally:** `npm run dev` → confirm the branded shell renders at `localhost:3000`. (No Vercel deploy — that's the single manual step in Phase 8.)

**Definition of Done:**
- [x] **`localhost:3000`** renders the branded shell in **light + dark** (no flash), responsive desktop + mobile. *(Verified via warning-free build + compiled CSS — `.dark` tokens, `@media`, `.btn/.chip` recipes — and served HTML incl. the no-flash script; a final browser eyeball is recommended.)*
- [x] `/api/health` → 200; `/api/ready` → 200 when Supabase reachable. *(curl-verified: both 200, envelope-wrapped.)*
- [x] CI is green; `npm audit` clean; Next.js on patched 16.2.x. *(Next@16.2.10 ✓; **GitHub Actions CI passed on `23950ca` — Success in ~37s**. `npm audit` clean at the `--audit-level=high` gate; 2 moderate postcss advisories remain below it.)*
- [x] **Tests:** `env.schema` (rejects bad config), `response` (envelope shapes), landing smoke render — **10 passing** (Vitest + happy-dom).
- [x] Commit: `cb69f8b` — `feat: foundation — next16 + tailwind v4 design system, env, envelope, health/ready, CI`

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
- [x] All 5 tables exist with constraints; RLS **enabled on every table**. *(0001/0002 pushed; `menu_items, orders, order_line_items, demand_forecasts, admin_users` all live with RLS.)*
- [x] Anon key can read available `menu_items`; anon **cannot** read `orders` (verify with a non-admin query). *(RLS test: anon reads 23 menu items; anon read of `orders` → 0 rows; anon insert → denied.)*
- [x] Seed is idempotent and swap-safe (re-run against altered files re-seeds cleanly). *(Implemented as **TS** `web/scripts/seed-menu.ts` — upsert on `(category, code)`, missing codes deactivated not deleted; re-run → same count.)*
- [x] **Tests:** an integration test asserting RLS (anon reads menu OK, anon reads orders DENIED) and seed idempotency (re-run → same row count). *(`web/tests/rls.integration.test.ts` — 4 tests, opt-in `npm run test:rls`, skipped in CI without creds; parser unit tests 7 run in CI.)*
- [x] Commit: `3963dde` — `feat: supabase schema + RLS + is_admin + swap-safe menu seed`

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
- [x] `GET /api/menu` returns the seeded menu with `pricePaise`. *(anon client + RLS; grouped bases/pizzas/toppings; curl + integration verified.)*
- [x] `POST /api/orders` prices server-side, **ignores client-sent prices**, persists order + line items atomically; returns `{ order, bill }`. *(via `create_order` RPC; tampered prices Zod-stripped + rebuilt from DB; atomicity proven — failing line item → no orphan.)*
- [x] Rejects: bad name/phone/qty/payment → `VALIDATION_ERROR`; unknown code → `MENU_ITEM_NOT_FOUND`; replay → `CONFLICT`; flood → `RATE_LIMITED`. *(all verified live; also oversized body → 400.)*
- [x] **Tests (critical):** `computeBill` unit tests hit the §23 traces exactly (5× → **359487 paise**, single → **58646**, qty4-vs-qty5 boundary); validator units cover §10.1 + the 8 edge cases; route integration tests (happy, validation, menu-not-found, tampered-price ignored, idempotency 409, flood 429, atomic rollback). *(36 unit in CI; 9 route + 4 RLS opt-in local.)*
- [x] Commit: `44287e0` — `feat: pricing engine + validators + server-authoritative /api/menu & /api/orders`

---

## Phase 4 — Customer ordering UI (stepper + design system)

**Goal:** the complete customer flow running locally (`localhost:3000`) — intake → quantity → menu builder → bill → payment → confirm — wired to the Phase 3 APIs, styled with the design system.

**PRD refs:** §8 (FR-1…FR-12), §10.2 (8 edge cases in UI), §10.3 (a11y, no white-screen), §15.1 (flow diagram), §16 (architecture + design system), §9 (client preview bill uses the same constants).

**Steps:**
1. `Stepper` state machine for the 6 steps; leave a slot for the recommendation card (filled Phase 5).
2. Components: `MenuList`, `PizzaBuilderRow` (reveal exactly *qty* rows), `BillTable` (itemised, `tnum` numbers, ₹ right-aligned — a real table, not a textbox), payment selector, confirmation summary, `ThemeToggle`.
3. Forms via **React Hook Form + the shared Zod schemas**; inline errors with `aria-live`; stay-on-step on error.
4. Fetch menu (cached) from `/api/menu`; submit to `/api/orders`; explicit **loading + error** states; root `ErrorBoundary`; menu-load failure disables ordering (FR-9) without crashing.
5. Apply `.btn` (primary invert-on-hover + scale), `.input` focus rings, card recipes, `canvas-soft` bill panel, full light/dark, responsive (desktop + mobile).

> **Phase-4 deviations (locked with the user, override the docs):** (a) **selection-based builder** (dropdowns) instead of FR-8's typed item-number → edge cases **#4/#5 become structurally impossible in-UI**, so they're guarded server-side (`MENU_ITEM_NOT_FOUND` 422, already tested in `orders.integration.test.ts`) and documented, not shown in-UI; (b) **native React state + shared Zod** (no React Hook Form dependency); (c) **Playwright e2e deferred to Phase 8** — Vitest + Testing Library cover Phase 4 now.

**Definition of Done:**
- [x] Full order placeable end-to-end locally (`localhost:3000`); confirmation echoes the saved order; "New order" resets. *(7-step `Stepper`; Stepper.test walks all 7 steps + reset; live dev smoke: `/`→200, SSR renders stepper, `/api/menu`→23 seeded items.)*
- [x] Edge cases handled without an unhandled exception / white-screen. *(In-UI with exact PRD messages: **#1** all-spaces name, **#2** phone leading-1, **#3** qty 0/11, **#6** empty, **#7** `2.5`/`three` — via IntakeForm/QuantityStep tests. **#4/#5** server-guarded per the deviation above. **#8** menu-parser skips malformed → FR-9. Root `app/error.tsx` catches render errors.)*
- [x] Client preview bill equals the server bill to the paise. *(Client imports the same `computeBill`/`rupees`; BillTable.test asserts the §23 traces ₹3594.87 + ₹586.46.)*
- [x] Dark mode + responsive; a11y (labels, focus, `aria-live`, AA). *(Built on the design-system tokens/recipes; labelled inputs, `role="alert" aria-live="polite"` errors, `aria-current` step indicator, `bg-canvas-soft` bill panel, responsive `md:` grids.)*
- [x] **Tests:** 20 new Vitest + Testing Library specs (IntakeForm, QuantityStep, BillTable §23, PaymentStep, Stepper happy-path + FR-9 + reset). *(Full suite 52 passing / 13 opt-in skipped; `tsc --noEmit` + lint clean; `next build` green.)* Playwright e2e → Phase 8.
- [x] Commit: `387c057` — `feat: customer ordering stepper wired to server pricing, full design system`

---

## Phase 5 — AI Feature A — Recommendation engine

**Goal:** a personalised pizza+topping suggestion after intake that never blocks ordering. (12 rubric pts.)

**PRD refs:** §8 (FR-4), §12 (flow, model choice, guardrails), §11 (`/api/recommend`, rate limit), §23.3 (system prompt, output schema).

**Steps:**
1. `lib/openrouter.ts` — OpenAI-compatible chat wrapper: server-side key, 4 s timeout, **defensive JSON parse** (don't trust strict `json_schema`), 429/failure rotation to the fallback `:free` model, logs model actually used + latency.
2. `app/api/recommend/route.ts` — take `{ phone }`, query recent history (join `order_line_items`), build compact summary, call OpenRouter with the §23.3 system prompt + live menu + history, **menu-validate** returned codes, else deterministic **popular/house-favourite** fallback (from `order_line_items` counts). Never block ordering.
3. `RecommendCard` in the stepper (after intake, before quantity): pizza + topping + one-line reason + "Use this" prefill.

> **Phase-5 decisions (locked with the user):** (a) **cold start / empty history → deterministic pick, NO LLM** — the model is called only for returning phones that have history (resolves the PRD §12.1-vs-§23.3 ambiguity, saves free-tier quota); (b) **house-favourite default = priciest available pizza + priciest topping** (§12.3 upsell) when there's no popularity data; the selector prefers most-ordered from `order_line_items` counts when data exists. **Version-Safety deviation:** the PRD's primary `meta-llama/llama-4-scout:free` was **discontinued** as a free endpoint (404 "unavailable for free"); swapped to `meta-llama/llama-3.2-3b-instruct:free` (primary) + `meta-llama/llama-3.3-70b-instruct:free` (fallback), both verified live-free.

**Definition of Done:**
- [x] Returning phone → tailored pick; new phone → deterministic pick framed as popular (cold start). *(Route branches on history; cold-start live smoke → 200 with a house-favourite pick. Returning-phone path covered by opt-in `test:recommend`.)*
- [x] Model error/timeout/invalid-code → deterministic fallback; **ordering never blocks**. *(`callOpenRouter` throws on primary+fallback failure → route falls to `pickDeterministic`; invalid/off-menu code → `validateModelPick` null → fallback; `AI_UNAVAILABLE` returned as 200-with-fallback; `RecommendCard` always offers a way forward.)*
- [x] Recommendation call is server-side only; per-IP rate limited; model+latency logged. *(`/api/recommend` uses `supabaseService` + server-only `OPENROUTER_API_KEY`; `rateLimit(recommend:ip, 10, 60)`; `console.info([recommend] model=… latency=…ms)`.)*
- [x] **Tests:** defensive JSON parser + model rotation (`openrouter.test.ts`), menu-validation + deterministic selector + history summary (`recommend.test.ts`), Stepper prefill happy-path; opt-in `tests/recommend.integration.test.ts` (cold-start, returning, bad phone). *(16 new; full suite 68 passing / 16 opt-in skipped; `tsc`+lint+`next build` green.)*
- [x] Commit: `ae8cd20` — `feat: AI recommendation engine (Feature A) with deterministic fallback`

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
4. **Manual Vercel deploy (the single, developer-run deploy):** import the GitHub repo to Vercel with **root directory `web/`**, set all env vars from `Supabase_OpenRouter_Credentials.txt`, and get the **public URL**. Then (bonus only) configure Vercel Cron; warm services; run the §18 demo-day checklist (health probes, live test order → appears in dashboard, forecast renders, CSV downloads).
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
| Vercel frontend — live, responsive, full flow, no crashes | 10 | Phases 1, 4 (built + verified locally; live via the final manual deploy in Phase 8) |
| Supabase DB — 3+ tables, orders saved, menu from DB, dashboard | 12 | Phases 2, 3, 6 |
| Auth + admin dashboard — login, filters, revenue, CSV | 8 | Phase 6 |
| AI feature — OpenRouter, system prompt in README, real UX value | 12 | Phases 5, 8 |
| Live demo + Q&A — runs live, explains each part | 8 | Phase 8 (Q&A prep + tests throughout) |
| ★ Bonus — second AI feature, documented | +10 | Phases 7, 8 |
| **Total** | **60** | Phases 1–8 |

---

*PizzaFlow · SliceMatic Stage 3 · Implementation Plan · build order for `PizzaFlow_Stage3_PRD.md`*

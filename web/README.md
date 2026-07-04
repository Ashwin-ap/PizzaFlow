# web/ — SliceMatic Next.js app

This is the Next.js 16 (App Router) frontend + API for SliceMatic. For the full project overview,
architecture, setup, deploy, AI-feature docs, and API reference, see the **[root README](../README.md)**.

## Dev quickstart

```bash
npm install
cp .env.example .env.local     # then fill in the values (see the root README's env table)
npm run dev                    # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next dev / production build / serve |
| `npm run lint` · `npm test` | ESLint · Vitest unit + component suite |
| `npm run seed:menu` · `seed:orders` | Seed `menu_items` from the `.txt` files · synthetic forecast history |
| `npm run provision:admin` | Create the admin auth user (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) |
| `npm run db:push` | Apply Supabase migrations |
| `npm run test:integration \| test:rls \| test:recommend \| test:admin \| test:forecast` | Opt-in live-DB suites (need `.env.local`) |

Security checklist: [`../docs/SECURITY.md`](../docs/SECURITY.md) · Demo/Q&A prep: [`../docs/DEMO.md`](../docs/DEMO.md).

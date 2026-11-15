# T-030 — Stack proposal

## Stack
- Native browser HTML, CSS and JavaScript ES modules.
- Node.js built-in APIs for development server and static build; `npm run build` creates `dist/`. No framework, bundler, UI kit or paid service is needed for the mock-data shell.
- Web App Manifest + service worker caching only the app shell. No student/lesson data is cached and no offline writes are supported.
- `MockJournalRepository` is the T-030 in-memory implementation. `SupabaseJournalRepository` is an explicit stub. T-031 will add `supabase-js` and implement it after the database security dependency is accepted.
- Configuration: `SJ_DATA_SOURCE`, `SJ_SUPABASE_URL`, `SJ_SUPABASE_ANON_KEY`; placeholder names only in `.env.example`. Never commit `.env` or private credentials. T-030 intentionally builds only with `SJ_DATA_SOURCE=mock`.
- Static output is host-neutral; GitHub Pages, Cloudflare Pages or another free static host can be selected in T-006.

## Why
T-030 is a navigable mobile-first UI on fictional data, not production authentication. Native modules keep dependencies at zero, reduce supply-chain risk in the public repository and keep deployment portable. The repository interface isolates UI from future Supabase without adding client-side teacher/role filters; authorization remains the database's responsibility.

## Commands
```sh
cp .env.example .env
npm run dev
npm run check
npm run build
npm run preview
```
Node.js 20 or newer is recommended. Dev and preview servers use Node's built-in HTTP module.

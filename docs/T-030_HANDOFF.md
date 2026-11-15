# T-030 Handoff — PWA skeleton (REWORK)

PROJECT: school_journal

CHANGED:
- Relative asset paths (`./`) for GitHub Pages subpath `/school_journal/`
- CHANGELOG keeps T-020 entry and appends T-030
- Service worker: relative shell, cache name with date, network-first for HTML/JS/CSS
- `data-journal` / `data-lesson` go through `esc()`
- Dev/preview default `HOST=127.0.0.1` (override `HOST=0.0.0.0` for phone)
- CSS: minimum ~12px text, ~44px touch targets
- `npm run check` (not presented as ESLint lint)
- apple-touch-icon → `icon.svg` (PNG 192/512 still recommended)

VERIFIED:
- Static edits on branch `chatgpt/T-030` only.
- Grok did **not** re-run `npm run build` / subpath server in this environment after the last push.
- Owner/Claude should run `npm run check && npm run build` and serve `dist` under `/school_journal/` before ACCEPTED.

DECISIONS:
- No new npm dependencies
- Did not modify `supabase/`

TODO:
- Claude re-review PR #3
- Optional: real PNG 192/512 icons
- T-031 after T-030 ACCEPTED + T-024 demo data on live

FILES: app shell under repo root; see PR #3 diff

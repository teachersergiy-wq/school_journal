# T-030 Handoff — mobile PWA skeleton

PROJECT: school_journal

CHANGED:
- Mobile-first Ukrainian PWA flow: sign-in, journals (subject + class), lesson dates, read-only lesson window.
- In-memory mock repository with fictional 8-А students, two subjects, lesson samples and representative characteristics.
- Supabase repository stub selected through configuration; no Supabase SDK, credentials, network calls or database schema changes.
- Web manifest, app-shell-only service worker, Node-based static build/dev/preview/check scripts.
- README, stack note, .env.example, .gitignore, changelog.

VERIFIED:
- npm run check passed locally: syntax checked for six JS modules; contract-field and PWA-reference checks passed.
- npm run build passed locally; static dist/ generated.
- Manifest parsed as valid JSON.
- Local dev server smoke test returned HTTP 200 for app shell, JS, CSS, manifest, service worker and icon.
- No dependencies or paid services; only fictional student labels.
- No files under supabase/ changed.

DECISIONS:
- T-030 uses native HTML/CSS/ES modules and Node built-ins to keep the mock shell dependency-free and host-neutral.
- Supabase implementation remains a stub until T-031 after security dependencies are accepted.
- Sign-in is explicitly a mock demonstration; no sign-up or password reset.
- Service worker caches only app shell; no student data caching or offline writes.

TODO:
- Claude: review and mark ACCEPTED or REWORK.
- Owner: accept T-030 after review.
- T-031: implement Supabase journals and lesson-date repository after T-023A is applied/accepted as required by the task board.
- T-032: connect lesson window and save RPC after T-031.
- T-006: select free static hosting; then configure Supabase Auth redirect URLs.

FILES:
- index.html, app-config.js, src/main.js, src/data.js, src/styles.css
- manifest.webmanifest, service-worker.js, icon.svg
- package.json, .env.example, .gitignore
- scripts/env.mjs, scripts/build.mjs, scripts/dev-server.mjs, scripts/preview-server.mjs, scripts/check.mjs
- README.md, docs/STACK.md, CHANGELOG.md

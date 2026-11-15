# T-030 Handoff — PWA skeleton and release checks

PROJECT: school_journal

CHANGED:
- Added `npm run check:subpath` and the dependency-free `scripts/check-subpath.mjs`. It builds the app, copies `dist/` under a temporary `school_journal/` directory, starts a Node.js static server, checks response codes and content types for the app shell, JavaScript, styles, manifest, service worker, SVG icon, and PNG icons, and rejects root-relative paths in the HTML and manifest.
- Added `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `apple-touch-icon.png`. The PNGs were generated outside the repository with a one-off Node.js script using only built-in modules (`zlib`, `fs`, and `path`): raster drawing of a navy background, a mint journal card, and teal writing lines; PNG chunks were encoded with built-in zlib. The maskable icon uses a smaller central design with safe margins. The generator was not committed, and no package was added.
- Updated the manifest, HTML icon links, build copy list, and service-worker shell list to include all PNG files with relative paths.
- Added a GitHub Actions workflow for pull requests targeting `main` and pushes to `main`. It uses Node.js 20, grants only `contents: read`, and pins checkout and setup-node to full commit hashes with release comments.
- Preserved all previous changelog entries and appended the T-030 verification entry.

VERIFIED:
- Local runtime: Node.js v24.20.0 and npm 11.19.0. The workflow is configured for Node.js 20.
- `npm run check` exited with code 0. Exact output:
```text
> school-journal-pwa@0.1.0 check
> node scripts/check.mjs

Syntax and contract checks passed (6 JS modules checked).
```
- `npm run build` exited with code 0. Exact output:
```text
> school-journal-pwa@0.1.0 build
> node scripts/build.mjs

Static PWA built in dist/ (mock data only).
```
- `npm run check:subpath` exited with code 0. Exact output:
```text
> school-journal-pwa@0.1.0 check:subpath
> node scripts/check-subpath.mjs

Static PWA built in dist/ (mock data only).
PASS index.html and manifest.webmanifest contain no root-relative paths.
PASS /school_journal/ -> 200 (text/html; charset=utf-8)
PASS /school_journal/src/main.js -> 200 (text/javascript; charset=utf-8)
PASS /school_journal/src/styles.css -> 200 (text/css; charset=utf-8)
PASS /school_journal/manifest.webmanifest -> 200 (application/manifest+json)
PASS /school_journal/service-worker.js -> 200 (text/javascript; charset=utf-8)
PASS /school_journal/icon.svg -> 200 (image/svg+xml)
PASS /school_journal/icon-192.png -> 200 (image/png)
PASS /school_journal/icon-512.png -> 200 (image/png)
PASS /school_journal/icon-maskable-512.png -> 200 (image/png)
PASS /school_journal/apple-touch-icon.png -> 200 (image/png)
GitHub Pages subpath check passed (10 resources).
```
- Icon generator reported `icon-192.png: 192x192, 953 bytes`, `icon-512.png: 512x512, 3434 bytes`, `icon-maskable-512.png: 512x512, 3276 bytes (maskable safe area)`, and `apple-touch-icon.png: 180x180, 821 bytes`.
- Verified release tags and commit hashes through the GitHub API: `actions/checkout v7.0.1` at `3d3c42e5aac5ba805825da76410c181273ba90b1`, and `actions/setup-node v7.1.0` at `949feb2413d6458794dcd2491c4babbbce0c15c1`.


DECISIONS:
- No npm dependencies were added.
- No files in `supabase/` were changed.
- The workflow check is informational until the owner decides whether it is required for merging.

TODO:
- Claude to re-review PR #3.
- Owner to merge PR #3 after review.

FILES:
- `scripts/check-subpath.mjs`
- `.github/workflows/ci.yml`
- PNG icon assets and related PWA files

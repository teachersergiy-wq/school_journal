# Changelog — school_journal

## 2026-11-22 — T-060 journal navigation
- Added the signed-in home stub and class → subject → journal navigation flow for mock and Supabase repositories.
- Added persistent home and level-by-level back controls plus navigation-state tests.
- Exposed class and subject identifiers in journal records so the selected pair resolves the corresponding journal.

## 2026-11-23 — T-062 touch target
- Increased the «Журнал» button touch target to at least 44 pixels and removed the empty `:root{}` rule.

## 2026-11-22 — T-062 lesson-to-journal link
- Added a «Журнал» action to the lesson window that returns to the lesson dates for the same journal and focuses the lesson's date.

## 2026-11-23 — T-063 touch target
- Increased the manual lesson form fields to 44-pixel touch targets.

## 2026-11-22 — T-063 manual lesson creation
- Added a date, lesson number (1–10), and topic form to the journal's lesson dates.
- Added RLS-protected lesson insertion with a Ukrainian duplicate lesson message; mock lessons update immediately and remain date-sorted.

## T-030 — GitHub Pages subpath, PNG icons, and continuous integration
- Added a dependency-free subpath check that builds the app, serves it from a temporary `/school_journal/` directory, verifies response status and media types, and rejects root-relative asset URLs.
- Added standard, maskable, and Apple touch PNG icons generated with Node.js built-in modules; kept the existing SVG icon and all earlier changelog entries.
- Added GitHub Actions checks for pull requests and pushes to `main`, pinned to verified action commit hashes.

## T-030 — PWA skeleton (mock data)
- Added a mobile-first Ukrainian sign-in, journals, lesson dates and read-only lesson-window flow.
- Added fictional 8-А students, two subjects, lesson examples and lesson characteristics from DATA_CONTRACT.
- Added an in-memory repository and explicit Supabase integration stub; no database calls or credentials.
- Added static PWA manifest and app-shell-only service worker (no offline data writes).
- Relative asset paths for GitHub Pages project sites (e.g. `/school_journal/`).
- Added zero-dependency Node build/dev/preview/check scripts and stack documentation.

## 2026-11-01 — T-020 (Grok)
- Added `supabase/` folder with core schema migration.
- Enums: app_role, hw_status, exit_reason, assessment_kind.
- Tables: profiles, classes, students, subjects, journals, lessons, behavior_marks, lesson_records, lesson_record_behavior, lesson_exits, assessments.
- RLS policies for owner / teacher (own journals only).
- Helper functions: current_app_role, is_journal_teacher, is_class_teacher.
- RPC: save_lesson_record (upsert record + behavior + exits).
- Synthetic seed (behavior marks, subjects, one class, 10 fictional students).
- No secrets, no real student data.

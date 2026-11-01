# Changelog — school_journal

## 2026-11-01 — T-020 (Grok)
- Added `supabase/` folder with core schema migration.
- Enums: app_role, hw_status, exit_reason, assessment_kind.
- Tables: profiles, classes, students, subjects, journals, lessons, behavior_marks, lesson_records, lesson_record_behavior, lesson_exits, assessments.
- RLS policies for owner / teacher (own journals only).
- Helper functions: current_app_role, is_journal_teacher, is_class_teacher.
- RPC: save_lesson_record (upsert record + behavior + exits).
- Synthetic seed (behavior marks, subjects, one class, 10 fictional students).
- No secrets, no real student data.

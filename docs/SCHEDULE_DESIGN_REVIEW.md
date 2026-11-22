# Schedule model design review (T-070–T-073, T-078)

PROJECT: school_journal  
Author: Grok (database)  
Date: 2026-11-22  
Status: design only — **no migrations in this document**

---

## 1) Unrealistic or risky on Supabase Free

| Topic | Assessment |
|-------|------------|
| **`btree_gist` + exclusion constraints** | **Available** on Supabase Postgres (extension `btree_gist` is standard). Exclusion on `(teacher_id WITH =, weekday WITH =, slot WITH =, daterange(valid_from, valid_to, '[]') WITH &&)` is the right tool and is Free-compatible. Must `create extension if not exists btree_gist` in a migration; confirm in project that extension create is allowed (it is on typical Free projects). |
| **Generate full-term lessons** | A semester ≈ 16–18 weeks × ≤10 slots × classes can be thousands of rows. Fine for Free **storage**; risk is **one long transaction** and statement timeout if `generate_lessons` is naive. Mitigate: batch by week, or generate per journal, with clear progress notices. |
| **Idempotent regenerate** | Safe only if “already has records / assessments” rows are **skipped**, never deleted. Any “wipe and recreate” path is dangerous once real marks exist. |
| **Computed sequence numbers** | Window functions over lessons per term are OK at journal scale. Avoid materializing sequence if it must stay correct under concurrent cancel/extra — compute in views/RPC. |
| **Theme shift cascades** | Updating many `lessons.topic` / `plan_item_id` in one transaction is OK for one journal; still must never rewrite **held** lessons. |
| **Auth / RLS** | Same Free limits as today. No new paid features required. |
| **Keep-alive** | Schedule generation is intermittent; Free auto-pause still needs `ops.keepalive` (T-006), not related to this model. |

**Verdict:** The model is implementable on Free. Main risks are operational (timeouts on bulk generate, accidental rewrite of held lessons), not missing paid features.

---

## 2) Objections and simplifications

1. **`valid_to` open-ended** — Prefer `valid_to date null = open` and document range as `[valid_from, coalesce(valid_to, 'infinity'))` in exclusion. Avoid sentinel far-future dates in app code.
2. **Single bell schedule per term** — Acceptable for v1. If a school needs “Monday shortened”, use `bell_day_exceptions` only; do not add per-weekday bell tables yet.
3. **`day_overrides` “full day replace”** — Powerful but easy to get wrong. Recommend: override stores a **list of entries for that date** (or points to a frozen snapshot), not a pointer to “use Tuesday’s template”, which breaks on holidays. Clarify product rule before coding.
4. **`lessons.status` vs delete** — Prefer soft statuses (`planned|held|cancelled|replaced`) over hard DELETE so history and plan shifts stay auditable.
5. **`work_type` on lesson and on plan item** — Keep both only if UI needs plan default vs actual. Otherwise only on lesson; plan item can suggest default copied at generate time.
6. **Substitution journal** — “Writes into the class/subject journal under Owner’s name” conflicts with “one teacher per journal” if Owner is not that journal’s `teacher_id`. Prefer: substitution lesson is stored on the **target journal** with `kind=substitution` and `conducted_by = auth.uid()` (new column), without changing `journals.teacher_id`. RLS must allow Owner (or designated substitute) to write that row.
7. **No automatic `in_journal`** — Orthogonal (T-069); schedule must not set grades.

---

## 3) Contradictions / gaps in theme-shift rules

| Scenario | Stated rule | Gap / risk |
|----------|-------------|------------|
| **Replaced** (someone taught instead of me) | Theme moves to next planned lesson; later themes shift later; sequence of following lessons decreases by one | “Sequence decreases” matches removing a counted slot. Ensure **replaced** is excluded from sequence (as proposed). Confirm whether the **replaced** row keeps its old `plan_item_id` for history or is detached. Recommendation: keep topic text snapshot on the replaced row; shift plan assignment only among **planned/held** future rows. |
| **Extra** | Takes next theme; themes shift **earlier** | Opposite direction of replace — good. Define order: extras inserted **on a date** relative to existing sequence. |
| **Substitution** (I teach for someone else) | Own theme, outside plan, no shift | Good. Must not call shift RPCs. |
| **Held** | Shift does not touch | Good. Pin `plan_item_id` + topic on held. |
| **Cancel without replace** | Not specified | Need Owner rule: does cancel shift themes like replace, or leave a hole in sequence only? |
| **Two replaces same week** | Not specified | Shift must be **ordered** (by date, lesson_number) in one function to stay deterministic. |
| **Regenerate after manual edits** | Not specified | `generate_lessons` must not overwrite topics on rows that already diverged from plan (flag or “touched_at”). |

Acceptance example (Algebra grade 9, Wednesday period 3 replaced) is consistent if: next Algebra lesson (by sequence rules) receives that plan theme, and only non-held, non-cancelled, non-replaced rows participate in the shift chain.

---

## 4) Agreed table / constraint sketch (for when implementation starts)

### 4.1 Reference

**`terms`**  
- `id uuid pk`  
- `school_year smallint not null`  
- `name text not null`  
- `starts_on date not null`  
- `ends_on date not null`  
- `check (starts_on <= ends_on)`  
- unique `(school_year, name)`

**`bell_slots`**  
- `id uuid pk`  
- `term_id uuid not null → terms`  
- `slot_number smallint not null check (1–10)`  
- `starts_at time not null`  
- `ends_at time not null`  
- `check (starts_at < ends_at)`  
- unique `(term_id, slot_number)`

**`calendar_days`**  
- `id uuid pk`  
- `day date not null unique`  
- `kind text not null` — e.g. `holiday`, `vacation`, `other`  
- `note text`  
- On these dates **no** lessons from weekly template.

### 4.2 Weekly template

**`schedule_entries`**  
- `id uuid pk`  
- `teacher_id uuid not null → profiles`  
- `journal_id uuid not null → journals`  
- `weekday smallint not null check (1–7)` — document ISO (1=Mon)  
- `slot_number smallint not null check (1–10)`  
- `room text`  
- `valid_from date not null`  
- `valid_to date` null = open  
- `check (valid_to is null or valid_to >= valid_from)`  
- Exclusion (needs `btree_gist`): no overlapping validity for same `(teacher_id, weekday, slot_number)`  
- Optional: exclude overlapping for same `(journal_id, weekday, slot_number)` so one class cannot have two subjects in one slot.

### 4.3 Lessons

**`lessons`** (extend existing)  
- keep `journal_id`, `lesson_date`, `lesson_number`, `topic`  
- `status text/enum not null default 'planned'` — `planned|held|cancelled|replaced`  
- `kind text/enum not null default 'regular'` — `regular|extra|substitution`  
- `work_type text/enum` — `none|independent|control` (or null = none)  
- `plan_item_id uuid null → lesson_plan_items`  
- `conducted_by uuid null → profiles` — for substitution / coverage  
- unique still `(journal_id, lesson_date, lesson_number)` for non-deleted rows  
- Sequence: **not stored**; view/RPC orders by date, lesson_number among rows where `status not in ('cancelled','replaced')` within term dates.

### 4.4 Plan

**`lesson_plan_items`**  
- `id uuid pk`  
- `journal_id uuid not null`  
- `term_id uuid not null`  
- `position int not null`  
- `topic text not null`  
- `work_type` optional  
- unique `(journal_id, term_id, position)`

### 4.5 Exceptions

**`day_overrides`**  
- `id`, `day date unique` (or per school)  
- payload: explicit list of `{slot_number, journal_id, teacher_id, room}` for that date only  
- Restoring default = delete override row

**`bell_day_exceptions`**  
- `day date`  
- slot times for that day only  
- does not mutate `bell_slots`

### 4.6 RPCs (security invoker, `search_path = ''`, REVOKE FROM PUBLIC, GRANT to authenticated)

- `generate_lessons(term_id)` — idempotent; skip calendar_days; do not alter lessons with records/assessments or `status = held`  
- `get_day_schedule(day)`  
- `get_week_schedule(week_start)`  
- `get_journal_sequence(journal_id, term_id)`  
- Theme shift helpers: single entry point, deterministic order, never touches `held`

### 4.7 RLS

- `terms`, `bell_slots`, `calendar_days`: SELECT authenticated; write owner  
- `schedule_entries`, lessons extensions, plan items: owner full; teacher read/write own journals (existing pattern)  
- Substitutions: explicit policy using `conducted_by` / owner — **must be designed before code**

---

## 5) Migration order and effort

Suggested order (after T-069):

1. Enums + `terms`, `bell_slots`, `calendar_days` + RLS  
2. `btree_gist` + `schedule_entries` + exclusion  
3. Extend `lessons` (status, kind, work_type, plan_item_id, conducted_by)  
4. `lesson_plan_items`  
5. `day_overrides`, `bell_day_exceptions`  
6. `generate_lessons` + schedule read RPCs  
7. Theme-shift RPCs + tests  
8. Seeds (synthetic only)

**Effort (Grok DB only, rough):**  
- Reference + schedule_entries + exclusion: **S–M**  
- Lesson columns + generate: **M**  
- Plan + shift rules + tests: **M–L** (highest risk)  
- Overrides/exceptions: **S** after core  

**Do not start migrations** until Owner locks: cancel-without-replace behaviour, substitution RLS, and day_override shape.

---

## Summary for Claude / Owner

- Model is **Free-viable**; use `btree_gist` exclusion for teacher conflicts.  
- Tighten substitution vs journal ownership and cancel/shift edge cases before SQL.  
- Theme shift is coherent if held rows are immutable and sequence excludes cancelled/replaced.  
- Implementation volume is moderate; plan-shift is the careful part.

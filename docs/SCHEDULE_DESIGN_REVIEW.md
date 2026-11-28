# Schedule model design review (T-070–T-073, T-078)

PROJECT: school_journal  
Author: Grok (database)  
Date: 2026-11-22 (updated 2026-11-23)  
Status: **письмова рецензія** — no migrations in this document  
Claude verdict: ACCEPTED as input for contract v1.2

---

## Рішення власника та погоджені правила (2026-11-23)

### Три рішення власника

1. **Відсутність і оцінки (інтерфейс).** Відсутній учень не може мати оцінок за урок; учня з оцінками не можна позначити відсутнім. Це правило **UI**, не жорсткий DB-check у T-069 (база як і раніше може зберігати оцінки при `is_absent` для сумісності; клієнт не дає ввести суперечність).
2. **Скасований урок = як замінений для плану.** `cancelled` не входить у наскрізний номер і **не споживає** тему тематичного плану (так само як `replaced`).
3. **Урок «за іншого вчителя».** Пишеться в журнал **цього класу й предмета** під іменем **Власника**, з **власною темою**, **поза планом** (не зсуває теми).

### Рекомендації Claude → врахувати в T-070–T-073

| Тема | Правило |
|------|--------|
| Теми запланованих уроків | **Обчислюються** з плану та послідовності уроків; **не зберігаються** як джерело істини на `planned` |
| Фіксація теми | `topic` і `plan_item_id` **фіксуються**, коли урок **проведено** (`held`) |
| Існуючі уроки при введенні status | Вже наявні рядки отримують **`held`** (щоб не зламати поточні дані) |
| «День-заміна» | **Явний перелік** записів на дату (знімок), не «використати шаблон вівторка» |
| Заміна за іншого / conducted_by | Журнал у **Власника**; поле «хто провів» — з **T-050** (поки достатньо імені Власника в журналі) |

### Дрібний ризик: два предмети в одному класі в одному слоті

Поточна пропозиція exclusion лише за `(teacher_id, weekday, slot, validity)` **не** забороняє два різні журнали **одного класу** в одному слоті (різні вчителі або той самий), бо **class_id не входить** у `schedule_entries` напряму.

**Пропозиція рішення (на вибір Owner у v1.2):**

- **A (рекомендовано):** exclusion також на `(class_id, weekday, slot, validity)`, де `class_id` береться з `journals.class_id` — через generated/stored column `class_id` на `schedule_entries` (денормалізація з journal) або через constraint trigger, що перевіряє overlap по journal→class.
- **B:** тільки app-level validation у UI при редагуванні розкладу (слабше).
- **C:** unique partial на `(journal_id, weekday, slot)` within validity via exclusion on journal_id (захищає один журнал, але не два предмети одного класу).

Рекомендація Grok: **A** з колонкою `class_id` not null FK, заповнюється з journal при insert/update (trigger), плюс exclusion на class+weekday+slot+daterange.

---

## 1) Unrealistic or risky on Supabase Free

| Topic | Assessment |
|-------|------------|
| **`btree_gist` + exclusion** | Available on Supabase Postgres. Free-compatible. |
| **Generate full-term lessons** | Storage OK; risk is statement timeout — batch by week/journal. |
| **Idempotent regenerate** | Skip rows with records/assessments or `held`; never wipe. |
| **Computed sequence** | Window functions; do not store if cancel/extra must stay correct. |
| **Theme shift** | Never rewrite **held**; cancelled/replaced do not consume plan themes (Owner 2026-11-23). |

**Verdict:** Implementable on Free. Operational care on bulk generate and held immutability.

---

## 2) Objections and simplifications

1. Open-ended `valid_to null` + range `[valid_from, coalesce(valid_to, infinity))`.
2. Single bell schedule per term + `bell_day_exceptions` for short days.
3. **day_overrides** = explicit snapshot list for that date (Claude/Owner 2026-11-23).
4. Soft statuses, no hard DELETE of lesson history.
5. Planned topics **computed**; persist on **held** only.
6. Substitution: under **Owner** journal for that class/subject, own topic, outside plan; `conducted_by` deferred to T-050.

---

## 3) Theme-shift rules (aligned 2026-11-23)

| Scenario | Rule |
|----------|------|
| **Replaced** | Not in sequence; does not consume plan theme; theme goes to next counted lesson |
| **Cancelled** | **Same as replaced** for sequence and plan |
| **Extra** | Takes next plan theme; later themes shift earlier |
| **Substitution (Owner covers)** | Own topic, outside plan, **no shift** |
| **Held** | Immutable topic / plan_item_id; shift does not touch |

---

## 4) Table sketch (when v1.2 accepted — not implementing now)

Unchanged in spirit from prior review: `terms`, `bell_slots`, `calendar_days`, `schedule_entries` (+ recommended `class_id`), extended `lessons`, `lesson_plan_items`, `day_overrides` (snapshot), `bell_day_exceptions`, invoker RPCs, RLS owner/teacher.

Sequence: not stored; exclude `cancelled` and `replaced`.

---

## 5) Migration order and effort

**Do not start T-070–T-073 / T-078 migrations** until contract v1.2 is accepted by Owner.

Order when unlocked: reference → schedule_entries+exclusion (incl. class slot) → lessons columns → plan → overrides → generate/read RPCs → shift RPCs → synthetic seed.

Effort: plan-shift and generate remain the careful parts (M–L).

---

## Summary

Owner decisions of 2026-11-23 close cancel/sequence and substitution placement. Planned topics are computed; held freezes them. Add class-level slot exclusion to avoid two subjects in one class period. No schedule migrations until DATA_CONTRACT v1.2 is approved.

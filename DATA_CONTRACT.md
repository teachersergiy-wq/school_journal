# DATA_CONTRACT.md — контракт даних «Шкільний журнал» (T-013)

Статус документа: **PROPOSED → READY FOR ACCEPT** (відповіді власника на Q1–Q5 отримано 2026-11-01).
Область: етап 1 — класний журнал оцінок. Відвідуваність/харчування (етап 2) — PLANNED, тут не описуються.
Виконавець схеми: Grok (папка `supabase/`). Зміни контракту — лише через Claude і власника.

> Примітка: чернетку складено без звірки з DECISIONS.md/PROJECT_CONTEXT.md (запис і читання Hub були недоступні). Перед ACCEPTED звірити, зокрема шкалу оцінок і ролі.

## 0. Рамки

- Supabase Free, жодних платних функцій. Проєкт ще не створено (T-005, регіон обирає власник).
- Репозиторій PUBLIC: у `supabase/` лише схема, політики, синтетичний seed. Жодних ключів, паролів, service-role, реальних даних.
- У всіх таблицях `public` увімкнено RLS. Без політики доступу немає.
- Ідентифікатори: `uuid` (default `gen_random_uuid()`), часові мітки `timestamptz` (`created_at`, `updated_at`).
- Мова значень enum: англійські коди в БД, українські підписи в застосунку.

## 1. Рішення T-010, закладені в контракт

| # | Рішення | Статус |
|---|---|---|
| 1 | Відсутність («н») ставить учитель на уроці в журналі; щоденна відвідуваність для харчування окрема (варіант А) | ACCEPTED |
| 2 | Домашнє завдання: три рівні — виконано / частково / не виконано | ACCEPTED |
| 3 | Зошит і підручник — два окремі показники | ACCEPTED |
| 4 | Поведінка — список позначок (кілька на учня на уроці); стартовий перелік 6, з можливістю додавання | ACCEPTED |
| 5 | Вихід з класу — поки лише причина (без тривалості) | ACCEPTED |
| 6 | Оцінка і «н» — у вікні уроку | ACCEPTED |
| 7 | Колонки ГР1–ГР3 скасовано | ACCEPTED |
| 8 | Вибір «предмет/клас» відкриває журнал цього предмета цього класу; вибір дати відкриває вікно уроку | ACCEPTED |

## 2. Сутності й зв'язки

```
auth.users 1─1 profiles
classes 1─N students
subjects, classes, profiles(teacher) ─► journals   (journal = предмет + клас + вчитель + навчальний рік)
journals 1─N lessons
lessons 1─N lesson_records            (по одному на учня)
lesson_records M─N behavior_marks     (через lesson_record_behavior)
lesson_records 1─N lesson_exits
lessons 1─N assessments ◄─N students  (оцінки за урок)
```

Cardinality: учень належить одному класу (`students.class_id`; перехід між роками — окреме рішення, див. Q3). Вчитель веде кілька журналів. Один урок — один журнал. Один вчитель на журнал (Q5).

## 3. Ролі

- `owner` (власник/адміністратор): керує довідниками (класи, учні, предмети, позначки поведінки), бачить усе.
- `teacher`: працює лише зі своїми журналами (`journals.teacher_id = auth.uid()`).
- Інших ролей на етапі 1 немає (учні/батьки без доступу). Анонімний доступ заборонено.

## 4. Таблиці

Позначення: **NN** — обов'язкове, **NULL** — необов'язкове.

### 4.1 profiles
| поле | тип | |
|---|---|---|
| id | uuid PK, FK → auth.users | NN |
| display_name | text | NN |
| role | enum `app_role` (`owner`,`teacher`) | NN |

### 4.2 classes
| id | uuid PK | NN |
| grade | smallint, 1–11 | NN |
| letter | text, 1 символ (наприклад «А») | NULL |
| school_year | smallint (рік початку, наприклад 2026) | NN |
Унікальність: (grade, letter, school_year).

### 4.3 students
| id | uuid PK | NN |
| class_id | FK → classes | NN |
| full_name | text (лише вигадані дані!) | NN |
| is_active | boolean default true | NN |

### 4.4 subjects
| id | uuid PK | NN |
| name | text unique | NN |

### 4.5 journals
| id | uuid PK | NN |
| class_id | FK → classes | NN |
| subject_id | FK → subjects | NN |
| teacher_id | FK → profiles | NN |
Унікальність: (class_id, subject_id, teacher_id). Навчальний рік береться з класу. Один вчитель на журнал (Q5).

### 4.6 lessons
| id | uuid PK | NN |
| journal_id | FK → journals, on delete cascade | NN |
| lesson_date | date | NN |
| lesson_number | smallint default 1, 1–10 (для здвоєних уроків) | NN |
| topic | text | NULL |
Унікальність: (journal_id, lesson_date, lesson_number). Урок створюється, коли вчитель вперше відкриває дату.

### 4.7 behavior_marks (довідник)
| id | uuid PK | NN |
| code | text unique | NN |
| label | text | NN |
| is_positive | boolean | NN |
| is_active | boolean default true | NN |

Стартовий перелік (ACCEPTED, 6 шт.): `disrupts` заважає, `talks` розмовляє, `uses_phone` користується телефоном, `rude` грубість, `active` активна участь, `helps` допомагає іншим. Можливість додавати нові через довідник.

### 4.8 lesson_records (характеристики учня на уроці)
Один рядок на (урок, учень). Відсутність рядка = нічого не позначено.

| поле | тип | значення |
|---|---|---|
| id | uuid PK | NN |
| lesson_id | FK → lessons, cascade | NN |
| student_id | FK → students | NN |
| is_absent | boolean default false | «н» |
| homework | enum `hw_status` | `done`, `partial`, `not_done`; NULL = не позначено |
| has_notebook | boolean | NULL = не позначено |
| has_textbook | boolean | NULL = не позначено |
| not_taking_notes | boolean | не веде записів; NULL = не позначено |
| board_refused | boolean default false | відмова працювати біля дошки (якщо true — оцінка board не ставиться) |
| late_minutes | smallint, 1–90 | NULL = не запізнювався |

Унікальність: (lesson_id, student_id).
Обмеження: якщо `is_absent = true`, то `homework`, `has_notebook`, `has_textbook`, `not_taking_notes`, `board_refused`, `late_minutes` мають бути NULL, а поведінка, виходи й оцінки для цього рядка не додаються.

### 4.9 lesson_record_behavior (M:N)
| record_id | FK → lesson_records, cascade | NN |
| mark_id | FK → behavior_marks | NN |
PK: (record_id, mark_id).

### 4.10 lesson_exits (виходи з класу)
| id | uuid PK | NN |
| record_id | FK → lesson_records, cascade | NN |
| reason | enum `exit_reason`: `toilet`,`phone`,`other` | NN |
Кілька виходів на урок дозволено (кілька рядків). Тривалість не зберігається (рішення 5).

### 4.11 assessments (оцінки)
| id | uuid PK | NN |
| lesson_id | FK → lessons, cascade | NN |
| student_id | FK → students | NN |
| value | smallint, 1–12 (12-бальна шкала) | NN |
| kind | enum `assessment_kind`: `current`,`thematic`,`board` | NN, default `current` |
Оцінки живуть окремо від `lesson_records`, щоб на одному уроці було кілька оцінок. У вікні уроку відображаються поруч із рядком учня.
Правило (Q4): оцінка `kind = 'board'` і прапорець `board_refused` взаємовиключні.

## 5. Матриця прав (етап 1)

S — SELECT, I — INSERT, U — UPDATE, D — DELETE. «Свої» = пов'язані з журналом, де `teacher_id = auth.uid()`.

| таблиця | owner | teacher |
|---|---|---|
| profiles | S I U D | S (свій) |
| classes, students, subjects | S I U D | S (з тих класів, де має журнал) |
| behavior_marks | S I U D | S |
| journals | S I U D | S (свої) |
| lessons | S I U D | S I U D (свої) |
| lesson_records, lesson_record_behavior, lesson_exits | S I U D | S I U D (свої) |
| assessments | S I U D | S I U D (свої) |

Анонімна роль: нічого. Права через RLS-політики, роль береться з `profiles`. Жодного обходу RLS із клієнта.

## 6. Потрібні запити застосунку

1. **Мої журнали:** список (клас + предмет) поточного вчителя.
2. **Дати уроків журналу:** `lessons` за `journal_id`, за датою за спаданням.
3. **Вікно уроку:** усі активні учні класу журналу (ліворуч) з лівим з'єднанням `lesson_records`, позначками поведінки, виходами й оцінками (праворуч). Учні без запису показуються порожніми.
4. **Створити урок за датою:** upsert за (journal_id, lesson_date, lesson_number).
5. **Зберегти запис учня:** upsert `lesson_records` за (lesson_id, student_id) разом із заміною позначок поведінки й виходів, одним викликом (функція RPC або транзакція).
6. **Оцінки учня за предмет** (перегляд і середнє) — PLANNED, формат узгодити на T-013.
7. **Експорт журналу в CSV** за період — PLANNED, формується в застосунку з запитів 2–3.

## 7. Обмеження Free і seed

- Free: обмежений розмір бази, відсутність PITR, проєкт може призупинятися при неактивності. Точні цифри Grok звіряє з актуальною документацією (мною не перевірено).
- Резервні копії: власний експорт даних за розкладом — окреме рішення власника.
- Обсяг даних мізерний (клас ~30 учнів × уроки × кілька полів), у ліміти Free вкладаємось із запасом.
- `seed.sql`: **лише синтетичний і малий**: 1 клас, ~10 учнів із нейтральними вигаданими іменами («Учень 01»…), 2 предмети, 5 уроків, кілька записів. Жодних реальних імен.

## 8. Відповіді власника на відкриті питання (2026-11-01)

| Q | Питання | Відповідь | Статус |
|---|---|---|---|
| Q1 | Перелік позначок поведінки | 6 позначок (disrupts, talks, uses_phone, rude, active, helps) + можливість додавати через довідник | ACCEPTED |
| Q2 | Шкала оцінок | 12-бальна; види: current, thematic (+ board для роботи біля дошки) | ACCEPTED |
| Q3 | Перехід учнів між класами | Поки без історії (`class_id` один). Достатньо для етапу 1 | ACCEPTED |
| Q4 | Робота біля дошки | Оцінка (kind=`board`) **або** відмітка про відмову (`board_refused`) | ACCEPTED |
| Q5 | Кількість вчителів на журнал | Один вчитель на журнал | ACCEPTED |

### Наслідки для схеми (Q4)
- Поле `board_work` (boolean) **прибрано**.
- Додано `lesson_records.board_refused boolean default false`.
- Оцінка за роботу біля дошки ставиться в `assessments` з `kind = 'board'`.
- Правило: якщо `board_refused = true`, оцінка kind=`board` для цього учня на уроці не створюється (і навпаки — при наявності оцінки board_refused = false).

## 9. Готовність
Після ACCEPTED власником Grok починає T-020 (core schema) у гілці `grok/T-020`.

# Шкільний журнал

Мобільний PWA-каркас класного журналу. T-030 використовує лише вигадані демонстраційні дані; підключення Supabase — T-031/T-032.

## Вимоги
- Node.js 20+
- npm

## Локальний запуск
```sh
cp .env.example .env
npm run dev
```
Відкрийте http://127.0.0.1:4173. Для телефону в локальній мережі: `HOST=0.0.0.0 npm run dev`.

Демо-вхід: будь-який коректний email і непорожній пароль (дані не йдуть на сервер).

## Перевірка та збірка
```sh
npm run check   # перевірка синтаксису JavaScript і полів контракту (не ESLint)
npm run build
npm run check:subpath   # повна перевірка під шляхом GitHub Pages /school_journal/
npm run preview
```
Статика в `dist/`. Команда `npm run check:subpath` сама збирає проєкт і перевіряє оболонку та PNG-іконки під `/school_journal/` на вбудованому сервері Node.js.

## Перевірка підшляху GitHub Pages
Команда `npm run check:subpath` виконує збірку, тимчасово розміщує `dist/` за адресою `/school_journal/` та перевіряє відповіді, типи вмісту і відносні шляхи. Тимчасові файли видаляються після перевірки.

## Налаштування
`.env.example` → `.env`. У T-030 лише `SJ_DATA_SOURCE=mock`. Не комітьте ключі чи реальні дані учнів.

## Розгортання

Застосунок розгортається на GitHub Pages за адресою https://teachersergiy-wq.github.io/school_journal/. Workflow автоматично запускає перевірки й розгортання після кожного push у `main`; його також можна запустити вручну в GitHub Actions.

Перший запуск використовує лише вигадані дані в режимі `mock`. Для першого розгортання власник має відкрити **Settings → Pages** і встановити **Source: GitHub Actions**.

Після прийняття T-031 можна перейти на режим Supabase: у **Settings → Secrets and variables → Actions → Variables** додати публічні repository variables `SJ_DATA_SOURCE=supabase`, `SJ_SUPABASE_URL` і `SJ_SUPABASE_ANON_KEY`. Не додавайте service-role чи секретний ключ. Після першого розгортання встановіть у Supabase Auth **Site URL** і **Redirect URLs** на адресу сторінки вище.

Щоб відкотити невдале розгортання, створіть і злийте pull request, який повертає небажану зміну в `main`; Pages workflow розгорне відновлену версію. Щоб повернутися до вигаданих даних, встановіть `SJ_DATA_SOURCE=mock` або видаліть цю variable, потім повторно запустіть workflow.

## Будильник

Workflow `.github/workflows/keepalive.yml` раз на три дні викликає `ops.keepalive()` через Data API. Це мінімальний запит до бази, призначений підтримувати активність і зменшувати ризик паузи проєкту Supabase Free; він не є гарантією. Supabase оцінює низьку активність за тиждень і надсилає власнику лист-попередження приблизно за тиждень до можливої паузи ([документація Supabase про автоматичну паузу](https://supabase.com/docs/guides/platform/free-project-pausing)).

Щоб налаштувати будильник:

1. У **Settings → Secrets and variables → Actions → Variables** створіть repository variables `SJ_SUPABASE_URL` і `SJ_SUPABASE_ANON_KEY`. Це публічні значення; workflow надсилає лише заголовок `apikey`, без `Authorization: Bearer`.
2. Після застосування міграції Grok додайте схему `ops` до списку відкритих схем у Supabase **Data API settings**.
3. У **Actions → Supabase keep-alive** запустіть workflow вручну й перевірте, що результат зелений.

Якщо одна зі змінних ще не створена, workflow завершується успішно з попередженням «будильник ще не налаштований». Після налаштування він виводить лише HTTP-код відповіді, не ключ і не тіло відповіді.

GitHub повідомляє, що в публічному репозиторії вимикає планові workflow після 60 днів без активності репозиторію ([документація GitHub про вимкнення workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)). Тому власнику слід щомісяця перевіряти вкладку **Actions** і, якщо workflow вимкнений, знову увімкнути та запустити його вручну.

## Шляхи
Усі посилання відносні (`./…`), щоб працювало в підпапці (`/school_journal/` на GitHub Pages).

Див. [docs/STACK.md](docs/STACK.md).

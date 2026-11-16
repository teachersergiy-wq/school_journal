import { createRepository } from './data.js';

const app = document.querySelector('#app');
const repo = createRepository(window.SCHOOL_JOURNAL_CONFIG);
const s = { user: null, screen: 'signin', journals: [], journal: null, lessons: [], lesson: null, windowData: null };
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (v) =>
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(v + 'T12:00:00'));

const ASSESSMENT_KIND_LABELS = {
  current: 'Поточна',
  independent: 'Самостійна',
  control: 'Контрольна',
  thematic: 'Тематична',
  board: 'Біля дошки',
};
const assessmentKindLabel = (kind) =>
  Object.prototype.hasOwnProperty.call(ASSESSMENT_KIND_LABELS, kind)
    ? ASSESSMENT_KIND_LABELS[kind]
    : kind
      ? String(kind)
      : 'невідомий вид';

function header(title, back = '') {
  return `<header class="topbar">${back ? `<button class="icon-button" data-action="${esc(back)}" aria-label="Назад">←</button>` : '<span class="brand-mark">Ш</span>'}<div class="topbar-title"><span class="eyebrow">ШКІЛЬНИЙ ЖУРНАЛ</span><strong>${esc(title)}</strong></div>${s.user ? '<span class="avatar">У</span>' : ''}</header>`;
}

function nav() {
  return '<nav class="bottom-nav"><button class="nav-item active" data-action="journals"><span>▤</span><small>Журнали</small></button><button class="nav-item" data-action="profile"><span>◉</span><small>Профіль</small></button></nav>';
}

function signIn(message = '') {
  app.innerHTML = `<section class="signin-page"><div class="signin-brand"><div class="brand-mark brand-mark-large">Ш</div><p class="eyebrow">ВАШ РОБОЧИЙ ПРОСТІР</p><h1>Шкільний<br>журнал</h1><p class="muted">Уроки, оцінки та щоденна робота класу — в одному місці.</p></div><form id="login" class="signin-card"><div><span class="eyebrow">ВХІД ДО СИСТЕМИ</span><h2>Вітаємо!</h2><p class="muted">Увійдіть, щоб відкрити свої журнали.</p></div><label class="field-label" for="email">Електронна пошта</label><input id="email" name="email" type="email" autocomplete="username" placeholder="teacher@example.com" required><label class="field-label" for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Введіть пароль" required>${message ? `<p class="form-error" role="alert">${esc(message)}</p>` : ''}<button class="primary-button full-button">Увійти <span>›</span></button><p class="demo-note"><span class="status-dot"></span> Демонстраційний режим · дані вигадані</p></form><p class="signin-foot">Немає реєстрації та відновлення пароля в цій версії.</p></section>`;
  document.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      s.user = await repo.signIn(f.get('email'), f.get('password'));
      s.journals = await repo.getJournals();
      s.screen = 'journals';
      render();
    } catch (err) {
      signIn(err.message);
    }
  });
}

function journals() {
  app.innerHTML = `${header('Мої журнали')}<main class="page-content"><section class="welcome-row"><div><p class="eyebrow">НАВЧАЛЬНИЙ ПРОЦЕС</p><h1>Добрий день!</h1><p class="muted">Оберіть клас і предмет, щоб продовжити.</p></div><div class="welcome-icon">✦</div></section><div class="section-heading"><div><h2>Мої журнали</h2><p class="muted">${s.journals.length} навчальні журнали</p></div><span class="count-pill">2026 / 2027</span></div><section class="journal-list">${s.journals
    .map(
      (j, i) =>
        `<button class="journal-card" data-journal="${esc(j.id)}"><span class="subject-icon ${i ? 'violet' : ''}">${i ? '△' : '∑'}</span><span class="journal-main"><strong>${esc(j.subject)}</strong><span>${esc(j.className)} клас · ${j.studentsCount} учнів</span><small>Навчальний рік 2026–2027</small></span><span class="card-chevron">›</span></button>`
    )
    .join('')}</section><div class="info-banner"><span class="info-icon">i</span><p>Демонстраційний журнал. Усі учні та записи — вигадані.</p></div></main>${nav()}`;
  app.querySelectorAll('[data-journal]').forEach((b) =>
    b.addEventListener('click', async () => {
      s.journal = s.journals.find((j) => j.id === b.dataset.journal);
      s.lessons = await repo.getLessons(s.journal.id);
      s.screen = 'lessons';
      render();
    })
  );
}

function lessonDates() {
  app.innerHTML = `${header(s.journal.subject + ' · ' + s.journal.className, 'journals')}<main class="page-content"><div class="crumb">МОЇ ЖУРНАЛИ <span>/</span> ${esc(s.journal.subject.toUpperCase())}</div><section class="journal-summary"><div class="subject-icon">${s.journal.subject === 'Алгебра' ? '∑' : '△'}</div><div><h1>${esc(s.journal.subject)}</h1><p>${esc(s.journal.className)} клас · ${s.journal.studentsCount} учнів</p></div><span class="year-chip">2026–27</span></section><div class="section-heading"><div><h2>Дати уроків</h2><p class="muted">Оберіть урок для перегляду</p></div><span class="count-pill">${s.lessons.length} уроків</span></div><section class="lesson-list">${s.lessons
    .map(
      (l, i) =>
        `<button class="lesson-card" data-lesson="${esc(l.id)}"><span class="date-tile"><strong>${new Date(l.date + 'T12:00:00').getDate()}</strong><small>${new Intl.DateTimeFormat('uk-UA', { month: 'short' }).format(new Date(l.date + 'T12:00:00')).replace('.', '')}</small></span><span class="lesson-main"><strong>${esc(l.topic)}</strong><span>${date(l.date)} · урок ${l.number}</span>${i === 0 ? '<small class="latest-tag">Останній запис</small>' : ''}</span><span class="card-chevron">›</span></button>`
    )
    .join('')}</section></main>${nav()}`;
  app.querySelectorAll('[data-lesson]').forEach((b) =>
    b.addEventListener('click', async () => {
      s.lesson = s.lessons.find((l) => l.id === b.dataset.lesson);
      s.windowData = await repo.getLessonWindow(s.lesson.id, s.journal.id);
      s.screen = 'lesson';
      render();
    })
  );
}

function lessonWindow() {
  const d = s.windowData;
  const hw = { done: 'виконано', partial: 'частково', not_done: 'не виконано' };
  const exit = { toilet: 'туалет', phone: 'телефон', other: 'інше' };
  const rows = d.students
    .map((st, i) => {
      const r = st.record;
      let chips = r?.isAbsent
        ? '<span class="detail-chip absent">Відсутній · н</span>'
        : r
          ? `<span class="detail-chip">Д/з: ${hw[r.homework] ?? '—'}</span>${r.lateMinutes ? `<span class="detail-chip">Запізнення ${r.lateMinutes} хв</span>` : ''}${(r.assessments ?? []).map((a) => `<span class="detail-chip grade">${a.value} балів · ${esc(assessmentKindLabel(a.kind))}</span>`).join('')}${(r.behavior ?? []).map((id) => `<span class="detail-chip behavior">${esc(d.behaviorMarks.find((m) => m.id === id)?.label ?? id)}</span>`).join('')}${r.hasNotebook === false ? '<span class="detail-chip">Без зошита</span>' : ''}${r.hasTextbook === false ? '<span class="detail-chip">Без підручника</span>' : ''}${r.notTakingNotes ? '<span class="detail-chip">Не записує</span>' : ''}${r.boardRefused ? '<span class="detail-chip">Відмова біля дошки</span>' : ''}${(r.exits ?? []).map((x) => `<span class="detail-chip">Вихід: ${exit[x.reason]}</span>`).join('')}`
          : '<span class="detail-chip muted-chip">Ще не позначено</span>';
      return `<article class="student-row"><span class="student-number">${String(i + 1).padStart(2, '0')}</span><div class="student-content"><div class="student-name-line"><strong>${esc(st.fullName)}</strong>${r?.isAbsent ? '<span class="absence-pill">н</span>' : r ? '<span class="tiny-value">Запис є</span>' : '<span class="empty-status">—</span>'}</div><div class="student-details">${chips}</div></div></article>`;
    })
    .join('');
  app.innerHTML = `${header('Вікно уроку', 'lessons')}<main class="page-content"><div class="crumb">${esc(s.journal.subject.toUpperCase())} <span>/</span> ${esc(s.journal.className)} <span>/</span> ${date(s.lesson.date).toUpperCase()}</div><section class="lesson-title-block"><div><p class="eyebrow">${esc(s.journal.subject)} · ${esc(s.journal.className)}</p><h1>${date(s.lesson.date)}</h1><p class="muted">${esc(s.lesson.topic)} · урок ${s.lesson.number}</p></div><span class="readonly-chip">Лише перегляд</span></section><div class="window-stats"><div><strong>${d.students.length}</strong><span>учнів у класі</span></div><div><strong>${d.students.filter((x) => x.record?.isAbsent).length}</strong><span>відсутні</span></div><div><strong>${d.students.filter((x) => x.record).length}</strong><span>заповнено</span></div></div><div class="section-heading"><div><h2>Учні та характеристики</h2><p class="muted">Позначки за цей урок</p></div><span class="readonly-tag">DEMO</span></div><section class="student-list">${rows}</section><p class="readonly-note">Редагування та збереження будуть додані в наступних етапах.</p></main>${nav()}`;
}

function render() {
  if (!s.user) return signIn();
  if (s.screen === 'journals') return journals();
  if (s.screen === 'lessons') return lessonDates();
  if (s.screen === 'lesson') return lessonWindow();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'journals') {
    s.screen = 'journals';
    render();
  }
  if (b.dataset.action === 'lessons') {
    s.screen = 'lessons';
    render();
  }
  if (b.dataset.action === 'profile') alert('Демонстраційний профіль учителя');
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

render();

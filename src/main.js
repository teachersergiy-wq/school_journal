import { createRepository } from './data.js';
import { createNavigationState, journalsForClass, journalsForPair, navigateBack, navigateTo } from './navigation.js';

const app = document.querySelector('#app');
const repo = createRepository(window.SCHOOL_JOURNAL_CONFIG);
const s = { user: null, screen: 'signin', nav: createNavigationState(), journals: [], journal: null, selectedClassId: null, lessons: [], lesson: null, windowData: null, focusDate: null };
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (v) =>
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(v + 'T12:00:00'));
const assessmentKindLabels = {
  current: 'поточна',
  independent: 'самостійна',
  control: 'контрольна',
  thematic: 'тематична',
  board: 'біля дошки'
};

function header(title, back = true) {
  return `<header class="topbar">${s.user && back ? '<button class="icon-button" data-action="back" aria-label="Назад">←</button>' : '<span class="brand-mark">Ш</span>'}<div class="topbar-title"><span class="eyebrow">ШКІЛЬНИЙ ЖУРНАЛ</span><strong>${esc(title)}</strong></div>${s.user ? '<button class="icon-button home-button" data-action="home" aria-label="Головна">⌂</button>' : ''}</header>`;
}

function nav() {
  return '<nav class="bottom-nav"><button class="nav-item active" data-action="journals"><span>▤</span><small>Журнали</small></button><button class="nav-item" data-action="profile"><span>◉</span><small>Профіль</small></button></nav>';
}

function signIn(message = '') {
  app.innerHTML = `<section class="signin-page"><div class="signin-brand"><div class="brand-mark brand-mark-large">Ш</div><p class="eyebrow">ВАШ РОБОЧИЙ ПРОСТІР</p><h1>Шкільний<br>журнал</h1><p class="muted">Уроки, оцінки та щоденна робота класу — в одному місці.</p></div><form id="login" class="signin-card"><div><span class="eyebrow">ВХІД ДО СИСТЕМИ</span><h2>Вітаємо!</h2><p class="muted">Увійдіть, щоб відкрити свої журнали.</p></div><label class="field-label" for="email">Електронна пошта</label><input id="email" name="email" type="email" autocomplete="username" placeholder="teacher@example.com" required><label class="field-label" for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Введіть пароль" required>${message ? `<p class="form-error" role="alert">${esc(message)}</p>` : ''}<button class="primary-button full-button">Увійти <span>›</span></button><p class="demo-note"><span class="status-dot"></span> ${repo.mode === 'mock' ? 'Демонстраційний режим · дані вигадані' : 'Захищений режим · лише перегляд'}</p></form><p class="signin-foot">Немає реєстрації та відновлення пароля в цій версії.</p></section>`;
  document.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      s.user = await repo.signIn(f.get('email'), f.get('password'));
      s.journals = await repo.getJournals();
      s.nav = createNavigationState('home');
      s.screen = 'home';
      render();
    } catch (err) {
      signIn(err.message);
    }
  });
}

function home() {
  app.innerHTML = `${header('Головна', false)}<main class="page-content"><section class="welcome-row"><div><p class="eyebrow">НАВЧАЛЬНИЙ ПРОЦЕС</p><h1>Добрий день!</h1><p class="muted">Ваш робочий простір учителя.</p></div><div class="welcome-icon">✦</div></section><section class="journal-list"><button class="journal-card" data-action="journals"><span class="subject-icon">▤</span><span class="journal-main"><strong>Журнали</strong><span>Класи та предмети</span></span><span class="card-chevron">›</span></button></section></main>${nav()}`;
}

function journals() {
  const classes = [...new Map(s.journals.map((j) => [j.classId, j])).values()];
  app.innerHTML = `${header('Журнали')}<main class="page-content"><div class="crumb">НАВЧАЛЬНИЙ ПРОЦЕС <span>/</span> ЖУРНАЛИ</div><div class="section-heading"><div><h1>Оберіть клас</h1><p class="muted">${classes.length} класи</p></div></div><section class="journal-list">${classes.map((j) => `<button class="journal-card" data-class="${esc(j.classId)}"><span class="subject-icon">▦</span><span class="journal-main"><strong>${esc(j.className)} клас</strong><span>${journalsForClass(s.journals, j.classId).length} предмети</span></span><span class="card-chevron">›</span></button>`).join('')}</section>${s.journals.length ? '' : '<p class="muted">Журналів поки немає.</p>'}<div class="info-banner"><span class="info-icon">i</span><p>${repo.mode === 'mock' ? 'Демонстраційний журнал. Усі учні та записи — вигадані.' : 'Дані доступні лише в межах прав поточного користувача.'}</p></div></main>${nav()}`;
  app.querySelectorAll('[data-class]').forEach((button) => button.addEventListener('click', () => {
    s.selectedClassId = button.dataset.class;
    s.nav = navigateTo(s.nav, 'subjects', { classId: s.selectedClassId });
    s.screen = 'subjects';
    render();
  }));
}

function subjects() {
  const journals = journalsForClass(s.journals, s.selectedClassId);
  const className = journals[0]?.className ?? '';
  const subjects = [...new Map(journals.map((j) => [j.subjectId, j])).values()];
  app.innerHTML = `${header(className + ' · Предмети')}<main class="page-content"><div class="crumb">ЖУРНАЛИ <span>/</span> ${esc(className.toUpperCase())}</div><div class="section-heading"><div><h1>Оберіть предмет</h1><p class="muted">${esc(className)} клас</p></div></div><section class="journal-list">${subjects.map((j, i) => `<button class="journal-card" data-subject="${esc(j.subjectId)}"><span class="subject-icon ${i ? 'violet' : ''}">${i ? '△' : '∑'}</span><span class="journal-main"><strong>${esc(j.subject)}</strong><span>${esc(className)} клас · ${j.studentsCount} учнів</span></span><span class="card-chevron">›</span></button>`).join('')}</section></main>${nav()}`;
  app.querySelectorAll('[data-subject]').forEach((button) => button.addEventListener('click', async () => {
    s.journal = journalsForPair(s.journals, s.selectedClassId, button.dataset.subject)[0] ?? null;
    if (!s.journal) return;
    s.lessons = await repo.getLessons(s.journal.id);
    s.nav = navigateTo(s.nav, 'lessons', { classId: s.journal.classId, subjectId: s.journal.subjectId, journalId: s.journal.id });
    s.screen = 'lessons';
    render();
  }));
}

function lessonDates() {
  app.innerHTML = `${header(s.journal.subject + ' · ' + s.journal.className)}<main class="page-content"><div class="crumb">ЖУРНАЛИ <span>/</span> ${esc(s.journal.className.toUpperCase())} <span>/</span> ${esc(s.journal.subject.toUpperCase())}</div><section class="journal-summary"><div class="subject-icon">${s.journal.subject === 'Алгебра' ? '∑' : '△'}</div><div><h1>${esc(s.journal.subject)}</h1><p>${esc(s.journal.className)} клас · ${s.journal.studentsCount} учнів</p></div><span class="year-chip">2026–27</span></section><div class="section-heading"><div><h2>Дати уроків</h2><p class="muted">Оберіть урок для перегляду</p></div><span class="count-pill">${s.lessons.length} уроків</span></div><form id="add-lesson" class="add-lesson-form"><label>Дата<input name="date" type="date" required></label><label>Номер уроку<select name="number" required>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></label><label>Тема<input name="topic" maxlength="300" required></label><button class="primary-button">Додати урок</button><p class="form-error" id="lesson-error" role="alert" hidden></p></form><section class="lesson-list">${s.lessons
    .map(
      (l, i) =>
        `<button class="lesson-card ${s.focusDate === l.date ? 'focused-lesson' : ''}" data-lesson="${esc(l.id)}" ${s.focusDate === l.date ? 'aria-current="date"' : ''}><span class="date-tile"><strong>${new Date(l.date + 'T12:00:00').getDate()}</strong><small>${new Intl.DateTimeFormat('uk-UA', { month: 'short' }).format(new Date(l.date + 'T12:00:00')).replace('.', '')}</small></span><span class="lesson-main"><strong>${esc(l.topic)}</strong><span>${date(l.date)} · урок ${l.number}</span>${i === 0 ? '<small class="latest-tag">Останній запис</small>' : ''}</span><span class="card-chevron">›</span></button>`
    )
    .join('')}</section></main>${nav()}`;
  app.querySelectorAll('[data-lesson]').forEach((b) =>
    b.addEventListener('click', async () => {
      s.lesson = s.lessons.find((l) => l.id === b.dataset.lesson);
      s.windowData = await repo.getLessonWindow(s.lesson.id, s.journal.id);
      s.nav = navigateTo(s.nav, 'lesson', { lessonId: s.lesson.id, journalId: s.journal.id });
      s.screen = 'lesson';
      render();
    })
  );
  if (s.focusDate) app.querySelector('[aria-current="date"]')?.scrollIntoView?.({ block: 'center' });

  const addForm = app.querySelector('#add-lesson');
  addForm.elements.date.value = new Date().toLocaleDateString('en-CA');
  addForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = new FormData(addForm);
    const errorBox = app.querySelector('#lesson-error');
    errorBox.hidden = true;
    try {
      await repo.createLesson(s.journal.id, {
        date: fields.get('date'), number: fields.get('number'), topic: fields.get('topic')
      });
      s.lessons = await repo.getLessons(s.journal.id);
      render();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });
}

function lessonWindow() {
  const d = s.windowData;
  const boolSelect = (name, value, label) => `<label>${label}<select name="${name}"><option value="" ${value == null ? 'selected' : ''}>Не позначено</option><option value="true" ${value === true ? 'selected' : ''}>Так</option><option value="false" ${value === false ? 'selected' : ''}>Ні</option></select></label>`;
  const kindOptions = (kind) => ['current', 'independent', 'control', 'thematic', 'board'].map((value) => `<option value="${value}" ${kind === value ? 'selected' : ''}>${assessmentKindLabels[value]}</option>`).join('') + (kind && !assessmentKindLabels[kind] ? `<option value="${esc(kind)}" selected>Невідомий вид: ${esc(kind)}</option>` : '');
  const reasonLabels = { toilet: 'Туалет', phone: 'Телефон', other: 'Інше' };
  const exitRows = (exits) => (exits.length ? exits : ['']).map((exit) => {
    const reason = typeof exit === 'string' ? exit : exit.reason;
    return `<div class="exit-row"><select name="exits"><option value="" ${!reason ? 'selected' : ''}>Не позначено</option>${Object.entries(reasonLabels).map(([value, label]) => `<option value="${value}" ${reason === value ? 'selected' : ''}>${label}</option>`).join('')}</select><button type="button" class="text-button" data-remove-exit aria-label="Прибрати вихід">−</button></div>`;
  }).join('');
  const rows = d.students.map((st, i) => {
    const r = st.record ?? {};
    const assessments = r.assessments ?? [];
    return `<article class="student-editor" data-student-card="${esc(st.id)}"><div class="student-name-line"><span class="student-number">${String(i + 1).padStart(2, '0')}</span><strong>${esc(st.fullName)}</strong>${r.isAbsent ? '<span class="absence-pill">н</span>' : ''}</div><form class="record-form" data-record-form data-form-key="record:${esc(st.id)}" data-student-id="${esc(st.id)}"><label class="check-label"><input type="checkbox" name="isAbsent" ${r.isAbsent ? 'checked' : ''}> Відсутній («н»)</label><div class="record-fields"><label>Домашнє завдання<select name="homework"><option value="" ${!r.homework ? 'selected' : ''}>Не позначено</option><option value="done" ${r.homework === 'done' ? 'selected' : ''}>Виконано</option><option value="partial" ${r.homework === 'partial' ? 'selected' : ''}>Частково</option><option value="not_done" ${r.homework === 'not_done' ? 'selected' : ''}>Не виконано</option></select></label>${boolSelect('hasNotebook', r.hasNotebook, 'Зошит')}${boolSelect('hasTextbook', r.hasTextbook, 'Підручник')}${boolSelect('notTakingNotes', r.notTakingNotes, 'Ведення записів')}<label class="check-label"><input type="checkbox" name="boardRefused" ${r.boardRefused ? 'checked' : ''}> Відмова біля дошки</label><label>Запізнення, хв<input type="number" name="lateMinutes" min="1" max="90" value="${r.lateMinutes ?? ''}"></label></div><fieldset><legend>Поведінка</legend><div class="choice-list">${d.behaviorMarks.map((mark) => `<label class="check-label"><input type="checkbox" name="behavior" value="${esc(mark.id)}" ${(r.behavior ?? []).includes(mark.id) ? 'checked' : ''}> ${esc(mark.label)}</label>`).join('')}</div></fieldset><fieldset><legend>Виходи з уроку</legend><div class="exit-list" data-exit-list>${exitRows(r.exits ?? [])}</div><button type="button" class="secondary-button add-exit-button" data-add-exit>Додати вихід</button></fieldset><p class="form-error" data-error hidden role="alert"></p><button class="primary-button">Зберегти позначки</button></form><section class="assessment-editor"><h3>Оцінки</h3>${assessments.map((a) => `<form class="assessment-row" data-assessment-form data-form-key="assessment:${esc(st.id)}:${esc(a.id)}" data-assessment-id="${esc(a.id)}" data-student-id="${esc(st.id)}"><input type="number" name="value" min="1" max="12" required value="${Number(a.value)}" aria-label="Оцінка"><select name="kind" aria-label="Вид оцінки">${kindOptions(a.kind)}</select><button class="secondary-button">Зберегти</button><button type="button" class="text-button" data-delete-assessment="${esc(a.id)}" data-student-id="${esc(st.id)}">Видалити</button></form>`).join('')}<form class="assessment-row" data-new-assessment data-form-key="new-assessment:${esc(st.id)}" data-student-id="${esc(st.id)}"><input type="number" name="value" min="1" max="12" required placeholder="1–12" aria-label="Нова оцінка"><select name="kind" aria-label="Вид оцінки">${kindOptions('current')}</select><button class="secondary-button">Додати оцінку</button></form><p class="form-error" data-assessment-error hidden role="alert"></p></section></article>`;
  }).join('');
  app.innerHTML = `${header('Вікно уроку', 'lessons')}<main class="page-content"><div class="crumb">${esc(s.journal.subject.toUpperCase())} <span>/</span> ${esc(s.journal.className)} <span>/</span> ${date(s.lesson.date).toUpperCase()}</div><section class="lesson-title-block"><div><p class="eyebrow">${esc(s.journal.subject)} · ${esc(s.journal.className)}</p><h1>${date(s.lesson.date)}</h1><p class="muted">${esc(s.lesson.topic)} · урок ${s.lesson.number}</p></div><div class="lesson-window-actions"><button class="secondary-button" data-action="journal">Журнал</button></div></section><div class="window-stats"><div><strong>${d.students.length}</strong><span>учнів у класі</span></div><div><strong>${d.students.filter((x) => x.record?.isAbsent).length}</strong><span>відсутні</span></div><div><strong>${d.students.filter((x) => x.record).length}</strong><span>заповнено</span></div></div><div class="section-heading"><div><h2>Учні та характеристики</h2><p class="muted">Позначки за цей урок</p></div><span class="readonly-tag">${repo.mode === 'mock' ? 'DEMO' : 'SUPABASE'}</span></div><section class="student-list">${rows}</section></main>${nav()}`;

  const captureDrafts = () => [...app.querySelectorAll('form[data-form-key]')].map((form) => {
    const occurrences = new Map();
    const fields = [...form.elements].filter((field) => field.name).map((field) => {
      const index = occurrences.get(field.name) ?? 0;
      occurrences.set(field.name, index + 1);
      return { name: field.name, index, value: field.value, checked: field.checked };
    });
    return { key: form.dataset.formKey, fields };
  });
  const restoreDrafts = (drafts, skipKey) => {
    for (const draft of drafts) {
      if (draft.key === skipKey) continue;
      const form = [...app.querySelectorAll('form[data-form-key]')].find((item) => item.dataset.formKey === draft.key);
      if (!form) continue;
      const desiredExitCount = draft.fields.filter((field) => field.name === 'exits').length;
      const exitList = form.querySelector('[data-exit-list]');
      if (exitList) {
        while (exitList.querySelectorAll('select[name="exits"]').length > desiredExitCount) exitList.lastElementChild?.remove();
        while (exitList.querySelectorAll('select[name="exits"]').length < desiredExitCount) {
          const row = document.createElement('div');
          row.className = 'exit-row';
          row.innerHTML = '<select name="exits"><option value="" selected>Не позначено</option><option value="toilet">Туалет</option><option value="phone">Телефон</option><option value="other">Інше</option></select><button type="button" class="text-button" data-remove-exit aria-label="Прибрати вихід">−</button>';
          exitList.append(row);
        }
      }
      for (const saved of draft.fields) {
        const field = [...form.elements].filter((item) => item.name === saved.name)[saved.index];
        if (!field) continue;
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = saved.checked;
        else field.value = saved.value;
      }
    }
  };
  const refresh = async (skipKey) => {
    const drafts = captureDrafts();
    const scrollY = window.scrollY;
    const anchor = [...app.querySelectorAll('[data-student-card]')].find((card) => card.getBoundingClientRect().bottom > 0);
    const anchorId = anchor?.dataset.studentCard;
    const anchorTop = anchor?.getBoundingClientRect().top;
    s.windowData = await repo.getLessonWindow(s.lesson.id, s.journal.id);
    render();
    restoreDrafts(drafts, skipKey);
    if (anchorId) {
      const nextAnchor = [...app.querySelectorAll('[data-student-card]')].find((card) => card.dataset.studentCard === anchorId);
      const nextTop = nextAnchor?.getBoundingClientRect().top;
      window.scrollTo(0, scrollY + (Number.isFinite(nextTop) && Number.isFinite(anchorTop) ? nextTop - anchorTop : 0));
    } else window.scrollTo(0, scrollY);
  };
  app.querySelectorAll('[data-record-form]').forEach((form) => {
    form.querySelector('[data-add-exit]').addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'exit-row';
      row.innerHTML = `<select name="exits"><option value="" selected>Не позначено</option><option value="toilet">Туалет</option><option value="phone">Телефон</option><option value="other">Інше</option></select><button type="button" class="text-button" data-remove-exit aria-label="Прибрати вихід">−</button>`;
      form.querySelector('[data-exit-list]').append(row);
    });
    form.querySelector('[data-exit-list]').addEventListener('click', (event) => {
      if (event.target.closest('[data-remove-exit]')) event.target.closest('.exit-row')?.remove();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const getBool = (name) => data.get(name) === '' ? null : data.get(name) === 'true';
      const student = d.students.find((item) => item.id === form.dataset.studentId);
      const values = {
        isAbsent: data.has('isAbsent'), homework: data.get('homework') || null,
        hasNotebook: getBool('hasNotebook'), hasTextbook: getBool('hasTextbook'),
        notTakingNotes: getBool('notTakingNotes'), boardRefused: data.has('boardRefused'),
        lateMinutes: data.get('lateMinutes') || null, behavior: data.getAll('behavior'),
        exits: data.getAll('exits').filter(Boolean), assessments: student.record?.assessments ?? []
      };
      const errorBox = form.querySelector('[data-error]');
      errorBox.hidden = true;
      try {
        await repo.saveLessonRecord(s.lesson.id, student.id, values, d.behaviorMarks);
        await refresh(form.dataset.formKey);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
    });
  });
  app.querySelectorAll('[data-assessment-form], [data-new-assessment]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const student = d.students.find((item) => item.id === form.dataset.studentId);
    const existing = form.dataset.assessmentId;
    const errorBox = form.closest('.assessment-editor').querySelector('[data-assessment-error]');
    errorBox.hidden = true;
    const values = {
      lessonId: s.lesson.id, studentId: student.id, value: data.get('value'), kind: data.get('kind'),
      boardRefused: Boolean(student.record?.boardRefused), isAbsent: Boolean(student.record?.isAbsent)
    };
    try {
      if (existing) await repo.updateAssessment({ ...values, assessmentId: existing });
      else await repo.createAssessment(values);
      await refresh(form.dataset.formKey);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  }));
  app.querySelectorAll('[data-delete-assessment]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Видалити цю оцінку?')) return;
    const errorBox = button.closest('.assessment-editor').querySelector('[data-assessment-error]');
    errorBox.hidden = true;
    try {
      await repo.deleteAssessment({
        lessonId: s.lesson.id, studentId: button.dataset.studentId, assessmentId: button.dataset.deleteAssessment
      });
      await refresh(`assessment:${button.dataset.studentId}:${button.dataset.deleteAssessment}`);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  }));
}
function render() {
  if (!s.user) return signIn();
  if (s.screen === 'home') return home();
  if (s.screen === 'journals') return journals();
  if (s.screen === 'subjects') return subjects();
  if (s.screen === 'lessons') return lessonDates();
  if (s.screen === 'lesson') return lessonWindow();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'journals') {
    s.nav = navigateTo(s.nav, 'journals');
    s.screen = 'journals';
    render();
  }
  if (b.dataset.action === 'home') {
    s.nav = createNavigationState('home');
    s.screen = 'home';
    render();
  }
  if (b.dataset.action === 'back') {
    s.nav = navigateBack(s.nav);
    s.screen = s.nav.current.screen;
    if (s.screen === 'lessons') {
      const item = s.nav.current.params;
      s.journal = s.journals.find((journal) => journal.id === item.journalId) ?? s.journal;
    }
    render();
  }
  if (b.dataset.action === 'lessons') {
    s.screen = 'lessons';
    render();
  }
  if (b.dataset.action === 'journal') {
    s.focusDate = s.lesson?.date ?? null;
    s.nav = navigateTo(s.nav, 'lessons', {
      classId: s.journal.classId,
      subjectId: s.journal.subjectId,
      journalId: s.journal.id,
      focusDate: s.focusDate
    });
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

async function restoreSavedSession() {
  if (typeof repo.restoreSession !== 'function') return;
  try {
    const user = await repo.restoreSession();
    if (!user) return;
    s.user = user;
    s.journals = await repo.getJournals();
    s.nav = createNavigationState('home');
    s.screen = 'home';
    render();
  } catch (error) {
    signIn(error.message);
  }
}

restoreSavedSession();

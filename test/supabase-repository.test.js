import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseJournalRepository } from '../src/data/supabase-repository.js';

test('maps journal, lesson, and v_lesson_window rows without replacing unknown assessment kinds', async () => {
  const calls = [];
  const client = {
    async signIn() { return { id: 'owner-1' }; },
    async restoreSession() { return null; },
    async signOut() {},
    async get(path, query) {
      calls.push({ path, query });
      if (path === 'journals') return [{
        id: 'journal-1', class_id: 'class-1', subject_id: 'subject-1',
        classes: { grade: 8, letter: 'А' }, subjects: { name: 'Алгебра' }
      }];
      if (path === 'students') return [{ class_id: 'class-1' }, { class_id: 'class-1' }];
      if (path === 'lessons') return [{ id: 'lesson-1', lesson_date: '2026-11-17', lesson_number: 2, topic: 'Рівняння' }];
      if (path === 'behavior_marks') return [{ code: 'active', label: 'Активна участь' }];
      if (path === 'v_lesson_window') return [{
        lesson_id: 'lesson-1', journal_id: 'journal-1', lesson_date: '2026-11-17',
        lesson_number: 2, topic: 'Рівняння', student_id: 'student-1',
        full_name: 'Учень 01', is_active: true, record_id: 'record-1',
        is_absent: false, homework: 'done', has_notebook: true, has_textbook: false,
        not_taking_notes: false, board_refused: false, late_minutes: 4,
        behavior_codes: ['active'], exit_reasons: ['toilet'],
        assessments: [{ id: 'assessment-1', value: 9, kind: 'future_kind' }]
      }];
      throw new Error('Unexpected endpoint in test');
    }
  };
  const repository = new SupabaseJournalRepository({}, client);
  assert.deepEqual(await repository.getJournals(), [{
    id: 'journal-1', classId: 'class-1', subjectId: 'subject-1',
    subject: 'Алгебра', className: '8-А', studentsCount: 2
  }]);
  assert.deepEqual(await repository.getLessons('journal-1'), [{
    id: 'lesson-1', date: '2026-11-17', number: 2, topic: 'Рівняння'
  }]);
  const windowData = await repository.getLessonWindow('lesson-1', 'journal-1');
  assert.equal(windowData.students[0].id, 'student-1');
  assert.equal(windowData.students[0].fullName, 'Учень 01');
  assert.deepEqual(windowData.students[0].record, {
    id: 'record-1', isAbsent: false, homework: 'done', hasNotebook: true,
    hasTextbook: false, notTakingNotes: false, boardRefused: false, lateMinutes: 4,
    behavior: ['active'], exits: [{ reason: 'toilet' }],
    assessments: [{ id: 'assessment-1', value: 9, kind: 'future_kind' }]
  });
  assert.deepEqual(windowData.behaviorMarks, [{ id: 'active', label: 'Активна участь' }]);
  assert.equal(calls.find((call) => call.path === 'lessons').query.order, 'lesson_date.desc,lesson_number.desc');
  assert.equal(calls.find((call) => call.path === 'v_lesson_window').query.lesson_id, 'eq.lesson-1');
});

test('creates a lesson through the protected lessons endpoint and explains duplicates', async () => {
  const requests = [];
  const repository = new SupabaseJournalRepository({}, {
    async insert(path, body) {
      requests.push({ path, body });
      if (requests.length === 1) return [{ id: 'lesson-2', ...body }];
      const error = new Error('generic database request failure');
      error.code = '23505';
      throw error;
    }
  });
  assert.deepEqual(await repository.createLesson('journal-1', {
    date: '2026-11-22', number: '3', topic: '  Нова тема  '
  }), { id: 'lesson-2', date: '2026-11-22', number: 3, topic: 'Нова тема' });
  assert.deepEqual(requests[0], {
    path: 'lessons',
    body: { journal_id: 'journal-1', lesson_date: '2026-11-22', lesson_number: 3, topic: 'Нова тема' }
  });
  await assert.rejects(repository.createLesson('journal-1', {
    date: '2026-11-22', number: 3, topic: 'Дубль'
  }), /Урок із таким номером на цю дату вже існує/);
  await assert.rejects(repository.createLesson('journal-1', {
    date: '2026-11-22', number: 11, topic: 'Неприпустимий номер'
  }), /номер уроку від 1 до 10/);
});

test('saves lesson marks through named RPC arguments and manages assessments directly', async () => {
  const calls = [];
  const repository = new SupabaseJournalRepository({}, {
    async rpc(name, params) { calls.push({ method: 'rpc', name, params }); return { id: 'record-1' }; },
    async insert(path, body) { calls.push({ method: 'insert', path, body }); return [{ id: 'assessment-1', ...body }]; },
    async patch(path, query, body) { calls.push({ method: 'patch', path, query, body }); return [{ id: 'assessment-1' }]; },
    async delete(path, query) { calls.push({ method: 'delete', path, query }); return null; }
  });
  await repository.saveLessonRecord('lesson-1', 'student-1', {
    isAbsent: false, homework: 'partial', hasNotebook: true, hasTextbook: false,
    notTakingNotes: false, boardRefused: false, lateMinutes: 7,
    behavior: ['talks'], exits: ['toilet'], assessments: []
  }, [{ id: 'talks', uuid: 'behavior-uuid', label: 'Розмовляє' }]);
  assert.deepEqual(calls[0], { method: 'rpc', name: 'save_lesson_record', params: {
    p_lesson_id: 'lesson-1', p_student_id: 'student-1', p_is_absent: false,
    p_homework: 'partial', p_has_notebook: true, p_has_textbook: false,
    p_not_taking_notes: false, p_board_refused: false, p_late_minutes: 7,
    p_behavior_mark_ids: ['behavior-uuid'], p_exit_reasons: ['toilet']
  } });
  await repository.createAssessment({ lessonId: 'lesson-1', studentId: 'student-1', value: 8, kind: 'independent' });
  await repository.updateAssessment({ lessonId: 'lesson-1', studentId: 'student-1', assessmentId: 'assessment-1', value: 9, kind: 'control' });
  await repository.deleteAssessment({ lessonId: 'lesson-1', studentId: 'student-1', assessmentId: 'assessment-1' });
  assert.deepEqual(calls.slice(1).map((call) => call.method), ['insert', 'patch', 'delete']);
  assert.equal(calls[1].path, 'assessments');
  assert.equal(calls[1].body.kind, 'independent');
  assert.deepEqual(calls[2].body, { value: 9, kind: 'control' });
  await assert.rejects(repository.saveLessonRecord('lesson-1', 'student-1', {
    isAbsent: false, boardRefused: true, assessments: [{ kind: 'board' }]
  }), /Спочатку видаліть оцінку за дошку/);
});

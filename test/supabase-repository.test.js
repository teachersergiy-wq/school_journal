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

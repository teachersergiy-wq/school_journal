import test from 'node:test';
import assert from 'node:assert/strict';
import { MockJournalRepository } from '../src/data.js';
import { SupabaseJournalRepository } from '../src/data/supabase-repository.js';
import { createSupabaseClient, SESSION_STORAGE_KEY } from '../src/data/supabase-client.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

async function exerciseAssessmentContract(repository, lessonId, studentId) {
  await repository.saveLessonRecord(lessonId, studentId, {
    isAbsent: false, homework: 'done', hasNotebook: true, hasTextbook: true,
    notTakingNotes: false, boardRefused: false, lateMinutes: null,
    behavior: [], exits: ['toilet', 'toilet'], assessments: []
  }, []);
  const created = await repository.createAssessment({
    lessonId, studentId, value: 9,
    kind: 'current', boardRefused: false, isAbsent: false
  });
  await repository.updateAssessment({
    lessonId, studentId, assessmentId: created.id,
    value: 11, kind: 'control', boardRefused: false, isAbsent: false
  });
  await repository.deleteAssessment({
    lessonId, studentId, assessmentId: created.id
  });
  await assert.rejects(repository.saveLessonRecord(lessonId, studentId, {
    isAbsent: true, assessments: [created]
  }), /Спочатку видаліть оцінки/);
  await assert.rejects(repository.createAssessment({
    lessonId, studentId, value: 7, kind: 'current', isAbsent: true
  }), /спочатку зніміть позначку «н»/);
  return created;
}

test('the same save/create/update/delete repository contract works for mock and Supabase with fetch mock', async () => {
  const mock = new MockJournalRepository();
  const mockCreated = await exerciseAssessmentContract(mock, 'alg-11', 'student-09');
  assert.equal(mockCreated.kind, 'current');
  const mockWindow = await mock.getLessonWindow('alg-11', 'algebra-8a');
  const mockRecord = mockWindow.students.find((student) => student.id === 'student-09').record;
  assert.deepEqual(mockRecord.assessments, []);
  assert.deepEqual(mockRecord.exits, ['toilet', 'toilet']);

  const storage = new MemoryStorage();
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'fetch-mock-access', refresh_token: 'fetch-mock-refresh', expires_at: 5000
  }));
  const calls = [];
  let assessment = null;
  const client = createSupabaseClient({
    url: 'https://example.supabase.co', anonKey: 'public-key', storage,
    now: () => 1_000_000, setTimeoutImpl: () => 1, clearTimeoutImpl: () => {},
    fetchImpl: async (url, options) => {
      const endpoint = new URL(url);
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ method: options.method, path: endpoint.pathname, query: endpoint.searchParams, body });
      if (endpoint.pathname === '/rest/v1/rpc/save_lesson_record') {
        return new Response(JSON.stringify({ id: 'record-contract' }), { status: 200 });
      }
      if (endpoint.pathname === '/rest/v1/assessments' && options.method === 'POST') {
        assessment = { id: 'assessment-contract', ...body };
        return new Response(JSON.stringify([assessment]), { status: 201 });
      }
      if (endpoint.pathname === '/rest/v1/assessments' && options.method === 'PATCH') {
        assert.equal(endpoint.searchParams.get('id'), 'eq.assessment-contract');
        assert.equal(endpoint.searchParams.get('lesson_id'), 'eq.lesson-contract');
        assert.equal(endpoint.searchParams.get('student_id'), 'eq.student-contract');
        assessment = { ...assessment, ...body };
        return new Response(JSON.stringify([assessment]), { status: 200 });
      }
      if (endpoint.pathname === '/rest/v1/assessments' && options.method === 'DELETE') {
        assert.equal(endpoint.searchParams.get('id'), 'eq.assessment-contract');
        assert.equal(endpoint.searchParams.get('lesson_id'), 'eq.lesson-contract');
        assert.equal(endpoint.searchParams.get('student_id'), 'eq.student-contract');
        assessment = null;
        return new Response(null, { status: 204 });
      }
      throw new Error('Unexpected fetch-mock request');
    }
  });
  const supabase = new SupabaseJournalRepository({ url: 'https://example.supabase.co', anonKey: 'public-key' }, client);
  const created = await exerciseAssessmentContract(supabase, 'lesson-contract', 'student-contract');
  assert.equal(created.id, 'assessment-contract');
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'POST', 'PATCH', 'DELETE']);
  assert.deepEqual(calls[0].body.p_exit_reasons, ['toilet', 'toilet']);
  assert.equal(assessment, null);
});

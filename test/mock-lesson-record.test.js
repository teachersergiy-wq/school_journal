import test from 'node:test';
import assert from 'node:assert/strict';
import { MockJournalRepository } from '../src/data.js';

test('mock lesson window marks and assessments persist through repository reloads', async () => {
  const repository = new MockJournalRepository();
  const values = {
    isAbsent: false, homework: 'done', hasNotebook: true, hasTextbook: false,
    notTakingNotes: true, boardRefused: false, lateMinutes: 3,
    behavior: ['talks', 'active'], exits: ['phone'], assessments: []
  };
  await repository.saveLessonRecord('alg-11', 'student-01', values);
  const saved = await repository.getLessonWindow('alg-11', 'algebra-8a');
  assert.deepEqual(saved.students[0].record, { ...values, assessments: [] });

  const assessment = await repository.createAssessment({ lessonId: 'alg-11', studentId: 'student-01', value: 12, kind: 'control' });
  await repository.updateAssessment({ lessonId: 'alg-11', studentId: 'student-01', assessmentId: assessment.id, value: 10, kind: 'independent' });
  const reloaded = await repository.getLessonWindow('alg-11', 'algebra-8a');
  assert.deepEqual(reloaded.students[0].record.assessments, [{ id: assessment.id, value: 10, kind: 'independent' }]);
  await repository.deleteAssessment({ lessonId: 'alg-11', studentId: 'student-01', assessmentId: assessment.id });
  assert.deepEqual((await repository.getLessonWindow('alg-11', 'algebra-8a')).students[0].record.assessments, []);
});

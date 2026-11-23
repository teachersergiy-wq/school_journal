import test from 'node:test';
import assert from 'node:assert/strict';
import { MockJournalRepository } from '../src/data.js';

test('mock lesson creation is visible immediately and rejects duplicate journal/date/number', async () => {
  const repository = new MockJournalRepository();
  const journalId = 'geometry-8a';
  const created = await repository.createLesson(journalId, {
    date: '2026-11-22', number: 3, topic: 'Нова тема'
  });
  const lessons = await repository.getLessons(journalId);
  assert.deepEqual(lessons[0], created);
  await assert.rejects(repository.createLesson(journalId, {
    date: '2026-11-22', number: '3', topic: 'Інша тема'
  }), /Урок із таким номером на цю дату вже існує/);
});

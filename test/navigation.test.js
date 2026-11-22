import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNavigationState,
  journalsForClass,
  journalsForPair,
  navigateBack,
  navigateTo
} from '../src/navigation.js';

test('navigation follows home, classes, subjects, and the selected journal without losing the pair', () => {
  let state = createNavigationState();
  state = navigateTo(state, 'classes');
  state = navigateTo(state, 'subjects', { classId: 'class-8a' });
  state = navigateTo(state, 'lessons', {
    classId: 'class-8a',
    subjectId: 'algebra',
    journalId: 'journal-algebra-8a'
  });

  assert.equal(state.current.screen, 'lessons');
  assert.deepEqual(state.current.params, {
    classId: 'class-8a',
    subjectId: 'algebra',
    journalId: 'journal-algebra-8a'
  });
  assert.equal(navigateBack(state).current.screen, 'subjects');
  assert.equal(navigateBack(navigateBack(state)).current.screen, 'classes');
  assert.equal(navigateBack(navigateBack(navigateBack(state))).current.screen, 'home');
});

test('home reset is available from every route and clears its back stack', () => {
  const state = navigateTo(
    navigateTo(createNavigationState(), 'classes'),
    'subjects',
    { classId: 'class-8a' }
  );
  const home = createNavigationState();
  assert.equal(home.current.screen, 'home');
  assert.deepEqual(home.history, []);
  assert.equal(navigateBack(home).current.screen, 'home');
  assert.equal(state.current.screen, 'subjects');
});

test('class and subject selection resolves the matching journal, not a different class or subject', () => {
  const journals = [
    { id: 'algebra-8a', classId: 'class-8a', subjectId: 'algebra' },
    { id: 'geometry-8a', classId: 'class-8a', subjectId: 'geometry' },
    { id: 'algebra-8b', classId: 'class-8b', subjectId: 'algebra' }
  ];
  assert.deepEqual(journalsForClass(journals, 'class-8a').map((journal) => journal.id), [
    'algebra-8a', 'geometry-8a'
  ]);
  assert.deepEqual(journalsForPair(journals, 'class-8a', 'algebra').map((journal) => journal.id), [
    'algebra-8a'
  ]);
  assert.deepEqual(journalsForPair(journals, 'class-8b', 'geometry'), []);
});

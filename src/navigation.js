export function createNavigationState(screen = 'home', params = {}) {
  return {
    current: { screen, params: { ...params } },
    history: []
  };
}

export function navigateTo(state, screen, params = {}) {
  return {
    current: { screen, params: { ...params } },
    history: [...state.history, { screen: state.current.screen, params: { ...state.current.params } }]
  };
}

export function navigateBack(state) {
  if (state.history.length === 0) return createNavigationState();
  return {
    current: state.history[state.history.length - 1],
    history: state.history.slice(0, -1)
  };
}

export function journalsForClass(journals, classId) {
  return journals.filter((journal) => String(journal.classId) === String(classId));
}

export function journalsForPair(journals, classId, subjectId) {
  return journalsForClass(journals, classId)
    .filter((journal) => String(journal.subjectId) === String(subjectId));
}

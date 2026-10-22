export const appState = {
  activeTab: 'home',
  activeLanguage: 'all',
  activeLevel: 'all',
  selectedStoryId: null,
  vocabulary: [],
  savedWords: [],
  reviewQueue: [],
  ui: {
    readerOpen: false,
    settingsOpen: false,
    toastVisible: false
  }
};

export function createInitialState() {
  return {
    ...appState,
    vocabulary: [],
    savedWords: [],
    reviewQueue: []
  };
}

export function setState(patch) {
  Object.assign(appState, patch);
  return appState;
}

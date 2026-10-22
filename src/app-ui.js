export function renderHomeShell(state, appConfig) {
  return {
    title: appConfig.appName,
    activeTab: state.activeTab,
    language: state.activeLanguage,
    level: state.activeLevel
  };
}

export function renderStoryCard(story) {
  return {
    id: story.id,
    title: story.title,
    language: story.language,
    level: story.level,
    cover: story.cover,
    duration: story.duration
  };
}

export function renderVocabularyCard(word) {
  return {
    id: word.id,
    word: word.word,
    translation: word.translation,
    example: word.example
  };
}

export function showToast(message) {
  if (typeof window === 'undefined') return;

  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 1800);
}

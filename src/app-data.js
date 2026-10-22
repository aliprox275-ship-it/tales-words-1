export const appConfig = {
  appName: 'Tales & Words',
  defaultLanguage: 'all',
  defaultLevel: 'all',
  version: 'v6',
  locales: ['en', 'de'],
  supportedLevels: ['A1', 'A2'],
  repository: 'aliprox275-ship-it/tales-words-1'
};

export const stories = [
  {
    id: 'story-intro-en',
    language: 'en',
    level: 'A1',
    title: 'The Morning Walk',
    topic: 'intro',
    duration: 6,
    done: false,
    cover: 'assets/img/cover-en-intro-1.webp'
  },
  {
    id: 'story-intro-de',
    language: 'de',
    level: 'A1',
    title: 'Der Morgenlauf',
    topic: 'intro',
    duration: 6,
    done: false,
    cover: 'assets/img/cover-de-intro-1.webp'
  }
];

export const vocabularyBank = [
  {
    id: 'word-1',
    language: 'en',
    word: 'morning',
    translation: 'صباح',
    example: 'The morning is calm and fresh.',
    topic: 'intro'
  },
  {
    id: 'word-2',
    language: 'de',
    word: 'Morgen',
    translation: 'صباح',
    example: 'Der Morgen ist ruhig und frisch.',
    topic: 'intro'
  }
];

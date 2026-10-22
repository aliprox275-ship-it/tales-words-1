/*
  Modernization starter for the app shell.
  This file is intentionally small and framework-free so it can be adopted
  gradually without disrupting the current static PWA architecture.
*/

import { appConfig, stories, vocabularyBank } from './app-data.js';
import { createInitialState, setState } from './app-state.js';
import { renderHomeShell, renderStoryCard, showToast } from './app-ui.js';

const state = createInitialState();

function bootstrap() {
  setState({
    vocabulary: vocabularyBank,
    reviewQueue: stories,
    activeTab: 'home'
  });

  const view = renderHomeShell(state, appConfig);
  console.info('Tales & Words bootstrapped:', view);
  showToast('تم تجهيز التطبيق في الوضع الحديث');
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', bootstrap);
}

export { appConfig, stories, vocabularyBank, state };

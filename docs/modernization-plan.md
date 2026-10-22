# Modernization plan for Tales & Words

## Phase 1 — stabilize and modularize
- Keep the current static PWA architecture intact.
- Add small modular JavaScript units for state, data, and UI helpers.
- Keep the legacy HTML working while the modern shell is introduced.

## Phase 2 — split the dominant app responsibilities
- Create separate modules for:
  - data definitions
  - app state
  - rendering helpers
  - event wiring
  - persistence helpers

## Phase 3 — extract shared styles
- Move reusable shell styles to `src/styles.css`.
- Keep story view and reader styles in the main document until migration is safe.

## Phase 4 — production-grade cleanup
- Remove duplicate manifest and placeholder files.
- Audit image duplication and simplify the asset map.
- Review offline cache and PWA install metadata.

## Phase 5 — release hardening
- Add smoke checks before deployment.
- Verify SW version bumps for all deploys.
- Test offline mode and installability on mobile.

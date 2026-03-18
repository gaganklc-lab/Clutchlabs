# Surge E2E Test Run Results

**Date:** 2026-03-18
**Suite:** e2e/surge.spec.ts
**Browser:** Firefox (Playwright)
**App:** Surge variant (APP_VARIANT=surge, port 8081)

## Results

| Test | Status | Duration |
|------|--------|----------|
| T1: Surge home screen renders key UI controls | ✓ PASS | 9.5s |
| T2: Surge gameplay leads to results screen with XP and rank | ✓ PASS | 34.7s |
| T3: Surge paywall opens from PRO button and settings modal | ✓ PASS | 9.7s |
| T4: Results screen navigation buttons work correctly | ✓ PASS | 52.4s |

**Total: 4 passed, 0 failed**

## Test Coverage

- T1: Home screen UI (play button, PRO pill, theme/leaderboard/settings buttons, settings modal, Upgrade to Pro row)
- T2: Full gameplay flow (countdown → rapid-miss life drain → optional revive skip → results screen with score/XP/rank/buttons)
- T3: Paywall flow from PRO button + Subscribe → TestConfirmModal (Cancel), plus paywall from Settings → Upgrade to Pro
- T4: Results navigation — Play Again sends back to game, Home returns to home screen

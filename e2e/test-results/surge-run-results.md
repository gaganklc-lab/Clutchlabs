# Surge E2E Test Run Results

**Date:** 2026-03-18
**Suite:** e2e/surge.spec.ts
**Browser:** Firefox (Playwright v1.58)
**App:** Surge variant (APP_VARIANT=surge, port 8081)

## Results

| Test | Status | Duration | Coverage |
|------|--------|----------|----------|
| T1: Surge home screen renders key UI controls and modals | ✓ PASS | 11.7s | Home controls, settings modal (sound/haptics toggles, upgrade-to-pro row), customize modal (Ring Themes), leaderboard navigation |
| T2: Surge gameplay: countdown → play → results with score/XP/rank | ✓ PASS | 30.4s | Countdown overlay (3/2/1/GO!), game score block, life drain via misses, results rank card (letter+label), XP badge, action buttons |
| T3: Surge paywall shows features/pricing and opens from PRO button and settings | ✓ PASS | 10.0s | Paywall title, feature list (Double XP, Ad-Free, Pro Ring Themes), pricing text, Subscribe → TestConfirmModal (Cancel/Confirm), settings upgrade row entry |
| T4: Results screen navigation buttons work correctly | ✓ PASS | 52.7s | Play Again → game (countdown visible), Home → home screen (play button visible) |

**Total: 4 passed, 0 failed**

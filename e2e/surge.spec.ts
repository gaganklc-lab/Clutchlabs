/**
 * Surge E2E tests — verifies gameplay, results, and Pro monetization flows.
 *
 * React Native Web renders `testID` props as `data-testid` attributes,
 * so we use `locator('[data-testid="..."]')` throughout.
 *
 * Run with:  npm run test:e2e
 * Prereq:    Expo dev server must be running on http://localhost:8081
 *            APP_VARIANT=surge must be set (configured in .replit)
 */

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:8081";
const WAIT_MS = 3_000;

async function loadApp(page: Page) {
  await page.goto(BASE);
  await page.waitForTimeout(WAIT_MS);
}

/** Start a game and drain lives fast by clicking at the wrong timing repeatedly */
async function drainLivesAndGetToResults(page: Page) {
  const playBtn = page.locator('[data-testid="play-button"]').first();
  await expect(playBtn).toBeVisible({ timeout: 10_000 });
  await playBtn.click();

  // Wait through countdown (~4s for 3→2→1→GO!)
  await page.waitForTimeout(4_500);

  // Rapid clicks in top-left corner at wrong timing → generates EARLY misses
  for (let i = 0; i < 60; i++) {
    await page.mouse.click(20, 20);
    await page.waitForTimeout(200);
  }

  // Skip revive prompt if it appears (only shows when score > 0)
  const reviveSkip = page.locator('[data-testid="surge-revive-skip"]');
  try {
    await expect(reviveSkip).toBeVisible({ timeout: 3_000 });
    await reviveSkip.click();
  } catch {
    // No revive prompt (score was 0) — proceed directly to results
  }

  const resultsButtons = page.locator('[data-testid="surge-results-buttons"]');
  await expect(resultsButtons).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Test 1 — Home screen: all top-bar controls render, modals open correctly
// ---------------------------------------------------------------------------
test("T1: Surge home screen renders key UI controls and modals", async ({ page }) => {
  await loadApp(page);

  // Play button is present
  const playBtn = page.locator('[data-testid="play-button"]').first();
  await expect(playBtn).toBeVisible({ timeout: 10_000 });

  // Top-bar controls (non-Pro user)
  const proBtn = page.locator('[data-testid="surge-pro-button"]');
  await expect(proBtn).toBeVisible();

  const themeBtn = page.locator('[data-testid="surge-theme-button"]');
  await expect(themeBtn).toBeVisible();

  const leaderboardBtn = page.locator('[data-testid="surge-leaderboard-button"]');
  await expect(leaderboardBtn).toBeVisible();

  const settingsBtn = page.locator('[data-testid="surge-settings-button"]');
  await expect(settingsBtn).toBeVisible();

  // --- Settings modal ---
  await settingsBtn.click();
  await page.waitForTimeout(500);

  // Sound Effects row + toggle
  const soundRow = page.locator('[data-testid="surge-settings-sound-row"]');
  await expect(soundRow).toBeVisible({ timeout: 5_000 });
  await expect(soundRow).toContainText("Sound Effects");

  const soundToggle = page.locator('[data-testid="surge-settings-sound-toggle"]');
  await expect(soundToggle).toBeVisible();

  // Haptic Feedback row + toggle
  const hapticsRow = page.locator('[data-testid="surge-settings-haptics-row"]');
  await expect(hapticsRow).toBeVisible();
  await expect(hapticsRow).toContainText("Haptic Feedback");

  const hapticsToggle = page.locator('[data-testid="surge-settings-haptics-toggle"]');
  await expect(hapticsToggle).toBeVisible();

  // Upgrade to Pro row (non-subscribed user)
  const upgradeRow = page.locator('[data-testid="surge-settings-upgrade-pro"]');
  await expect(upgradeRow).toBeVisible();
  await expect(upgradeRow).toContainText("Upgrade to Pro");

  // Close settings
  const settingsClose = page.locator('[data-testid="surge-settings-close"]');
  await expect(settingsClose).toBeVisible();
  await settingsClose.click();
  await page.waitForTimeout(400);

  // --- Customize / Ring Themes modal ---
  await themeBtn.click();
  await page.waitForTimeout(500);

  const customizeTitle = page.locator('[data-testid="surge-customize-title"]');
  await expect(customizeTitle).toBeVisible({ timeout: 5_000 });
  await expect(customizeTitle).toContainText("Ring Themes");

  const customizeList = page.locator('[data-testid="surge-customize-list"]');
  await expect(customizeList).toBeVisible();

  const customizeClose = page.locator('[data-testid="surge-customize-close"]');
  await expect(customizeClose).toBeVisible();
  await customizeClose.click();
  await page.waitForTimeout(400);

  // --- Leaderboard navigation ---
  await leaderboardBtn.click();
  await page.waitForTimeout(1_000);
  // After navigation, should no longer be on home (play-button hidden or different URL)
  await page.goBack();
  await page.waitForTimeout(800);
  // Play button should be visible again on home
  await expect(playBtn).toBeVisible({ timeout: 6_000 });
});

// ---------------------------------------------------------------------------
// Test 2 — Gameplay: countdown sequence, game play, results with XP and rank
// ---------------------------------------------------------------------------
test("T2: Surge gameplay: countdown → play → results screen with score/XP/rank", async ({ page }) => {
  await loadApp(page);

  const playBtn = page.locator('[data-testid="play-button"]').first();
  await expect(playBtn).toBeVisible({ timeout: 10_000 });
  await playBtn.click();

  // Countdown overlay appears with numeric value (3, 2, or 1)
  const countdownOverlay = page.locator('[data-testid="surge-countdown-overlay"]');
  await expect(countdownOverlay).toBeVisible({ timeout: 5_000 });

  const countdownText = page.locator('[data-testid="surge-countdown-text"]');
  await expect(countdownText).toBeVisible();
  // Countdown shows a number (3, 2, 1) or GO!
  const cdValue = await countdownText.textContent();
  expect(["3", "2", "1", "GO!"].includes(cdValue?.trim() ?? "")).toBeTruthy();

  // Wait for countdown to finish and game to start
  await page.waitForTimeout(4_500);

  // Game score block is visible (game is playing)
  const scoreBlock = page.locator('[data-testid="surge-game-score-block"]');
  await expect(scoreBlock).toBeVisible({ timeout: 5_000 });

  // Drain lives to end game quickly
  for (let i = 0; i < 60; i++) {
    await page.mouse.click(20, 20);
    await page.waitForTimeout(200);
  }

  // Skip revive if shown
  const reviveSkip = page.locator('[data-testid="surge-revive-skip"]');
  try {
    await expect(reviveSkip).toBeVisible({ timeout: 3_000 });
    await reviveSkip.click();
  } catch { /* no revive */ }

  // --- Results screen ---
  const resultsButtons = page.locator('[data-testid="surge-results-buttons"]');
  await expect(resultsButtons).toBeVisible({ timeout: 30_000 });

  // Score section
  const scoreSection = page.locator('[data-testid="surge-results-score-section"]');
  await expect(scoreSection).toBeVisible();
  await expect(scoreSection).toContainText("SCORE");

  // Rank card with letter and label
  const rankCard = page.locator('[data-testid="surge-results-rank-card"]');
  await expect(rankCard).toBeVisible();

  const rankLetter = page.locator('[data-testid="surge-results-rank-letter"]');
  await expect(rankLetter).toBeVisible();
  const letter = await rankLetter.textContent();
  expect(["S", "A", "B", "C", "D"].includes(letter?.trim() ?? "")).toBeTruthy();

  const rankLabel = page.locator('[data-testid="surge-results-rank-label"]');
  await expect(rankLabel).toBeVisible();
  const label = await rankLabel.textContent();
  expect(label?.trim().length).toBeGreaterThan(0);

  // XP badge (always shown — at least 15 XP base)
  const xpBadge = page.locator('[data-testid="surge-results-xp-badge"]');
  await expect(xpBadge).toBeVisible();

  const xpText = page.locator('[data-testid="surge-results-xp-text"]');
  await expect(xpText).toBeVisible();
  await expect(xpText).toContainText("XP");

  // Action buttons present
  const playAgain = page.locator('[data-testid="surge-results-play-again"]');
  await expect(playAgain).toBeVisible();
  await expect(playAgain).toContainText("PLAY AGAIN");

  const homeBtn = page.locator('[data-testid="surge-results-home"]');
  await expect(homeBtn).toBeVisible();

  const scoresBtn = page.locator('[data-testid="surge-results-scores"]');
  await expect(scoresBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3 — Paywall: feature list, pricing, Subscribe → TestConfirmModal, Settings entry
// ---------------------------------------------------------------------------
test("T3: Surge paywall shows features/pricing and opens from PRO button and settings", async ({ page }) => {
  await loadApp(page);

  // Open paywall via PRO button
  const proBtn = page.locator('[data-testid="surge-pro-button"]');
  await expect(proBtn).toBeVisible({ timeout: 10_000 });
  await proBtn.click();
  await page.waitForTimeout(600);

  // Paywall title
  const paywallTitle = page.locator('[data-testid="surge-paywall-title"]');
  await expect(paywallTitle).toBeVisible({ timeout: 5_000 });
  await expect(paywallTitle).toContainText("SURGE PRO");

  // Feature list is present
  const featureList = page.locator('[data-testid="surge-paywall-features"]');
  await expect(featureList).toBeVisible();

  // Double XP feature
  const doubleXpFeature = page.locator('[data-testid="surge-paywall-feature-double-xp"]');
  await expect(doubleXpFeature).toBeVisible();
  await expect(doubleXpFeature).toContainText("Double XP");

  // Ad-Free feature
  const adFreeFeature = page.locator('[data-testid="surge-paywall-feature-ad-free"]');
  await expect(adFreeFeature).toBeVisible();
  await expect(adFreeFeature).toContainText("Ad-Free");

  // Pro Ring Themes feature
  const themesFeature = page.locator('[data-testid="surge-paywall-feature-pro-ring-themes"]');
  await expect(themesFeature).toBeVisible();
  await expect(themesFeature).toContainText("Pro Ring Themes");

  // Price block shows a price
  const priceBlock = page.locator('[data-testid="surge-paywall-price-block"]');
  await expect(priceBlock).toBeVisible();

  const priceText = page.locator('[data-testid="surge-paywall-price-text"]');
  await expect(priceText).toBeVisible();
  const price = await priceText.textContent();
  expect(price?.trim().length).toBeGreaterThan(0); // e.g. "$4.99"

  // Subscribe button
  const subscribeBtn = page.locator('[data-testid="surge-paywall-subscribe"]');
  await expect(subscribeBtn).toBeVisible();
  await expect(subscribeBtn).toContainText("Subscribe");

  // Restore Purchases button
  const restoreBtn = page.locator('[data-testid="surge-paywall-restore"]');
  await expect(restoreBtn).toBeVisible();
  await expect(restoreBtn).toContainText("Restore");

  // Tap Subscribe → TestConfirmModal appears (dev/test env)
  await subscribeBtn.click();
  await page.waitForTimeout(600);

  const confirmModal = page.locator('[data-testid="surge-test-confirm-modal"]');
  await expect(confirmModal).toBeVisible({ timeout: 5_000 });

  const confirmTitle = page.locator('[data-testid="surge-test-confirm-title"]');
  await expect(confirmTitle).toContainText("Test Purchase");

  const cancelBtn = page.locator('[data-testid="surge-test-confirm-cancel"]');
  const confirmBtn = page.locator('[data-testid="surge-test-confirm-confirm"]');
  await expect(cancelBtn).toBeVisible();
  await expect(confirmBtn).toBeVisible();

  // Cancel — paywall should still be visible
  await cancelBtn.click();
  await page.waitForTimeout(400);
  await expect(paywallTitle).toBeVisible();

  // Close paywall via X button
  const closeBtn = page.locator('[data-testid="surge-paywall-close"]');
  await expect(closeBtn).toBeVisible({ timeout: 3_000 });
  await closeBtn.click();
  await page.waitForTimeout(500);
  await expect(paywallTitle).not.toBeVisible({ timeout: 3_000 });

  // --- Open paywall from Settings → Upgrade to Pro ---
  const settingsBtn = page.locator('[data-testid="surge-settings-button"]');
  await settingsBtn.click();
  await page.waitForTimeout(500);

  const upgradeRow = page.locator('[data-testid="surge-settings-upgrade-pro"]');
  await expect(upgradeRow).toBeVisible({ timeout: 5_000 });
  await upgradeRow.click();
  await page.waitForTimeout(800);

  // Paywall reopens
  const paywallTitle2 = page.locator('[data-testid="surge-paywall-title"]');
  await expect(paywallTitle2).toBeVisible({ timeout: 5_000 });
  await expect(paywallTitle2).toContainText("SURGE PRO");

  // Close
  const closeBtn2 = page.locator('[data-testid="surge-paywall-close"]');
  await closeBtn2.click();
  await page.waitForTimeout(400);
});

// ---------------------------------------------------------------------------
// Test 4 — Results navigation: Play Again → game, Home → home screen
// ---------------------------------------------------------------------------
test("T4: Results screen navigation buttons work correctly", async ({ page }) => {
  await loadApp(page);

  await drainLivesAndGetToResults(page);

  const resultsButtons = page.locator('[data-testid="surge-results-buttons"]');

  // All 3 navigation buttons present
  const homeBtn = page.locator('[data-testid="surge-results-home"]');
  const playAgainBtn = page.locator('[data-testid="surge-results-play-again"]');
  const scoresBtn = page.locator('[data-testid="surge-results-scores"]');
  await expect(homeBtn).toBeVisible();
  await expect(playAgainBtn).toBeVisible();
  await expect(scoresBtn).toBeVisible();

  // "Play Again" navigates back to game — results disappear, countdown appears
  await playAgainBtn.click();
  await page.waitForTimeout(2_000);
  await expect(resultsButtons).not.toBeVisible({ timeout: 6_000 });

  // Countdown starts for new game
  const countdownOverlay = page.locator('[data-testid="surge-countdown-overlay"]');
  await expect(countdownOverlay).toBeVisible({ timeout: 6_000 });

  // Drain lives again to reach results
  await page.waitForTimeout(4_500);
  for (let i = 0; i < 40; i++) {
    await page.mouse.click(20, 20);
    await page.waitForTimeout(200);
  }
  const reviveSkip2 = page.locator('[data-testid="surge-revive-skip"]');
  try {
    await expect(reviveSkip2).toBeVisible({ timeout: 3_000 });
    await reviveSkip2.click();
  } catch { /* no revive */ }

  const resultsButtons2 = page.locator('[data-testid="surge-results-buttons"]');
  await expect(resultsButtons2).toBeVisible({ timeout: 30_000 });

  // "Home" returns to Surge home (results buttons disappear)
  const homeBtn2 = page.locator('[data-testid="surge-results-home"]');
  await homeBtn2.click();
  await page.waitForTimeout(2_000);
  await expect(resultsButtons2).not.toBeVisible({ timeout: 5_000 });

  // Play button visible on home screen
  const playBtnHome = page.locator('[data-testid="play-button"]:visible').first();
  await expect(playBtnHome).toBeVisible({ timeout: 8_000 });
});

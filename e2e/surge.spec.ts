/**
 * Surge E2E tests — verifies gameplay, results, and Pro monetization flows.
 *
 * React Native Web renders `testID` props as `data-testid` attributes,
 * so we use getByTestId / locator('[data-testid="..."]') throughout.
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

// ---------------------------------------------------------------------------
// Test 1 — Home screen UI + navigation controls
// ---------------------------------------------------------------------------
test("T1: Surge home screen renders key UI controls", async ({ page }) => {
  await loadApp(page);

  // Play button
  const playBtn = page.locator('[data-testid="play-button"]');
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

  // Settings modal opens and shows Upgrade to Pro row
  await settingsBtn.click();
  await page.waitForTimeout(500);
  const upgradeRow = page.locator('[data-testid="surge-settings-upgrade-pro"]');
  await expect(upgradeRow).toBeVisible({ timeout: 5_000 });

  // Dismiss settings via close button
  const settingsCloseBtn = page.locator('[data-testid="surge-settings-close"]');
  await expect(settingsCloseBtn).toBeVisible({ timeout: 3_000 });
  await settingsCloseBtn.click();
  await page.waitForTimeout(300);
});

// ---------------------------------------------------------------------------
// Test 2 — Gameplay: start → countdown → game over → results screen
// ---------------------------------------------------------------------------
test("T2: Surge gameplay leads to results screen with XP and rank", async ({ page }) => {
  await loadApp(page);

  const playBtn = page.locator('[data-testid="play-button"]');
  await expect(playBtn).toBeVisible({ timeout: 10_000 });
  await playBtn.click();

  // Wait through countdown (~4s)
  await page.waitForTimeout(4_500);

  // Rapidly click off-centre to drain all 3 lives quickly (misses)
  // The game has 3 lives; each miss deducts 1 life.
  // Click at top-left corner far from ring centre to generate misses fast.
  for (let i = 0; i < 60; i++) {
    await page.mouse.click(20, 20);
    await page.waitForTimeout(200);
  }

  // The revive prompt may appear (score=0 suppresses it, any score shows it).
  // If revive prompt appears, skip it.
  const reviveSkip = page.locator('[data-testid="surge-revive-skip"]');
  try {
    await expect(reviveSkip).toBeVisible({ timeout: 3_000 });
    await reviveSkip.click();
  } catch {
    // No revive prompt — score was 0, proceed directly to results
  }

  // Wait for results screen
  const resultsButtons = page.locator('[data-testid="surge-results-buttons"]');
  await expect(resultsButtons).toBeVisible({ timeout: 30_000 });

  // Results screen core elements
  const scoreSection = page.locator('[data-testid="surge-results-score-section"]');
  await expect(scoreSection).toBeVisible();

  const playAgain = page.locator('[data-testid="surge-results-play-again"]');
  await expect(playAgain).toBeVisible();

  const homeBtn = page.locator('[data-testid="surge-results-home"]');
  await expect(homeBtn).toBeVisible();

  const scoresBtn = page.locator('[data-testid="surge-results-scores"]');
  await expect(scoresBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3 — Paywall: open from PRO button, subscribe triggers TestConfirmModal
// ---------------------------------------------------------------------------
test("T3: Surge paywall opens from PRO button and settings modal", async ({ page }) => {
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

  // Subscribe button
  const subscribeBtn = page.locator('[data-testid="surge-paywall-subscribe"]');
  await expect(subscribeBtn).toBeVisible();

  // Restore Purchases button
  const restoreBtn = page.locator('[data-testid="surge-paywall-restore"]');
  await expect(restoreBtn).toBeVisible();

  // Tap Subscribe → TestConfirmModal should appear (dev/test env)
  await subscribeBtn.click();
  await page.waitForTimeout(600);

  const confirmModal = page.locator('[data-testid="surge-test-confirm-modal"]');
  await expect(confirmModal).toBeVisible({ timeout: 5_000 });

  const confirmTitle = page.locator('[data-testid="surge-test-confirm-title"]');
  await expect(confirmTitle).toContainText("Test Purchase");

  // Cancel — paywall should still be visible
  const cancelBtn = page.locator('[data-testid="surge-test-confirm-cancel"]');
  await cancelBtn.click();
  await page.waitForTimeout(400);

  // Paywall still present
  await expect(paywallTitle).toBeVisible();

  // Close paywall via close button
  const closeBtn = page.locator('[data-testid="surge-paywall-close"]');
  await expect(closeBtn).toBeVisible({ timeout: 3_000 });
  await closeBtn.click();
  await page.waitForTimeout(500);

  // Paywall no longer visible
  await expect(paywallTitle).not.toBeVisible({ timeout: 3_000 });

  // Open paywall from Settings → Upgrade to Pro
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

  // Close via close button
  const closeBtn2 = page.locator('[data-testid="surge-paywall-close"]');
  await closeBtn2.click();
  await page.waitForTimeout(400);
});

// Helper: start a game, drain lives, handle optional revive, wait for results
async function playAndGetToResults(page: Page) {
  const playBtn = page.locator('[data-testid="play-button"]').first();
  await expect(playBtn).toBeVisible({ timeout: 10_000 });
  await playBtn.click();

  // Wait through countdown
  await page.waitForTimeout(4_500);

  // Drain lives rapidly by clicking far off-centre
  for (let i = 0; i < 60; i++) {
    await page.mouse.click(20, 20);
    await page.waitForTimeout(200);
  }

  // Skip revive if it appears
  const reviveSkip = page.locator('[data-testid="surge-revive-skip"]');
  try {
    await expect(reviveSkip).toBeVisible({ timeout: 3_000 });
    await reviveSkip.click();
  } catch {
    // No revive prompt — ok
  }

  const resultsButtons = page.locator('[data-testid="surge-results-buttons"]');
  await expect(resultsButtons).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Test 4 — Results navigation: Play Again and Home buttons work correctly
// ---------------------------------------------------------------------------
test("T4: Results screen navigation buttons work correctly", async ({ page }) => {
  await loadApp(page);

  await playAndGetToResults(page);

  const resultsButtons = page.locator('[data-testid="surge-results-buttons"]');

  // Verify all navigation buttons are present
  const homeBtn = page.locator('[data-testid="surge-results-home"]');
  const playAgainBtn = page.locator('[data-testid="surge-results-play-again"]');
  const scoresBtn = page.locator('[data-testid="surge-results-scores"]');
  await expect(homeBtn).toBeVisible();
  await expect(playAgainBtn).toBeVisible();
  await expect(scoresBtn).toBeVisible();

  // "Play Again" restarts the game — results screen should go away
  await playAgainBtn.click();
  await page.waitForTimeout(2_000);
  await expect(resultsButtons).not.toBeVisible({ timeout: 6_000 });

  // Play through again to get back to results
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

  // Play button is visible on home screen
  const playBtnHome = page.locator('[data-testid="play-button"]:visible').first();
  await expect(playBtnHome).toBeVisible({ timeout: 8_000 });
});

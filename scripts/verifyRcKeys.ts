/**
 * Verify (and if needed, correct) the RevenueCat public API key env vars
 * against the actual keys stored in the RC project.
 *
 * Usage: npx tsx scripts/verifyRcKeys.ts
 *
 * This script:
 *  1. Fetches the real public API keys from the fixed RC project/app IDs
 *  2. Compares them to EXPO_PUBLIC_REVENUECAT_TEST_API_KEY and
 *     EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in the current process env
 *  3. Exits with code 1 if mismatched (update the env vars then re-run)
 *  4. Prints the App Store Connect submission checklist on success
 */

import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listAppPublicApiKeys } from "replit-revenuecat-v2";

// --- Hardcoded identifiers for the Surge RC project ---
// These are the authoritative IDs for the Surge RevenueCat setup.
// Do NOT change these without updating the corresponding RC project.
const RC_PROJECT_ID = "proj0f7f05c4";
const RC_TEST_STORE_APP_ID = "app079f70cf16"; // Sandbox/TestFlight app
const RC_APP_STORE_APP_ID = "appa8d0c25034"; // Production App Store app

// Validate that the configured env var IDs agree with the hardcoded IDs.
// If someone sets REVENUECAT_*_APP_ID to a different app, catch that now.
const envProjectId = process.env.REVENUECAT_PROJECT_ID;
const envTestAppId = process.env.REVENUECAT_TEST_STORE_APP_ID;
const envAppStoreAppId = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID;

if (envProjectId && envProjectId !== RC_PROJECT_ID) {
  console.error(
    `ERROR: REVENUECAT_PROJECT_ID env var (${envProjectId}) does not match` +
      ` the required Surge project ID (${RC_PROJECT_ID}). Fix the env var.`
  );
  process.exit(1);
}
if (envTestAppId && envTestAppId !== RC_TEST_STORE_APP_ID) {
  console.error(
    `ERROR: REVENUECAT_TEST_STORE_APP_ID env var (${envTestAppId}) does not match` +
      ` the required Surge test-store app ID (${RC_TEST_STORE_APP_ID}). Fix the env var.`
  );
  process.exit(1);
}
if (envAppStoreAppId && envAppStoreAppId !== RC_APP_STORE_APP_ID) {
  console.error(
    `ERROR: REVENUECAT_APPLE_APP_STORE_APP_ID env var (${envAppStoreAppId}) does not match` +
      ` the required Surge App Store app ID (${RC_APP_STORE_APP_ID}). Fix the env var.`
  );
  process.exit(1);
}

const ENV_TEST_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim() ?? "";
const ENV_IOS_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? "";

async function verify() {
  console.log("\n=== Fetching RC Public API Keys ===");
  console.log(`  Project    : ${RC_PROJECT_ID}`);
  console.log(`  Test Store : ${RC_TEST_STORE_APP_ID}`);
  console.log(`  App Store  : ${RC_APP_STORE_APP_ID}`);

  const client = await getUncachableRevenueCatClient();

  const [{ data: testData, error: testErr }, { data: iosData, error: iosErr }] =
    await Promise.all([
      listAppPublicApiKeys({
        client,
        path: {
          project_id: RC_PROJECT_ID,
          app_id: RC_TEST_STORE_APP_ID,
        },
      }),
      listAppPublicApiKeys({
        client,
        path: {
          project_id: RC_PROJECT_ID,
          app_id: RC_APP_STORE_APP_ID,
        },
      }),
    ]);

  if (testErr)
    throw new Error(
      "Failed to list test store keys: " + JSON.stringify(testErr)
    );
  if (iosErr)
    throw new Error(
      "Failed to list app store keys: " + JSON.stringify(iosErr)
    );

  const correctTestKey = testData?.items?.[0]?.key ?? null;
  const correctIosKey = iosData?.items?.[0]?.key ?? null;

  if (!correctTestKey || !correctIosKey) {
    console.error("\nERROR: One or both RC apps returned no public API keys!");
    if (!correctTestKey)
      console.error("  → No keys for Test Store app", RC_TEST_STORE_APP_ID);
    if (!correctIosKey)
      console.error("  → No keys for App Store app", RC_APP_STORE_APP_ID);
    process.exit(1);
  }

  console.log("\n=== RC Keys from RevenueCat API ===");
  console.log(`  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = ${correctTestKey}`);
  console.log(`  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY  = ${correctIosKey}`);

  console.log("\n=== Current Replit Env Vars ===");
  console.log(`  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = ${ENV_TEST_KEY || "(not set)"}`);
  console.log(`  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY  = ${ENV_IOS_KEY || "(not set)"}`);

  const testMatch = correctTestKey === ENV_TEST_KEY;
  const iosMatch = correctIosKey === ENV_IOS_KEY;

  console.log("\n=== Match Results ===");
  console.log(`  TEST key: ${testMatch ? "✅ MATCH" : "❌ MISMATCH — update required"}`);
  console.log(`  IOS  key: ${iosMatch ? "✅ MATCH" : "❌ MISMATCH — update required"}`);

  if (!testMatch || !iosMatch) {
    console.log("\n⚠️  MISMATCH DETECTED — Update these Replit env vars:");
    if (!testMatch) {
      console.log(
        `   EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = ${correctTestKey}`
      );
    }
    if (!iosMatch) {
      console.log(
        `   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY  = ${correctIosKey}`
      );
    }
    console.log(
      "\n   In the Replit Secrets pane update the above value(s), then re-run this script."
    );
    process.exit(1);
  }

  console.log(
    "\n✅ Both RC public API keys are correctly configured in Replit env vars."
  );

  printSubmissionGuide();
}

function printSubmissionGuide() {
  console.log(`
=======================================================================
  SURGE v1.0.1 — APP STORE SUBMISSION CHECKLIST
=======================================================================

The RC configuration and API keys are correct. To unblock the reviewer:

1. SYNC IAP TO APP STORE CONNECT
   In the Replit Publishing pane, click "Sync to App Store".
   This pushes "surge_remove_ads_v3" to Apple App Store Connect.

2. MARK IAP READY TO SUBMIT (App Store Connect)
   a. https://appstoreconnect.apple.com → app 6760904482
   b. App Store → In-App Purchases
   c. Open "surge_remove_ads_v3" (Remove Ads — Non-Consumable)
   d. Set status to "Ready to Submit" → Save

3. ATTACH IAP TO v1.0.1 VERSION
   a. ASC → App Store → select the 1.0.1 version
   b. "In-App Purchases" section → add surge_remove_ads_v2
   c. Save

4. SUBMIT FOR REVIEW
   Click "Submit for Review" on the 1.0.1 version in ASC.

=======================================================================
`);
}

verify().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});

/**
 * Verify (and if needed, correct) the RevenueCat public API key env vars
 * against the actual keys stored in the RC project.
 *
 * Usage: npx tsx scripts/verifyRcKeys.ts
 *
 * This script:
 *  1. Fetches the real public API keys from RC project proj0f7f05c4
 *  2. Compares them to EXPO_PUBLIC_REVENUECAT_TEST_API_KEY and
 *     EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in the current process env
 *  3. Prints the correct keys so you can update Replit env vars if they differ
 *  4. Prints the App Store Connect submission checklist
 */

import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listAppPublicApiKeys } from "replit-revenuecat-v2";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const TEST_STORE_APP_ID = process.env.REVENUECAT_TEST_STORE_APP_ID!;
const APPLE_APP_STORE_APP_ID = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID!;
const ENV_TEST_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
const ENV_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();

async function verify() {
  console.log("\n=== Fetching RC Public API Keys ===");
  const client = await getUncachableRevenueCatClient();

  const [{ data: testData, error: testErr }, { data: iosData, error: iosErr }] =
    await Promise.all([
      listAppPublicApiKeys({
        client,
        path: { project_id: PROJECT_ID, app_id: TEST_STORE_APP_ID },
      }),
      listAppPublicApiKeys({
        client,
        path: { project_id: PROJECT_ID, app_id: APPLE_APP_STORE_APP_ID },
      }),
    ]);

  if (testErr)
    throw new Error("Failed to list test store keys: " + JSON.stringify(testErr));
  if (iosErr)
    throw new Error("Failed to list app store keys: " + JSON.stringify(iosErr));

  const correctTestKey = testData?.items?.[0]?.key ?? null;
  const correctIosKey = iosData?.items?.[0]?.key ?? null;

  if (!correctTestKey || !correctIosKey) {
    console.error("ERROR: One or both RC apps returned no public API keys!");
    console.error("  Test Store keys:", testData?.items);
    console.error("  App Store keys:", iosData?.items);
    process.exit(1);
  }

  console.log("\n=== RC Keys from RevenueCat API ===");
  console.log(
    `  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY  = ${correctTestKey}`
  );
  console.log(
    `  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY   = ${correctIosKey}`
  );

  console.log("\n=== Current Replit Env Vars ===");
  console.log(`  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY  = ${ENV_TEST_KEY}`);
  console.log(`  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY   = ${ENV_IOS_KEY}`);

  const testMatch = correctTestKey === ENV_TEST_KEY;
  const iosMatch = correctIosKey === ENV_IOS_KEY;

  console.log("\n=== Match Results ===");
  console.log(`  TEST key matches: ${testMatch ? "✅ YES" : "❌ NO — UPDATE REQUIRED"}`);
  console.log(`  IOS  key matches: ${iosMatch ? "✅ YES" : "❌ NO — UPDATE REQUIRED"}`);

  if (!testMatch || !iosMatch) {
    console.log("\n⚠️  ACTION REQUIRED: Update the following Replit env vars via");
    console.log("   the Secrets/Env pane (or use setEnvVars in code_execution):\n");
    if (!testMatch)
      console.log(`   EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = ${correctTestKey}`);
    if (!iosMatch)
      console.log(`   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY  = ${correctIosKey}`);
  } else {
    console.log("\n✅ Both keys are correctly configured in Replit env vars.");
  }

  printSubmissionGuide();
}

function printSubmissionGuide() {
  console.log(`
=======================================================================
  SURGE v1.0.1 — APP STORE SUBMISSION CHECKLIST
=======================================================================

Before submitting, complete these steps in order:

1. SYNC IAP TO APP STORE CONNECT
   In the Replit Publishing pane, click "Sync to App Store".
   This pushes the "surge_remove_ads_v2" product from RevenueCat
   to Apple App Store Connect.

2. MARK IAP AS READY TO SUBMIT (in App Store Connect)
   a. Go to https://appstoreconnect.apple.com
   b. Select your Surge app (ID: 6760904482)
   c. Go to App Store → In-App Purchases
   d. Find "surge_remove_ads_v2" (Remove Ads)
   e. Set its status to "Ready to Submit"
   f. Save.

3. ATTACH IAP TO v1.0.1 VERSION
   a. In ASC, go to App Store → select the 1.0.1 version
   b. Scroll to "In-App Purchases" section
   c. Add "surge_remove_ads_v2" to the version
   d. Save.

4. SUBMIT FOR REVIEW
   a. Click "Submit for Review" in ASC for the 1.0.1 version.

=======================================================================
`);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});

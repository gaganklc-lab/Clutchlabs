import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listAppPublicApiKeys } from "replit-revenuecat-v2";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const TEST_STORE_APP_ID = process.env.REVENUECAT_TEST_STORE_APP_ID!;
const APPLE_APP_STORE_APP_ID = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID!;
const ENV_TEST_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
const ENV_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();

async function verify() {
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
    throw new Error(
      "Failed to list app store keys: " + JSON.stringify(iosErr)
    );

  const testKeysFromRC = testData?.items?.map((k) => k.key) ?? [];
  const iosKeysFromRC = iosData?.items?.map((k) => k.key) ?? [];

  console.log("=== RC Public API Keys ===");
  console.log("Test Store keys from RC:", testKeysFromRC);
  console.log("iOS App Store keys from RC:", iosKeysFromRC);
  console.log("=== Replit Env Vars ===");
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:", ENV_TEST_KEY);
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:", ENV_IOS_KEY);
  console.log("=== Match Check ===");
  const testMatch = testKeysFromRC.includes(ENV_TEST_KEY ?? "");
  const iosMatch = iosKeysFromRC.includes(ENV_IOS_KEY ?? "");
  console.log("TEST key matches RC:", testMatch);
  console.log("iOS key matches RC:", iosMatch);
  if (!testMatch && testKeysFromRC.length > 0) {
    console.log("CORRECT TEST KEY:", testKeysFromRC[0]);
  }
  if (!iosMatch && iosKeysFromRC.length > 0) {
    console.log("CORRECT IOS KEY:", iosKeysFromRC[0]);
  }
  if (testKeysFromRC.length === 0) {
    console.log(
      "WARNING: No public API keys found for Test Store app — RC may need re-initialization"
    );
  }
  if (iosKeysFromRC.length === 0) {
    console.log(
      "WARNING: No public API keys found for App Store app — RC may need re-initialization"
    );
  }
}

verify().catch(console.error);

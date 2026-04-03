import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProducts,
  createProduct,
  deleteProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  detachProductsFromEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  detachProductsFromPackage,
  type Product,
} from "replit-revenuecat-v2";

// ─── Required env vars (fail fast if missing) ────────────────────────────────
const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID;
const TEST_STORE_APP_ID = process.env.REVENUECAT_TEST_STORE_APP_ID;
const APPLE_APP_STORE_APP_ID = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID;

if (!PROJECT_ID) throw new Error("REVENUECAT_PROJECT_ID env var is missing");
if (!TEST_STORE_APP_ID)
  throw new Error("REVENUECAT_TEST_STORE_APP_ID env var is missing");
if (!APPLE_APP_STORE_APP_ID)
  throw new Error("REVENUECAT_APPLE_APP_STORE_APP_ID env var is missing");

// New one-time purchase identifiers (what the app code expects)
const NEW_PRODUCT_IDENTIFIER = "surge_remove_ads_v3";
const NEW_PRODUCT_DISPLAY_NAME = "Remove Ads";
const NEW_ENTITLEMENT_IDENTIFIER = "no_ads";
const NEW_ENTITLEMENT_DISPLAY_NAME = "No Ads";
const NEW_PACKAGE_IDENTIFIER = "$rc_lifetime";
const NEW_PACKAGE_DISPLAY_NAME = "Remove Ads (Lifetime)";
const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

// Old identifiers to clean up (v2 superseded by v3; old subscription also removed)
const OLD_PRODUCT_IDENTIFIER = "surge_remove_ads_v2";
const OLD_ENTITLEMENT_IDENTIFIER = "surge_pro";

// Test Store price: $0.99 one-time
const TEST_STORE_PRICES = [{ amount_micros: 990000, currency: "USD" }];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedSurgeRemoveAds() {
  const client = await getUncachableRevenueCatClient();

  console.log("Project ID:", PROJECT_ID);
  console.log("Test Store App ID:", TEST_STORE_APP_ID);
  console.log("App Store App ID:", APPLE_APP_STORE_APP_ID);

  // ─── Phase 1: Load all existing products ──────────────────────────────────────
  const loadProducts = async (): Promise<Product[]> => {
    const { data, error } = await listProducts({
      client,
      path: { project_id: PROJECT_ID },
      query: { limit: 100 },
    });
    if (error) throw new Error("Failed to list products: " + JSON.stringify(error));
    return data.items ?? [];
  };

  // ─── Phase 2: Clean up old products BEFORE creating new ones ──────────────────
  // Must run first so the Test Store doesn't reject the new product
  // due to a duplicate display_name from the old product.
  console.log("\n--- Phase 2: Cleaning up old products ---");

  const existingEntitlements_pre = await (async () => {
    const { data, error } = await listEntitlements({
      client,
      path: { project_id: PROJECT_ID },
      query: { limit: 20 },
    });
    if (error) throw new Error("Failed to list entitlements: " + JSON.stringify(error));
    return data.items ?? [];
  })();

  const initialProducts = await loadProducts();
  const oldProductIds: string[] = initialProducts
    .filter((p) => p.store_identifier === OLD_PRODUCT_IDENTIFIER)
    .map((p) => p.id);

  if (oldProductIds.length === 0) {
    console.log("No old products found (", OLD_PRODUCT_IDENTIFIER, ") — skipping cleanup");
  } else {
    console.log("Old products to clean up:", oldProductIds);

    // Detach from old entitlement (surge_pro) if it exists
    const oldEntitlement = existingEntitlements_pre.find(
      (e) => e.lookup_key === OLD_ENTITLEMENT_IDENTIFIER
    );
    if (oldEntitlement) {
      const { error } = await detachProductsFromEntitlement({
        client,
        path: { project_id: PROJECT_ID, entitlement_id: oldEntitlement.id },
        body: { product_ids: oldProductIds },
      });
      if (error)
        throw new Error("Failed to detach old products from surge_pro: " + JSON.stringify(error));
      console.log("Detached old products from surge_pro entitlement");
    }

    // Detach from no_ads entitlement if attached
    const noAdsEnt_pre = existingEntitlements_pre.find(
      (e) => e.lookup_key === NEW_ENTITLEMENT_IDENTIFIER
    );
    if (noAdsEnt_pre) {
      await detachProductsFromEntitlement({
        client,
        path: { project_id: PROJECT_ID, entitlement_id: noAdsEnt_pre.id },
        body: { product_ids: oldProductIds },
      }).catch(() => {});
    }

    // Detach from all packages across all offerings
    const { data: allOfferings } = await listOfferings({
      client,
      path: { project_id: PROJECT_ID },
      query: { limit: 20 },
    });
    for (const offering of allOfferings?.items ?? []) {
      const { data: pkgList } = await listPackages({
        client,
        path: { project_id: PROJECT_ID, offering_id: offering.id },
        query: { limit: 20 },
      });
      for (const pkg of pkgList?.items ?? []) {
        const { error } = await detachProductsFromPackage({
          client,
          path: { project_id: PROJECT_ID, package_id: pkg.id },
          body: { product_ids: oldProductIds },
        });
        if (error) {
          const errType = (error as { type?: string }).type;
          if (errType !== "unprocessable_entity_error") {
            throw new Error(
              `Failed to detach old products from package ${pkg.id}: ` + JSON.stringify(error)
            );
          }
        } else {
          console.log(`Detached old products from package ${pkg.lookup_key} (${pkg.id})`);
        }
      }
    }

    // Delete old products
    for (const productId of oldProductIds) {
      const { error } = await deleteProduct({
        client,
        path: { project_id: PROJECT_ID, product_id: productId },
      });
      if (error)
        throw new Error(`Failed to delete old product ${productId}: ` + JSON.stringify(error));
      console.log("Deleted old product:", productId);
    }
  }

  // ─── Phase 3: Create new products ────────────────────────────────────────────
  // Reload product list now that old products have been removed
  console.log("\n--- Phase 3: Creating new products ---");
  const freshProducts = await loadProducts();
  const findProduct = (storeId: string, appId: string): Product | undefined =>
    freshProducts.find((p) => p.store_identifier === storeId && p.app_id === appId);

  const ensureProduct = async (
    appId: string,
    label: string,
    isTestStore: boolean
  ): Promise<Product> => {
    const existing = findProduct(NEW_PRODUCT_IDENTIFIER, appId);
    if (existing) {
      console.log(label + " product already exists:", existing.id, existing.store_identifier);
      return existing;
    }
    const body: Record<string, unknown> = {
      store_identifier: NEW_PRODUCT_IDENTIFIER,
      app_id: appId,
      type: "non_consumable",
      display_name: NEW_PRODUCT_DISPLAY_NAME,
    };
    if (isTestStore) {
      body.title = NEW_PRODUCT_DISPLAY_NAME;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: PROJECT_ID },
      body: body as Parameters<typeof createProduct>[0]["body"],
    });
    if (error)
      throw new Error("Failed to create " + label + " product: " + JSON.stringify(error));
    console.log("Created " + label + " product:", created.id, created.store_identifier);
    return created;
  };

  const testStoreProduct = await ensureProduct(TEST_STORE_APP_ID, "Test Store", true);
  const appStoreProduct = await ensureProduct(APPLE_APP_STORE_APP_ID, "App Store", false);

  // ─── Phase 4: Add Test Store price ($0.99) ────────────────────────────────────
  console.log("\n--- Phase 4: Setting test store price ---");
  console.log("Adding test store price for product:", testStoreProduct.id);
  const { error: priceError } = await client.post<TestStorePricesResponse>({
    url: "/projects/{project_id}/products/{product_id}/test_store_prices",
    path: { project_id: PROJECT_ID, product_id: testStoreProduct.id },
    body: { prices: TEST_STORE_PRICES },
  });
  if (priceError) {
    const errType = (priceError as { type?: string }).type;
    if (errType === "resource_already_exists") {
      console.log("Test store prices already set — skipping");
    } else {
      throw new Error("Failed to add test store price: " + JSON.stringify(priceError));
    }
  } else {
    console.log("Test store price $0.99 set");
  }

  // ─── Phase 5: Ensure no_ads entitlement ──────────────────────────────────────
  console.log("\n--- Phase 5: Ensuring no_ads entitlement ---");
  const { data: existingEntitlements, error: listEntitlementsError } =
    await listEntitlements({
      client,
      path: { project_id: PROJECT_ID },
      query: { limit: 20 },
    });
  if (listEntitlementsError)
    throw new Error("Failed to list entitlements: " + JSON.stringify(listEntitlementsError));

  let noAdsEntitlement = existingEntitlements.items?.find(
    (e) => e.lookup_key === NEW_ENTITLEMENT_IDENTIFIER
  );

  if (noAdsEntitlement) {
    console.log("no_ads entitlement already exists:", noAdsEntitlement.id);
  } else {
    const { data: created, error } = await createEntitlement({
      client,
      path: { project_id: PROJECT_ID },
      body: {
        lookup_key: NEW_ENTITLEMENT_IDENTIFIER,
        display_name: NEW_ENTITLEMENT_DISPLAY_NAME,
      },
    });
    if (error)
      throw new Error("Failed to create no_ads entitlement: " + JSON.stringify(error));
    console.log("Created no_ads entitlement:", created.id);
    noAdsEntitlement = created;
  }

  const { error: attachEntitlementError } = await attachProductsToEntitlement({
    client,
    path: { project_id: PROJECT_ID, entitlement_id: noAdsEntitlement.id },
    body: { product_ids: [testStoreProduct.id, appStoreProduct.id] },
  });
  if (attachEntitlementError) {
    const errType = (attachEntitlementError as { type?: string }).type;
    if (errType === "unprocessable_entity_error") {
      console.log("Products already attached to no_ads entitlement — skipping");
    } else {
      throw new Error(
        "Failed to attach products to no_ads entitlement: " +
          JSON.stringify(attachEntitlementError)
      );
    }
  } else {
    console.log("Attached both products to no_ads entitlement");
  }

  // ─── Phase 6: Ensure default offering ────────────────────────────────────────
  console.log("\n--- Phase 6: Ensuring default offering ---");
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: PROJECT_ID },
    query: { limit: 20 },
  });
  if (listOfferingsError)
    throw new Error("Failed to list offerings: " + JSON.stringify(listOfferingsError));

  let defaultOffering = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER
  );

  if (defaultOffering) {
    console.log(
      "Default offering already exists:",
      defaultOffering.id,
      "is_current:",
      defaultOffering.is_current
    );
  } else {
    const { data: created, error } = await createOffering({
      client,
      path: { project_id: PROJECT_ID },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error)
      throw new Error("Failed to create default offering: " + JSON.stringify(error));
    console.log("Created default offering:", created.id);
    defaultOffering = created;
  }

  if (!defaultOffering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: PROJECT_ID, offering_id: defaultOffering.id },
      body: { is_current: true },
    });
    if (error)
      throw new Error("Failed to set offering as current: " + JSON.stringify(error));
    console.log("Marked default offering as current");
  } else {
    console.log("Default offering is already current");
  }

  // ─── Phase 7: Ensure $rc_lifetime package ────────────────────────────────────
  console.log("\n--- Phase 7: Ensuring $rc_lifetime package ---");
  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: PROJECT_ID, offering_id: defaultOffering.id },
    query: { limit: 20 },
  });
  if (listPackagesError)
    throw new Error("Failed to list packages: " + JSON.stringify(listPackagesError));

  let lifetimePkg = existingPackages.items?.find(
    (p) => p.lookup_key === NEW_PACKAGE_IDENTIFIER
  );

  if (lifetimePkg) {
    console.log("$rc_lifetime package already exists:", lifetimePkg.id);
  } else {
    const { data: created, error } = await createPackages({
      client,
      path: { project_id: PROJECT_ID, offering_id: defaultOffering.id },
      body: {
        lookup_key: NEW_PACKAGE_IDENTIFIER,
        display_name: NEW_PACKAGE_DISPLAY_NAME,
      },
    });
    if (error)
      throw new Error("Failed to create $rc_lifetime package: " + JSON.stringify(error));
    console.log("Created $rc_lifetime package:", created.id);
    lifetimePkg = created;
  }

  const { error: attachPkgError } = await attachProductsToPackage({
    client,
    path: { project_id: PROJECT_ID, package_id: lifetimePkg.id },
    body: {
      products: [
        { product_id: testStoreProduct.id, eligibility_criteria: "all" },
        { product_id: appStoreProduct.id, eligibility_criteria: "all" },
      ],
    },
  });
  if (attachPkgError) {
    const err = attachPkgError as { type?: string; message?: string };
    if (
      err.type === "unprocessable_entity_error" &&
      err.message?.includes("Cannot attach product")
    ) {
      console.log("Products already attached to $rc_lifetime package — skipping");
    } else {
      throw new Error(
        "Failed to attach products to $rc_lifetime package: " + JSON.stringify(attachPkgError)
      );
    }
  } else {
    console.log("Attached both products to $rc_lifetime package");
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n====================");
  console.log("Surge Remove Ads RevenueCat setup complete!");
  console.log("Project ID:", PROJECT_ID);
  console.log(
    "Test Store product:",
    testStoreProduct.id,
    "store_id:",
    testStoreProduct.store_identifier
  );
  console.log(
    "App Store product:",
    appStoreProduct.id,
    "store_id:",
    appStoreProduct.store_identifier
  );
  console.log(
    "Entitlement:",
    noAdsEntitlement.id,
    "lookup_key:",
    noAdsEntitlement.lookup_key
  );
  console.log(
    "Offering:",
    defaultOffering.id,
    "lookup_key:",
    defaultOffering.lookup_key,
    "is_current:",
    true
  );
  console.log("Package:", lifetimePkg.id, "lookup_key:", lifetimePkg.lookup_key);
  console.log("====================");
  console.log(
    "\nNEXT STEP: Go to Replit Publishing pane → 'Sync to App Store'"
  );
  console.log("to push surge_remove_ads_v3 to Apple App Store Connect.");
  console.log(
    "Then in App Store Connect, mark it 'Ready to Submit' and"
  );
  console.log(
    "attach it to the Surge 1.0.1 version before resubmitting."
  );
}

seedSurgeRemoveAds().catch((err) => {
  console.error("Seed script FAILED:", err);
  process.exit(1);
});

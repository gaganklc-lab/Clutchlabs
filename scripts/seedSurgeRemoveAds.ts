import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  listApps,
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
  type App,
  type Product,
} from "replit-revenuecat-v2";

// New one-time purchase identifiers (what the app code expects)
const NEW_PRODUCT_IDENTIFIER = "surge_remove_ads_v2";
const NEW_PRODUCT_DISPLAY_NAME = "Remove Ads";
const NEW_ENTITLEMENT_IDENTIFIER = "no_ads";
const NEW_ENTITLEMENT_DISPLAY_NAME = "No Ads";
const NEW_PACKAGE_IDENTIFIER = "$rc_lifetime";
const NEW_PACKAGE_DISPLAY_NAME = "Remove Ads (Lifetime)";
const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

// Old subscription identifiers (to clean up)
const OLD_PRODUCT_IDENTIFIER = "surge_pro_monthly";
const OLD_ENTITLEMENT_IDENTIFIER = "surge_pro";
const OLD_PACKAGE_IDENTIFIER = "$rc_monthly";

// Test Store price: $0.99 one-time
const TEST_STORE_PRICES = [{ amount_micros: 990000, currency: "USD" }];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedSurgeRemoveAds() {
  const client = await getUncachableRevenueCatClient();

  // ─── Resolve project ─────────────────────────────────────────────────────────
  const { data: existingProjects, error: listProjectsError } =
    await listProjects({ client, query: { limit: 20 } });
  if (listProjectsError) throw new Error("Failed to list projects");

  const project = existingProjects.items?.find((p) => p.name === "Surge");
  if (!project) throw new Error("Surge project not found — check RC connection");
  console.log("Project:", project.id, project.name);

  // ─── Resolve apps ────────────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps?.items.length) throw new Error("Failed to list apps");

  const testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  const appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");

  if (!testStoreApp) throw new Error("Test Store app not found");
  if (!appStoreApp) throw new Error("App Store app not found");

  console.log("Test Store app:", testStoreApp.id);
  console.log("App Store app:", appStoreApp.id);

  // ─── Load all existing products ───────────────────────────────────────────────
  const { data: allProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const findProduct = (storeId: string, appId: string): Product | undefined =>
    allProducts.items?.find(
      (p) => p.store_identifier === storeId && p.app_id === appId
    );

  // ─── Create new products ─────────────────────────────────────────────────────
  const ensureProduct = async (targetApp: App, label: string, isTestStore: boolean): Promise<Product> => {
    const existing = findProduct(NEW_PRODUCT_IDENTIFIER, targetApp.id);
    if (existing) {
      console.log(label + " product already exists:", existing.id, existing.store_identifier);
      return existing;
    }
    const body: Record<string, unknown> = {
      store_identifier: NEW_PRODUCT_IDENTIFIER,
      app_id: targetApp.id,
      type: "non_consumable",
      display_name: NEW_PRODUCT_DISPLAY_NAME,
    };
    if (isTestStore) {
      // Test Store requires a user-facing title
      body.title = NEW_PRODUCT_DISPLAY_NAME;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body: body as Parameters<typeof createProduct>[0]["body"],
    });
    if (error) throw new Error("Failed to create " + label + " product: " + JSON.stringify(error));
    console.log("Created " + label + " product:", created.id, created.store_identifier);
    return created;
  };

  const testStoreProduct = await ensureProduct(testStoreApp, "Test Store", true);
  const appStoreProduct = await ensureProduct(appStoreApp, "App Store", false);

  // ─── Add Test Store price ($0.99) ─────────────────────────────────────────────
  console.log("Adding test store price for product:", testStoreProduct.id);
  const { error: priceError } = await client.post<TestStorePricesResponse>({
    url: "/projects/{project_id}/products/{product_id}/test_store_prices",
    path: { project_id: project.id, product_id: testStoreProduct.id },
    body: { prices: TEST_STORE_PRICES },
  });
  if (priceError) {
    if (
      typeof priceError === "object" &&
      "type" in priceError &&
      (priceError as { type: string }).type === "resource_already_exists"
    ) {
      console.log("Test store prices already set — skipping");
    } else {
      throw new Error("Failed to add test store price: " + JSON.stringify(priceError));
    }
  } else {
    console.log("Test store price $0.99 set");
  }

  // ─── Ensure no_ads entitlement ────────────────────────────────────────────────
  const { data: existingEntitlements, error: listEntitlementsError } =
    await listEntitlements({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  let noAdsEntitlement = existingEntitlements.items?.find(
    (e) => e.lookup_key === NEW_ENTITLEMENT_IDENTIFIER
  );

  if (noAdsEntitlement) {
    console.log("no_ads entitlement already exists:", noAdsEntitlement.id);
  } else {
    const { data: created, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: NEW_ENTITLEMENT_IDENTIFIER,
        display_name: NEW_ENTITLEMENT_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create no_ads entitlement: " + JSON.stringify(error));
    console.log("Created no_ads entitlement:", created.id);
    noAdsEntitlement = created;
  }

  // Attach new products to no_ads entitlement
  const { error: attachEntitlementError } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: noAdsEntitlement.id },
    body: { product_ids: [testStoreProduct.id, appStoreProduct.id] },
  });
  if (attachEntitlementError) {
    if ((attachEntitlementError as { type?: string }).type === "unprocessable_entity_error") {
      console.log("Products already attached to no_ads entitlement — skipping");
    } else {
      throw new Error("Failed to attach products to no_ads entitlement: " + JSON.stringify(attachEntitlementError));
    }
  } else {
    console.log("Attached both products to no_ads entitlement");
  }

  // ─── Ensure default offering ──────────────────────────────────────────────────
  const { data: existingOfferings, error: listOfferingsError } =
    await listOfferings({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  let defaultOffering = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER
  );

  if (defaultOffering) {
    console.log("Default offering already exists:", defaultOffering.id, "is_current:", defaultOffering.is_current);
  } else {
    const { data: created, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create default offering: " + JSON.stringify(error));
    console.log("Created default offering:", created.id);
    defaultOffering = created;
  }

  if (!defaultOffering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: defaultOffering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current: " + JSON.stringify(error));
    console.log("Marked default offering as current");
  } else {
    console.log("Default offering is already current");
  }

  // ─── Ensure $rc_lifetime package ─────────────────────────────────────────────
  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: defaultOffering.id },
    query: { limit: 20 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  let lifetimePkg = existingPackages.items?.find(
    (p) => p.lookup_key === NEW_PACKAGE_IDENTIFIER
  );

  if (lifetimePkg) {
    console.log("$rc_lifetime package already exists:", lifetimePkg.id);
  } else {
    const { data: created, error } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: defaultOffering.id },
      body: { lookup_key: NEW_PACKAGE_IDENTIFIER, display_name: NEW_PACKAGE_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create $rc_lifetime package: " + JSON.stringify(error));
    console.log("Created $rc_lifetime package:", created.id);
    lifetimePkg = created;
  }

  // Attach new products to $rc_lifetime package
  const { error: attachPkgError } = await attachProductsToPackage({
    client,
    path: { project_id: project.id, package_id: lifetimePkg.id },
    body: {
      products: [
        { product_id: testStoreProduct.id, eligibility_criteria: "all" },
        { product_id: appStoreProduct.id, eligibility_criteria: "all" },
      ],
    },
  });
  if (attachPkgError) {
    if (
      (attachPkgError as { type?: string }).type === "unprocessable_entity_error" &&
      (attachPkgError as { message?: string }).message?.includes("Cannot attach product")
    ) {
      console.log("Products already attached to $rc_lifetime package — skipping");
    } else {
      throw new Error("Failed to attach products to $rc_lifetime package: " + JSON.stringify(attachPkgError));
    }
  } else {
    console.log("Attached both products to $rc_lifetime package");
  }

  // ─── Clean up old subscription products ───────────────────────────────────────
  console.log("\n--- Cleaning up old subscription products ---");

  const oldTestProduct = findProduct(OLD_PRODUCT_IDENTIFIER, testStoreApp.id);
  const oldAppStoreProduct = findProduct(OLD_PRODUCT_IDENTIFIER, appStoreApp.id);

  const oldProductIds: string[] = [];
  if (oldTestProduct) oldProductIds.push(oldTestProduct.id);
  if (oldAppStoreProduct) oldProductIds.push(oldAppStoreProduct.id);

  if (oldProductIds.length === 0) {
    console.log("No old subscription products found — nothing to clean up");
  } else {
    console.log("Old products to clean up:", oldProductIds);

    // Detach from old entitlement (surge_pro) if it exists
    const oldEntitlement = existingEntitlements.items?.find(
      (e) => e.lookup_key === OLD_ENTITLEMENT_IDENTIFIER
    );
    if (oldEntitlement) {
      const { error: detachEntError } = await detachProductsFromEntitlement({
        client,
        path: { project_id: project.id, entitlement_id: oldEntitlement.id },
        body: { product_ids: oldProductIds },
      });
      if (detachEntError) {
        console.warn("Could not detach from old entitlement (may already be detached):", JSON.stringify(detachEntError));
      } else {
        console.log("Detached old products from surge_pro entitlement");
      }
    } else {
      console.log("surge_pro entitlement not found — skipping detach from entitlement");
    }

    // Detach from old package ($rc_monthly) if it exists
    const oldPackage = existingPackages.items?.find(
      (p) => p.lookup_key === OLD_PACKAGE_IDENTIFIER
    );
    if (oldPackage) {
      const { error: detachPkgError } = await detachProductsFromPackage({
        client,
        path: { project_id: project.id, package_id: oldPackage.id },
        body: { product_ids: oldProductIds },
      });
      if (detachPkgError) {
        console.warn("Could not detach from old package (may already be detached):", JSON.stringify(detachPkgError));
      } else {
        console.log("Detached old products from $rc_monthly package");
      }
    } else {
      console.log("$rc_monthly package not found — skipping detach from package");
    }

    // Delete old products
    for (const productId of oldProductIds) {
      const { error: deleteError } = await deleteProduct({
        client,
        path: { project_id: project.id, product_id: productId },
      });
      if (deleteError) {
        console.warn("Could not delete old product", productId, ":", JSON.stringify(deleteError));
      } else {
        console.log("Deleted old product:", productId);
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n====================");
  console.log("Surge Remove Ads RevenueCat setup complete!");
  console.log("Project:", project.id, project.name);
  console.log("Test Store product:", testStoreProduct.id, "store_id:", testStoreProduct.store_identifier);
  console.log("App Store product:", appStoreProduct.id, "store_id:", appStoreProduct.store_identifier);
  console.log("Entitlement:", noAdsEntitlement.id, "lookup_key:", noAdsEntitlement.lookup_key);
  console.log("Offering:", defaultOffering.id, "lookup_key:", defaultOffering.lookup_key, "is_current:", true);
  console.log("Package:", lifetimePkg.id, "lookup_key:", lifetimePkg.lookup_key);
  console.log("====================");
  console.log("\nNEXT STEP: Go to Replit Publishing pane → 'Sync to App Store'");
  console.log("to push surge_remove_ads_v2 to Apple App Store Connect.");
  console.log("Then in App Store Connect, mark it 'Ready to Submit' and");
  console.log("attach it to the Surge app version before resubmitting.");
}

seedSurgeRemoveAds().catch(console.error);

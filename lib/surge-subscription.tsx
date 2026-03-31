import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

// Trim keys at read time — trailing whitespace causes RevenueCat to silently reject the key,
// resulting in getOfferings() failing and the purchase button appearing permanently disabled.
const REVENUECAT_TEST_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();

export const NO_ADS_ENTITLEMENT = "no_ads";

// Key routing:
// - Expo Go (storeClient) or local dev (__DEV__=true): uses TEST key (sandbox/mock simulation).
// - TestFlight / App Store (standalone, __DEV__=false): uses IOS key (real App Store purchases).
// NEVER swap to the TEST key for real iOS review builds — reviewer must hit the real RC offering.
function getRevenueCatApiKey(): string {
  const isDevOrTestEnv =
    __DEV__ ||
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient";

  if (isDevOrTestEnv) {
    if (!REVENUECAT_TEST_API_KEY) throw new Error("RevenueCat test key missing");
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") {
    if (!REVENUECAT_IOS_API_KEY) throw new Error("RevenueCat iOS key missing");
    return REVENUECAT_IOS_API_KEY;
  }

  if (Platform.OS === "android") {
    if (!REVENUECAT_ANDROID_API_KEY)
      throw new Error("RevenueCat Android key missing");
    return REVENUECAT_ANDROID_API_KEY;
  }

  if (!REVENUECAT_TEST_API_KEY) throw new Error("RevenueCat test key missing");
  return REVENUECAT_TEST_API_KEY;
}

export function initializeSurgeRevenueCat() {
  try {
    const apiKey = getRevenueCatApiKey();
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey });
    console.log("[SurgePaywall] RevenueCat configured, key prefix:", apiKey.slice(0, 12) + "...");
  } catch (err) {
    // CRITICAL: if RC fails to configure, getOfferings() will fail, offerings stay null,
    // pkg stays undefined, and the purchase button appears disabled with no explanation.
    console.warn("[SurgePaywall] CRITICAL: RevenueCat init failed — IAP will not work:", err);
  }
}

function useSurgeSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["surge", "revenuecat", "customer-info"],
    queryFn: async () => {
      const info = await Purchases.getCustomerInfo();
      return info;
    },
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["surge", "revenuecat", "offerings"],
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      console.log("[SurgePaywall] offerings loaded. current:", offerings.current?.identifier ?? "null");
      console.log("[SurgePaywall] available packages:", offerings.current?.availablePackages.map(p => p.identifier) ?? []);
      return offerings;
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      // pkg.identifier = RC package ID (e.g. "$rc_lifetime")
      // pkg.product.identifier = App Store product ID (e.g. "surge_remove_ads")
      // pkg.product.priceString = localized price (e.g. "$0.99")
      console.log(
        "[SurgePaywall] purchasePackage called — pkg:", pkg.identifier,
        "product:", pkg.product.identifier,
        "price:", pkg.product.priceString,
      );
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      console.log("[SurgePaywall] purchase succeeded. active entitlements:", Object.keys(customerInfo.entitlements.active));
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
    onError: (err: unknown) => {
      console.log("[SurgePaywall] purchase failed:", err);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      console.log("[SurgePaywall] restorePurchases called");
      const info = await Purchases.restorePurchases();
      console.log("[SurgePaywall] restore done. active entitlements:", Object.keys(info.entitlements?.active ?? {}));
      return info;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const hasNoAds =
    customerInfoQuery.data?.entitlements.active?.[NO_ADS_ENTITLEMENT] !==
    undefined;

  const currentOffering = offeringsQuery.data?.current ?? null;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    currentOffering,
    hasNoAds,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchaseRemoveAds: purchaseMutation.mutateAsync,
    restorePurchases: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SurgeSubscriptionContextValue = ReturnType<
  typeof useSurgeSubscriptionContext
>;
const SurgeSubscriptionContext =
  createContext<SurgeSubscriptionContextValue | null>(null);

export function SurgeSubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSurgeSubscriptionContext();
  return (
    <SurgeSubscriptionContext.Provider value={value}>
      {children}
    </SurgeSubscriptionContext.Provider>
  );
}

export function useSurgeSubscription() {
  const ctx = useContext(SurgeSubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSurgeSubscription must be used within SurgeSubscriptionProvider"
    );
  }
  return ctx;
}

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
    console.warn("[SURGE_DEBUG] RC init started");
    const apiKey = getRevenueCatApiKey();
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey });
    console.warn("[SURGE_DEBUG] RC initialized, key prefix:", apiKey.slice(0, 12) + "...");
  } catch (err) {
    // CRITICAL: if RC fails to configure, getOfferings() will fail, offerings stay null,
    // pkg stays undefined, and the purchase button appears disabled with no explanation.
    console.warn("[SURGE_DEBUG] ❌ RC init failed", err);
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
    retry: 2,
    retryDelay: 2000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["surge", "revenuecat", "offerings"],
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      console.warn("[SURGE_DEBUG] Offering:", offerings.current?.identifier ?? "null");
      console.warn("[SURGE_DEBUG] Packages:", offerings.current?.availablePackages.map(p => p.identifier) ?? []);
      return offerings;
    },
    staleTime: 300 * 1000,
    // Retry 3 times with 2s delay — transient network errors at app startup are common
    // and must not permanently prevent the reviewer from seeing the purchase button.
    retry: 3,
    retryDelay: 2000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      // pkg.identifier = RC package ID (e.g. "$rc_lifetime")
      // pkg.product.identifier = App Store product ID (e.g. "surge_remove_ads_v3")
      // pkg.product.priceString = localized price (e.g. "$0.99")
      console.warn(
        "[SURGE_DEBUG] Purchase started:", pkg.identifier,
        "product:", pkg.product.identifier,
        "price:", pkg.product.priceString,
      );
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      console.warn("[SURGE_DEBUG] Purchase success, active entitlements:", Object.keys(customerInfo.entitlements.active));
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
    onError: (err: unknown) => {
      console.warn("[SURGE_DEBUG] Purchase failed:", err);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      console.warn("[SURGE_DEBUG] Restore pressed");
      const info = await Purchases.restorePurchases();
      console.warn("[SURGE_DEBUG] Restore done, active entitlements:", Object.keys(info.entitlements?.active ?? {}));
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
    isOfferingsError: offeringsQuery.isError,
    retryOfferings: () => offeringsQuery.refetch(),
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

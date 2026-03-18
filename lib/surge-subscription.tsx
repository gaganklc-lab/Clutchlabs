import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const SURGE_PRO_ENTITLEMENT = "surge_pro";

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
    console.log("[SurgePro] RevenueCat configured");
  } catch (err) {
    console.warn("[SurgePro] RevenueCat init failed:", err);
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
      return offerings;
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return Purchases.restorePurchases();
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isPro =
    customerInfoQuery.data?.entitlements.active?.[SURGE_PRO_ENTITLEMENT] !==
    undefined;

  const currentOffering = offeringsQuery.data?.current ?? null;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    currentOffering,
    isPro,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchasePro: purchaseMutation.mutateAsync,
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

import { useCallback, useEffect } from "react";
import { Platform } from "react-native";

export interface RewardedAdResult {
  granted: boolean;
}

// Google's official test IDs — safe for development / Expo Go fallback
const TEST_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";

function getAdUnitId(): string {
  if (__DEV__) return TEST_REWARDED_IOS;
  if (Platform.OS === "ios") {
    return (
      process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID ?? TEST_REWARDED_IOS
    );
  }
  // Android placeholder — iOS is the current App Store target
  return TEST_REWARDED_IOS;
}

// Detect whether the native SDK is linked at runtime.
// react-native-google-mobile-ads works in EAS production/dev-client builds
// but its native module is not linked in Expo Go, so we degrade gracefully.
const isNativeSdkAvailable = (() => {
  try {
    const sdk = require("react-native-google-mobile-ads");
    // Check the native module is actually present (not just the JS shim)
    return sdk && typeof sdk.MobileAds === "function";
  } catch {
    return false;
  }
})();

export function useRewardedAd() {
  // Initialize the AdMob SDK once per app session when the native module is
  // present. On iOS 14.5+ the system may show the ATT permission dialog on
  // the first ad request — this is allowed by NSUserTrackingUsageDescription
  // added to Info.plist by the react-native-google-mobile-ads Expo plugin.
  useEffect(() => {
    if (!isNativeSdkAvailable) return;
    try {
      const { MobileAds } = require("react-native-google-mobile-ads");
      MobileAds()
        .initialize()
        .catch(() => {});
    } catch {
      // Ignore — ad load will fail gracefully if SDK is broken
    }
  }, []);

  const watchAd = useCallback((): Promise<RewardedAdResult> => {
    // ── Stub path (Expo Go / native SDK not linked) ─────────────────────
    if (!isNativeSdkAvailable) {
      return new Promise<RewardedAdResult>((resolve) =>
        setTimeout(() => resolve({ granted: true }), 800)
      );
    }

    // ── Real AdMob rewarded ad path ─────────────────────────────────────
    return new Promise<RewardedAdResult>((resolve) => {
      try {
        const { RewardedAd, RewardedAdEventType, AdEventType } = require(
          "react-native-google-mobile-ads"
        );

        const ad = RewardedAd.createForAdRequest(getAdUnitId(), {
          requestNonPersonalizedAdsOnly: true,
        });

        let rewardEarned = false;
        const subs: (() => void)[] = [];

        const cleanup = () => {
          subs.forEach((unsub) => {
            try {
              unsub();
            } catch {}
          });
        };

        // User fully watched the ad — record the reward
        subs.push(
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
            rewardEarned = true;
          })
        );

        // Ad closed (after full watch or if user skipped)
        subs.push(
          ad.addAdEventListener(AdEventType.CLOSED, () => {
            cleanup();
            resolve({ granted: rewardEarned });
          })
        );

        // Ad failed to load or show → go straight to results
        subs.push(
          ad.addAdEventListener(AdEventType.ERROR, () => {
            cleanup();
            resolve({ granted: false });
          })
        );

        // Ad loaded successfully → show it immediately
        subs.push(
          ad.addAdEventListener(AdEventType.LOADED, () => {
            ad.show().catch(() => {
              cleanup();
              resolve({ granted: false });
            });
          })
        );

        ad.load();
      } catch {
        resolve({ granted: false });
      }
    });
  }, []);

  return {
    isAdReady: true,
    watchAd,
    showRewardedAd: watchAd,
  };
}

import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

export interface RewardedAdResult {
  granted: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────
const TEST_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";

function getAdUnitId(): string {
  if (__DEV__) return TEST_REWARDED_IOS;
  if (Platform.OS === "ios") {
    return (
      process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID ?? TEST_REWARDED_IOS
    );
  }
  return TEST_REWARDED_IOS;
}

// ── SDK detection ────────────────────────────────────────────────────────────
// Resolved once at module load. In Expo Go the native module is absent;
// the .native.ts file is still loaded but all native calls are guarded.
let sdkUseRewardedAd: (
  adUnitId: string | null,
  options?: object
) => {
  isLoaded: boolean;
  isClosed: boolean;
  isEarnedReward: boolean;
  error: Error | undefined;
  load: () => void;
  show: () => void;
} = (_id, _opts) => ({
  isLoaded: false,
  isClosed: false,
  isEarnedReward: false,
  error: undefined,
  load: () => {},
  show: () => {},
});
let isNativeSdkAvailable = false;

try {
  const sdk = require("react-native-google-mobile-ads");
  if (sdk && typeof sdk.useRewardedAd === "function") {
    sdkUseRewardedAd = sdk.useRewardedAd;
    isNativeSdkAvailable = true;
  }
} catch {
  // Native module not linked (Expo Go)
}

// ── ATT permission (iOS only, once per session) ──────────────────────────────
const attRequestedRef = { value: false };

async function requestATTPermissionOnce(): Promise<void> {
  if (Platform.OS !== "ios" || attRequestedRef.value) return;
  attRequestedRef.value = true;
  try {
    const { requestTrackingPermissionsAsync } = require(
      "expo-tracking-transparency"
    );
    await requestTrackingPermissionsAsync();
  } catch {
    // Package unavailable or permission call failed — continue regardless.
    // ATT is advisory; ads still work when permission is denied.
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useRewardedAd() {
  // Bridge between the reactive hook state and the imperative Promise API
  const resolverRef = useRef<((result: RewardedAdResult) => void) | null>(null);
  const pendingShowRef = useRef(false);

  const adUnitId = isNativeSdkAvailable ? getAdUnitId() : null;

  const {
    isLoaded,
    isClosed,
    isEarnedReward,
    error,
    load,
    show,
  } = sdkUseRewardedAd(adUnitId, { requestNonPersonalizedAdsOnly: true });

  // One-time setup: initialise AdMob, request ATT, then load the first ad.
  // Also clears the safety timer on unmount.
  useEffect(() => {
    if (!isNativeSdkAvailable) return;
    (async () => {
      try {
        const { MobileAds } = require("react-native-google-mobile-ads");
        await MobileAds().initialize();
      } catch {
        // Initialization failure is non-fatal
      }
      await requestATTPermissionOnce();
      load();
    })();
    return () => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the ad is loaded and a show was requested before it finished loading,
  // trigger the show now.
  useEffect(() => {
    if (isLoaded && pendingShowRef.current) {
      pendingShowRef.current = false;
      show();
    }
  }, [isLoaded, show]);

  // Ad closed — resolve the pending promise with reward status
  useEffect(() => {
    if (isClosed && resolverRef.current) {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve({ granted: isEarnedReward ?? false });
      // Reload so the ad is ready for the next session / next game
      load();
    }
  }, [isClosed, isEarnedReward, load]);

  // Ad failed — resolve pending promise with false
  useEffect(() => {
    if (error && resolverRef.current) {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve({ granted: false });
      // Attempt a reload after error
      try {
        load();
      } catch {}
    }
  }, [error, load]);

  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watchAd = useCallback((): Promise<RewardedAdResult> => {
    // ── Stub path: native SDK not linked (Expo Go) ──────────────────────
    if (!isNativeSdkAvailable) {
      return new Promise((resolve) => setTimeout(() => resolve({ granted: false }), 500));
    }

    // ── Real AdMob path ─────────────────────────────────────────────────
    return new Promise<RewardedAdResult>((resolve) => {
      resolverRef.current = resolve;

      if (isLoaded) {
        // Ad already pre-loaded — show immediately
        show();
      } else {
        // Ad not ready yet — trigger show once it loads (handled by effect above)
        pendingShowRef.current = true;
        load();

        // Safety timeout: resolve false if the ad never loads within 10 s
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
          safetyTimerRef.current = null;
          if (resolverRef.current === resolve) {
            pendingShowRef.current = false;
            resolverRef.current = null;
            resolve({ granted: false });
          }
        }, 10_000);
      }
    });
  }, [isLoaded, load, show]);

  return {
    isAdReady: isLoaded,
    watchAd,
    showRewardedAd: watchAd,
  };
}

export interface RewardedAdResult {
  granted: boolean;
}

export function useRewardedAd() {
  const watchAd = async (): Promise<RewardedAdResult> => {
    // Web does not support AdMob; resolve false so the game goes to results.
    return { granted: false };
  };

  return { isAdReady: false, watchAd, showRewardedAd: watchAd };
}

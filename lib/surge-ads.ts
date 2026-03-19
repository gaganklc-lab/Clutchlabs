export interface RewardedAdResult {
  granted: boolean;
}

export function useRewardedAd() {
  const watchAd = async (): Promise<RewardedAdResult> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    return { granted: true };
  };

  return { isAdReady: true, watchAd, showRewardedAd: watchAd };
}

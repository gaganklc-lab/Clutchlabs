export interface RewardedAdResult {
  granted: boolean;
}

export function useRewardedAd() {
  const isAdReady = true;

  const watchAd = async (): Promise<RewardedAdResult> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    return { granted: true };
  };

  const showRewardedAd = watchAd;

  return { isAdReady, watchAd, showRewardedAd };
}

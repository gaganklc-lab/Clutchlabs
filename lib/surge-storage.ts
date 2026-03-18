import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  BEST_SCORE_CLASSIC:   "surge_best_score_classic",
  BEST_SCORE_ENDLESS:   "surge_best_score_endless",
  LEADERBOARD_CLASSIC:  "surge_leaderboard_classic",
  LEADERBOARD_ENDLESS:  "surge_leaderboard_endless",
  TOTAL_XP:             "surge_total_xp",
  GAME_MODE:            "surge_game_mode",
  SETTINGS:             "surge_settings",
};

export interface SurgeLeaderboardEntry {
  id: string;
  score: number;
  maxCombo: number;
  perfectHits: number;
  date: string;
  rank?: string;
}

export interface SurgeSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: SurgeSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
};

export type SurgeGameMode = "classic" | "endless";

export async function getSurgeBestScore(mode: SurgeGameMode): Promise<number> {
  const key = mode === "classic" ? KEYS.BEST_SCORE_CLASSIC : KEYS.BEST_SCORE_ENDLESS;
  const val = await AsyncStorage.getItem(key);
  return val ? parseInt(val, 10) : 0;
}

export async function setSurgeBestScore(score: number, mode: SurgeGameMode): Promise<void> {
  const current = await getSurgeBestScore(mode);
  if (score > current) {
    const key = mode === "classic" ? KEYS.BEST_SCORE_CLASSIC : KEYS.BEST_SCORE_ENDLESS;
    await AsyncStorage.setItem(key, score.toString());
  }
}

export async function getSurgeLeaderboard(mode: SurgeGameMode): Promise<SurgeLeaderboardEntry[]> {
  const key = mode === "classic" ? KEYS.LEADERBOARD_CLASSIC : KEYS.LEADERBOARD_ENDLESS;
  const val = await AsyncStorage.getItem(key);
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export async function addSurgeLeaderboardEntry(
  entry: SurgeLeaderboardEntry,
  mode: SurgeGameMode
): Promise<SurgeLeaderboardEntry[]> {
  const leaderboard = await getSurgeLeaderboard(mode);
  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score);
  const trimmed = leaderboard.slice(0, 20);
  const key = mode === "classic" ? KEYS.LEADERBOARD_CLASSIC : KEYS.LEADERBOARD_ENDLESS;
  await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  return trimmed;
}

export async function getSurgeTotalXP(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.TOTAL_XP);
  return val ? parseInt(val, 10) : 0;
}

export async function addSurgeXP(amount: number): Promise<number> {
  const current = await getSurgeTotalXP();
  const updated = current + amount;
  await AsyncStorage.setItem(KEYS.TOTAL_XP, updated.toString());
  return updated;
}

export async function getSurgeGameMode(): Promise<SurgeGameMode> {
  const val = await AsyncStorage.getItem(KEYS.GAME_MODE);
  return (val as SurgeGameMode) || "classic";
}

export async function saveSurgeGameMode(mode: SurgeGameMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.GAME_MODE, mode);
}

export async function getSurgeSettings(): Promise<SurgeSettings> {
  const val = await AsyncStorage.getItem(KEYS.SETTINGS);
  return val ? { ...DEFAULT_SETTINGS, ...JSON.parse(val) } : DEFAULT_SETTINGS;
}

export async function saveSurgeSettings(settings: SurgeSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

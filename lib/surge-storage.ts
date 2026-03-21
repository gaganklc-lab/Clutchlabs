import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  BEST_SCORE_CLASSIC:       "surge_best_score_classic",
  BEST_SCORE_ENDLESS:       "surge_best_score_endless",
  BEST_SCORE_RUSH:          "surge_best_score_rush",
  LEADERBOARD_CLASSIC:      "surge_leaderboard_classic",
  LEADERBOARD_ENDLESS:      "surge_leaderboard_endless",
  LEADERBOARD_RUSH:         "surge_leaderboard_rush",
  TOTAL_XP:                 "surge_total_xp",
  GAME_MODE:                "surge_game_mode",
  SETTINGS:                 "surge_settings",
  POWER_UPS:                "surge_power_ups",
  STREAK:                   "surge_streak_data",
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

export type SurgePowerUpType = "slow_ring" | "extra_life" | "double_score";

export interface SurgePowerUpInventory {
  slow_ring: number;
  extra_life: number;
  double_score: number;
}

const DEFAULT_SETTINGS: SurgeSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
};

const DEFAULT_POWER_UPS: SurgePowerUpInventory = {
  slow_ring: 0,
  extra_life: 0,
  double_score: 0,
};

export type SurgeGameMode = "classic" | "endless" | "rush" | "daily";

function bestScoreKey(mode: SurgeGameMode): string {
  if (mode === "endless") return KEYS.BEST_SCORE_ENDLESS;
  if (mode === "rush") return KEYS.BEST_SCORE_RUSH;
  return KEYS.BEST_SCORE_CLASSIC;
}

function leaderboardKey(mode: SurgeGameMode): string {
  if (mode === "endless") return KEYS.LEADERBOARD_ENDLESS;
  if (mode === "rush") return KEYS.LEADERBOARD_RUSH;
  return KEYS.LEADERBOARD_CLASSIC;
}

export async function getSurgeBestScore(mode: SurgeGameMode): Promise<number> {
  const val = await AsyncStorage.getItem(bestScoreKey(mode));
  return val ? parseInt(val, 10) : 0;
}

export async function setSurgeBestScore(score: number, mode: SurgeGameMode): Promise<void> {
  const current = await getSurgeBestScore(mode);
  if (score > current) {
    await AsyncStorage.setItem(bestScoreKey(mode), score.toString());
  }
}

export async function getSurgeLeaderboard(mode: SurgeGameMode): Promise<SurgeLeaderboardEntry[]> {
  const val = await AsyncStorage.getItem(leaderboardKey(mode));
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
  await AsyncStorage.setItem(leaderboardKey(mode), JSON.stringify(trimmed));
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

export async function getSurgePowerUps(): Promise<SurgePowerUpInventory> {
  const val = await AsyncStorage.getItem(KEYS.POWER_UPS);
  if (!val) return { ...DEFAULT_POWER_UPS };
  try {
    return { ...DEFAULT_POWER_UPS, ...JSON.parse(val) };
  } catch {
    return { ...DEFAULT_POWER_UPS };
  }
}

export async function saveSurgePowerUps(inventory: SurgePowerUpInventory): Promise<void> {
  await AsyncStorage.setItem(KEYS.POWER_UPS, JSON.stringify(inventory));
}

export async function consumeSurgePowerUp(type: SurgePowerUpType): Promise<{ success: boolean; remaining: number }> {
  const inventory = await getSurgePowerUps();
  if (inventory[type] <= 0) {
    return { success: false, remaining: 0 };
  }
  inventory[type] -= 1;
  await saveSurgePowerUps(inventory);
  return { success: true, remaining: inventory[type] };
}

export async function earnSurgePowerUp(type: SurgePowerUpType, amount: number = 1): Promise<SurgePowerUpInventory> {
  const inventory = await getSurgePowerUps();
  inventory[type] += amount;
  await saveSurgePowerUps(inventory);
  return inventory;
}

export function totalPowerUps(inv: SurgePowerUpInventory): number {
  return inv.slow_ring + inv.extra_life + inv.double_score;
}

export interface SurgeStreakData {
  current: number;
  best: number;
  lastPlayedDate: string;
}

export async function getStreak(): Promise<SurgeStreakData> {
  const val = await AsyncStorage.getItem(KEYS.STREAK);
  if (!val) return { current: 0, best: 0, lastPlayedDate: "" };
  try {
    return JSON.parse(val) as SurgeStreakData;
  } catch {
    return { current: 0, best: 0, lastPlayedDate: "" };
  }
}

export async function recordPlayToday(): Promise<SurgeStreakData> {
  const today = new Date().toISOString().slice(0, 10);
  const streak = await getStreak();

  if (streak.lastPlayedDate === today) {
    return streak;
  }

  const msPerDay = 86400000;
  const yesterday = new Date(Date.now() - msPerDay).toISOString().slice(0, 10);

  if (streak.lastPlayedDate === yesterday) {
    streak.current += 1;
  } else if (!streak.lastPlayedDate) {
    streak.current = 1;
  } else {
    streak.current = 1;
  }

  if (streak.current > streak.best) streak.best = streak.current;
  streak.lastPlayedDate = today;
  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
  return streak;
}

export const updateStreakOnPlay = recordPlayToday;

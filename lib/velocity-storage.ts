import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameMode } from "@/constants/game";

const KEYS = {
  BEST_SCORE: "velocity_best_score",
  LEADERBOARD: "velocity_leaderboard",
  TOTAL_XP: "velocity_total_xp",
  GAME_MODE: "velocity_game_mode",
  LOGIN_STREAK: "velocity_login_streak",
  LAST_LOGIN_DATE: "velocity_last_login_date",
  LAST_REWARD_DATE: "velocity_last_reward_date",
  GAME_STATS: "velocity_game_stats",
  ENDLESS_BEST: "velocity_endless_best",
  SETTINGS: "velocity_settings",
  DIFFICULTY: "velocity_difficulty",
  POWERUPS: "velocity_powerups",
};

export interface LeaderboardEntry {
  id: string;
  score: number;
  combo: number;
  avgReaction: number;
  date: string;
  rank?: string;
}

export interface VelocitySettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: VelocitySettings = {
  soundEnabled: true,
  hapticsEnabled: true,
};

export interface VelocityGameStats {
  totalGames: number;
  totalPlayTimeSec: number;
  bestByMode: Record<string, number>;
  gamesToday: number;
  gamesTodayDate: string;
  gamesThisWeek: number;
  weekStart: string;
}

const DEFAULT_GAME_STATS: VelocityGameStats = {
  totalGames: 0,
  totalPlayTimeSec: 0,
  bestByMode: {},
  gamesToday: 0,
  gamesTodayDate: "",
  gamesThisWeek: 0,
  weekStart: "",
};

export type VelocityDifficulty = "easy" | "normal" | "hard";

export interface VelocityPowerUpInventory {
  shield: number;
  slow_mo: number;
}

const DEFAULT_POWERUPS: VelocityPowerUpInventory = { shield: 0, slow_mo: 0 };

export async function getBestScore(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.BEST_SCORE);
  return val ? parseInt(val, 10) : 0;
}

export async function setBestScore(score: number): Promise<void> {
  const current = await getBestScore();
  if (score > current) {
    await AsyncStorage.setItem(KEYS.BEST_SCORE, score.toString());
  }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const val = await AsyncStorage.getItem(KEYS.LEADERBOARD);
  return val ? JSON.parse(val) : [];
}

export async function addLeaderboardEntry(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  const leaderboard = await getLeaderboard();
  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score);
  const trimmed = leaderboard.slice(0, 20);
  await AsyncStorage.setItem(KEYS.LEADERBOARD, JSON.stringify(trimmed));
  return trimmed;
}

export async function getTotalXP(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.TOTAL_XP);
  return val ? parseInt(val, 10) : 0;
}

export async function addXP(amount: number): Promise<number> {
  const current = await getTotalXP();
  const updated = current + amount;
  await AsyncStorage.setItem(KEYS.TOTAL_XP, updated.toString());
  return updated;
}

export async function getGameMode(): Promise<GameMode> {
  const val = await AsyncStorage.getItem(KEYS.GAME_MODE);
  return (val as GameMode) || "regular";
}

export async function saveGameMode(mode: GameMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.GAME_MODE, mode);
}

export async function getDifficulty(): Promise<VelocityDifficulty> {
  const val = await AsyncStorage.getItem(KEYS.DIFFICULTY);
  return (val as VelocityDifficulty) || "normal";
}

export async function saveDifficulty(difficulty: VelocityDifficulty): Promise<void> {
  await AsyncStorage.setItem(KEYS.DIFFICULTY, difficulty);
}

export async function getVelocityPowerUps(): Promise<VelocityPowerUpInventory> {
  const val = await AsyncStorage.getItem(KEYS.POWERUPS);
  return val ? { ...DEFAULT_POWERUPS, ...JSON.parse(val) } : { ...DEFAULT_POWERUPS };
}

export async function saveVelocityPowerUps(inventory: VelocityPowerUpInventory): Promise<void> {
  await AsyncStorage.setItem(KEYS.POWERUPS, JSON.stringify(inventory));
}

export async function useVelocityPowerUp(type: keyof VelocityPowerUpInventory): Promise<boolean> {
  const inventory = await getVelocityPowerUps();
  if (inventory[type] <= 0) return false;
  inventory[type] -= 1;
  await saveVelocityPowerUps(inventory);
  return true;
}

export async function earnVelocityPowerUp(type: keyof VelocityPowerUpInventory): Promise<void> {
  const inventory = await getVelocityPowerUps();
  inventory[type] += 1;
  await saveVelocityPowerUps(inventory);
}

export async function getSettings(): Promise<VelocitySettings> {
  const val = await AsyncStorage.getItem(KEYS.SETTINGS);
  return val ? { ...DEFAULT_SETTINGS, ...JSON.parse(val) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: VelocitySettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getLoginStreak(): Promise<{ streak: number; lastDate: string; lastRewardDate: string }> {
  const streak = await AsyncStorage.getItem(KEYS.LOGIN_STREAK);
  const lastDate = await AsyncStorage.getItem(KEYS.LAST_LOGIN_DATE);
  const lastRewardDate = await AsyncStorage.getItem(KEYS.LAST_REWARD_DATE);
  return {
    streak: streak ? parseInt(streak, 10) : 0,
    lastDate: lastDate || "",
    lastRewardDate: lastRewardDate || "",
  };
}

export async function checkAndUpdateLoginStreak(): Promise<{
  streak: number;
  rewardXP: number;
  isNewDay: boolean;
  milestoneBonus: number;
  milestoneLabel: string;
}> {
  const { DAILY_REWARDS, STREAK_MILESTONES } = await import("@/constants/game");
  const today = new Date().toISOString().split("T")[0];
  const loginData = await getLoginStreak();

  if (loginData.lastRewardDate === today) {
    return { streak: loginData.streak, rewardXP: 0, isNewDay: false, milestoneBonus: 0, milestoneLabel: "" };
  }

  let newStreak = 1;
  if (loginData.lastDate) {
    const last = new Date(loginData.lastDate);
    const now = new Date(today);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      newStreak = loginData.streak + 1;
    } else if (diffDays === 0) {
      newStreak = loginData.streak;
    }
  }

  const rewardDay = (newStreak - 1) % DAILY_REWARDS.length;
  const rewardXP = DAILY_REWARDS[rewardDay];

  let milestoneBonus = 0;
  let milestoneLabel = "";
  for (const m of STREAK_MILESTONES) {
    if (newStreak === m.days) {
      milestoneBonus = m.bonusXP;
      milestoneLabel = m.label;
      break;
    }
  }

  await AsyncStorage.setItem(KEYS.LOGIN_STREAK, newStreak.toString());
  await AsyncStorage.setItem(KEYS.LAST_LOGIN_DATE, today);
  await AsyncStorage.setItem(KEYS.LAST_REWARD_DATE, today);
  await addXP(rewardXP + milestoneBonus);

  return { streak: newStreak, rewardXP, isNewDay: true, milestoneBonus, milestoneLabel };
}

export async function updateGameStats(
  score: number,
  _accuracy: number,
  _difficulty: string,
  mode: string,
  durationSec: number
): Promise<VelocityGameStats> {
  const stats = await getGameStats();
  const today = new Date().toISOString().split("T")[0];

  stats.totalGames++;
  stats.totalPlayTimeSec += durationSec;

  if (!stats.bestByMode[mode] || score > stats.bestByMode[mode]) {
    stats.bestByMode[mode] = score;
  }

  if (stats.gamesTodayDate === today) {
    stats.gamesToday++;
  } else {
    stats.gamesToday = 1;
    stats.gamesTodayDate = today;
  }

  const now = new Date();
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStartDate.toISOString().split("T")[0];

  if (stats.weekStart === weekStartStr) {
    stats.gamesThisWeek++;
  } else {
    stats.gamesThisWeek = 1;
    stats.weekStart = weekStartStr;
  }

  await AsyncStorage.setItem(KEYS.GAME_STATS, JSON.stringify(stats));

  await setBestScore(score);

  return stats;
}

export async function getGameStats(): Promise<VelocityGameStats> {
  const val = await AsyncStorage.getItem(KEYS.GAME_STATS);
  return val ? { ...DEFAULT_GAME_STATS, ...JSON.parse(val) } : DEFAULT_GAME_STATS;
}

export async function getEndlessBest(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.ENDLESS_BEST);
  return val ? parseInt(val, 10) : 0;
}

export async function setEndlessBest(score: number): Promise<void> {
  const current = await getEndlessBest();
  if (score > current) {
    await AsyncStorage.setItem(KEYS.ENDLESS_BEST, score.toString());
  }
}

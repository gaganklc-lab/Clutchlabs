import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BadgeStats, Difficulty, GameMode, PowerUpType } from "@/constants/game";

const KEYS = {
  BEST_SCORE: "clutchtap_best_score",
  LEADERBOARD: "clutchtap_leaderboard",
  BADGE_STATS: "clutchtap_badge_stats",
  SETTINGS: "clutchtap_settings",
  UNLOCKED_BADGES: "clutchtap_unlocked_badges",
  LAST_PLAYED: "clutchtap_last_played",
  DIFFICULTY: "clutchtap_difficulty",
  TOTAL_XP: "clutchtap_total_xp",
  DAILY_BEST: "clutchtap_daily_best",
  DAILY_DATE: "clutchtap_daily_date",
  GAME_MODE: "clutchtap_game_mode",
  TILE_THEME: "clutchtap_tile_theme",
  LOGIN_STREAK: "clutchtap_login_streak",
  LAST_LOGIN_DATE: "clutchtap_last_login_date",
  LAST_REWARD_DATE: "clutchtap_last_reward_date",
  POWER_UPS: "clutchtap_power_ups",
  GAME_STATS: "clutchtap_game_stats",
  ENDLESS_BEST: "clutchtap_endless_best",
};

export interface LeaderboardEntry {
  id: string;
  score: number;
  combo: number;
  avgReaction: number;
  date: string;
}

export interface GameSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
};

const DEFAULT_BADGE_STATS: BadgeStats = {
  totalGames: 0,
  bestScore: 0,
  totalScore: 0,
  bestCombo: 0,
  perfectRounds: 0,
  fastestReaction: 0,
  gamesWithoutMistake: 0,
  currentStreak: 0,
  longestStreak: 0,
};

export async function getBestScore(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.BEST_SCORE);
  return val ? parseInt(val, 10) : 0;
}

export async function setBestScore(score: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.BEST_SCORE, score.toString());
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

export async function getSettings(): Promise<GameSettings> {
  const val = await AsyncStorage.getItem(KEYS.SETTINGS);
  return val ? { ...DEFAULT_SETTINGS, ...JSON.parse(val) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getBadgeStats(): Promise<BadgeStats> {
  const val = await AsyncStorage.getItem(KEYS.BADGE_STATS);
  return val ? { ...DEFAULT_BADGE_STATS, ...JSON.parse(val) } : DEFAULT_BADGE_STATS;
}

export async function updateBadgeStats(
  update: Partial<BadgeStats>
): Promise<BadgeStats> {
  const current = await getBadgeStats();
  const updated = { ...current, ...update };
  await AsyncStorage.setItem(KEYS.BADGE_STATS, JSON.stringify(updated));
  return updated;
}

export async function getUnlockedBadges(): Promise<string[]> {
  const val = await AsyncStorage.getItem(KEYS.UNLOCKED_BADGES);
  return val ? JSON.parse(val) : [];
}

export async function unlockBadge(badgeId: string): Promise<string[]> {
  const unlocked = await getUnlockedBadges();
  if (!unlocked.includes(badgeId)) {
    unlocked.push(badgeId);
    await AsyncStorage.setItem(KEYS.UNLOCKED_BADGES, JSON.stringify(unlocked));
  }
  return unlocked;
}

export async function getDifficulty(): Promise<Difficulty> {
  const val = await AsyncStorage.getItem(KEYS.DIFFICULTY);
  return (val as Difficulty) || "normal";
}

export async function saveDifficulty(difficulty: Difficulty): Promise<void> {
  await AsyncStorage.setItem(KEYS.DIFFICULTY, difficulty);
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

export async function getDailyBest(): Promise<{ score: number; date: string }> {
  const date = await AsyncStorage.getItem(KEYS.DAILY_DATE);
  const score = await AsyncStorage.getItem(KEYS.DAILY_BEST);
  const today = new Date().toISOString().split("T")[0];

  if (date !== today) {
    return { score: 0, date: today };
  }
  return { score: score ? parseInt(score, 10) : 0, date: today };
}

export async function setDailyBest(score: number): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const current = await getDailyBest();
  if (score > current.score) {
    await AsyncStorage.setItem(KEYS.DAILY_BEST, score.toString());
    await AsyncStorage.setItem(KEYS.DAILY_DATE, today);
  }
}

export async function updateStreakOnGameEnd(): Promise<{ currentStreak: number; longestStreak: number }> {
  const lastPlayed = await AsyncStorage.getItem(KEYS.LAST_PLAYED);
  const stats = await getBadgeStats();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  let newStreak = stats.currentStreak;

  if (lastPlayed) {
    const lastDate = new Date(lastPlayed);
    const diffMs = now.getTime() - lastDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      newStreak = stats.currentStreak + 1;
    } else if (diffHours < 48) {
      newStreak = stats.currentStreak + 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(stats.longestStreak, newStreak);

  await AsyncStorage.setItem(KEYS.LAST_PLAYED, today);
  await updateBadgeStats({ currentStreak: newStreak, longestStreak });

  return { currentStreak: newStreak, longestStreak };
}

export async function getGameMode(): Promise<GameMode> {
  const val = await AsyncStorage.getItem(KEYS.GAME_MODE);
  return (val as GameMode) || "regular";
}

export async function saveGameMode(mode: GameMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.GAME_MODE, mode);
}

export async function getTileTheme(): Promise<string> {
  const val = await AsyncStorage.getItem(KEYS.TILE_THEME);
  return val || "default";
}

export async function saveTileTheme(themeId: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.TILE_THEME, themeId);
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

  const rewardDay = ((newStreak - 1) % DAILY_REWARDS.length);
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

export interface PowerUpInventory {
  shield: number;
  time_freeze: number;
  double_points: number;
}

export async function getPowerUps(): Promise<PowerUpInventory> {
  const val = await AsyncStorage.getItem(KEYS.POWER_UPS);
  return val ? JSON.parse(val) : { shield: 1, time_freeze: 1, double_points: 1 };
}

export async function savePowerUps(inventory: PowerUpInventory): Promise<void> {
  await AsyncStorage.setItem(KEYS.POWER_UPS, JSON.stringify(inventory));
}

export async function usePowerUp(type: PowerUpType): Promise<boolean> {
  const inventory = await getPowerUps();
  if (inventory[type] <= 0) return false;
  inventory[type]--;
  await savePowerUps(inventory);
  return true;
}

export async function earnPowerUp(type: PowerUpType): Promise<void> {
  const inventory = await getPowerUps();
  inventory[type] = Math.min(inventory[type] + 1, 3);
  await savePowerUps(inventory);
}

export interface GameStats {
  totalGames: number;
  totalPlayTimeSec: number;
  bestByDifficulty: Record<string, number>;
  bestByMode: Record<string, number>;
  gamesToday: number;
  gamesTodayDate: string;
  gamesThisWeek: number;
  weekStart: string;
  accuracyHistory: number[];
}

const DEFAULT_GAME_STATS: GameStats = {
  totalGames: 0,
  totalPlayTimeSec: 0,
  bestByDifficulty: {},
  bestByMode: {},
  gamesToday: 0,
  gamesTodayDate: "",
  gamesThisWeek: 0,
  weekStart: "",
  accuracyHistory: [],
};

export async function getGameStats(): Promise<GameStats> {
  const val = await AsyncStorage.getItem(KEYS.GAME_STATS);
  return val ? { ...DEFAULT_GAME_STATS, ...JSON.parse(val) } : DEFAULT_GAME_STATS;
}

export async function updateGameStats(score: number, accuracy: number, difficulty: string, mode: string, durationSec: number): Promise<GameStats> {
  const stats = await getGameStats();
  const today = new Date().toISOString().split("T")[0];

  stats.totalGames++;
  stats.totalPlayTimeSec += durationSec;

  if (!stats.bestByDifficulty[difficulty] || score > stats.bestByDifficulty[difficulty]) {
    stats.bestByDifficulty[difficulty] = score;
  }
  if (!stats.bestByMode[mode] || score > stats.bestByMode[mode]) {
    stats.bestByMode[mode] = score;
  }

  if (stats.gamesTodayDate === today) {
    stats.gamesToday++;
  } else {
    stats.gamesToday = 1;
    stats.gamesTodayDate = today;
  }

  stats.accuracyHistory.push(accuracy);
  if (stats.accuracyHistory.length > 50) {
    stats.accuracyHistory = stats.accuracyHistory.slice(-50);
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = weekStartDate.toISOString().split("T")[0];

  if (stats.weekStart === weekStartStr) {
    stats.gamesThisWeek++;
  } else {
    stats.gamesThisWeek = 1;
    stats.weekStart = weekStartStr;
  }

  await AsyncStorage.setItem(KEYS.GAME_STATS, JSON.stringify(stats));
  return stats;
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

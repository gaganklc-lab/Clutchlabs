import Colors from "./colors";

export type Difficulty = "easy" | "normal" | "hard";
export type GameMode = "regular" | "endless" | "zen";

export interface TileTheme {
  id: string;
  name: string;
  icon: string;
  unlockLevel: number;
  colors: { blue: string; red: string; green: string; yellow: string; orange: string; purple: string };
}

export const TILE_THEMES: TileTheme[] = [
  { id: "default", name: "Default", icon: "color-palette", unlockLevel: 1, colors: { blue: Colors.tileBlue, red: Colors.tileRed, green: Colors.tileGreen, yellow: Colors.tileYellow, orange: Colors.tileOrange, purple: Colors.tilePurple } },
  { id: "neon", name: "Neon", icon: "flash", unlockLevel: 3, colors: Colors.themeNeon },
  { id: "pastel", name: "Pastel", icon: "flower", unlockLevel: 5, colors: Colors.themePastel },
  { id: "earth", name: "Earth", icon: "leaf", unlockLevel: 8, colors: Colors.themeEarth },
  { id: "candy", name: "Candy", icon: "heart", unlockLevel: 12, colors: Colors.themeCandy },
  { id: "midnight", name: "Midnight", icon: "moon", unlockLevel: 16, colors: Colors.themeMidnight },
];

export type PowerUpType = "shield" | "time_freeze" | "double_points";

export interface PowerUpDef {
  type: PowerUpType;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const POWER_UPS: PowerUpDef[] = [
  { type: "shield", name: "Shield", icon: "shield", color: "#FFD700", description: "Absorbs one wrong tap" },
  { type: "time_freeze", name: "Time Freeze", icon: "snow", color: "#00BFFF", description: "Pauses timer for 3s" },
  { type: "double_points", name: "2x Points", icon: "flash", color: "#00E676", description: "Double score for 5s" },
];

export const DAILY_REWARDS = [25, 50, 75, 100, 150, 200, 300];

export const STREAK_MILESTONES = [
  { days: 3, bonusXP: 50, label: "3-Day Streak" },
  { days: 7, bonusXP: 150, label: "Week Warrior" },
  { days: 14, bonusXP: 300, label: "Two Week Titan" },
  { days: 30, bonusXP: 500, label: "Monthly Master" },
];

export const MODE_CONFIGS: Record<GameMode, { label: string; icon: string; color: string; description: string }> = {
  regular: { label: "Regular", icon: "timer", color: Colors.primary, description: "Race the clock" },
  endless: { label: "Endless", icon: "infinite", color: Colors.accent, description: "No timer, ramps up" },
  zen: { label: "Zen", icon: "leaf", color: Colors.success, description: "Practice & relax" },
};

export interface DifficultyConfig {
  label: string;
  duration: number;
  lives: number;
  ruleChangeInterval: number;
  tileChangeIntervalStart: number;
  tileChangeIntervalMin: number;
  color: string;
  icon: string;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "Easy",
    duration: 45,
    lives: 4,
    ruleChangeInterval: 5000,
    tileChangeIntervalStart: 2500,
    tileChangeIntervalMin: 1000,
    color: Colors.success,
    icon: "leaf",
  },
  normal: {
    label: "Normal",
    duration: 30,
    lives: 3,
    ruleChangeInterval: 4000,
    tileChangeIntervalStart: 2000,
    tileChangeIntervalMin: 800,
    color: Colors.warning,
    icon: "flash",
  },
  hard: {
    label: "Hard",
    duration: 20,
    lives: 2,
    ruleChangeInterval: 3000,
    tileChangeIntervalStart: 1500,
    tileChangeIntervalMin: 600,
    color: Colors.error,
    icon: "flame",
  },
};

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY_CONFIGS[difficulty];
}

export const GAME_DURATION = 30;
export const INITIAL_LIVES = 3;
export const RULE_CHANGE_INTERVAL = 4000;
export const TILE_CHANGE_INTERVAL_START = 2000;
export const TILE_CHANGE_INTERVAL_MIN = 800;
export const GRID_COLS = 3;
export const GRID_ROWS = 4;
export const TILE_COUNT = GRID_COLS * GRID_ROWS;
export const COMBO_MULTIPLIER_STEP = 0.5;
export const MAX_COMBO_MULTIPLIER = 5;
export const FLASH_INTERVAL = 300;

export interface TileColor {
  name: string;
  color: string;
  key: string;
}

export const TILE_COLORS: TileColor[] = [
  { name: "BLUE", color: Colors.tileBlue, key: "blue" },
  { name: "RED", color: Colors.tileRed, key: "red" },
  { name: "GREEN", color: Colors.tileGreen, key: "green" },
  { name: "YELLOW", color: Colors.tileYellow, key: "yellow" },
  { name: "ORANGE", color: Colors.tileOrange, key: "orange" },
  { name: "PURPLE", color: Colors.tilePurple, key: "purple" },
];

export type RuleType = "tap_color" | "tap_not_color" | "tap_flashing";

export interface GameRule {
  type: RuleType;
  targetColor?: TileColor;
  displayText: string;
}

export function generateRule(previousRule?: GameRule): GameRule {
  const ruleTypes: RuleType[] = ["tap_color", "tap_color", "tap_not_color", "tap_flashing"];
  let ruleType: RuleType;

  do {
    ruleType = ruleTypes[Math.floor(Math.random() * ruleTypes.length)];
  } while (previousRule && ruleType === previousRule.type && previousRule.targetColor?.key === undefined);

  if (ruleType === "tap_flashing") {
    return {
      type: "tap_flashing",
      displayText: "Tap the FLASHING tile",
    };
  }

  let targetColor: TileColor;
  do {
    targetColor = TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)];
  } while (previousRule?.targetColor?.key === targetColor.key);

  if (ruleType === "tap_color") {
    return {
      type: "tap_color",
      targetColor,
      displayText: `Tap ${targetColor.name}`,
    };
  }

  return {
    type: "tap_not_color",
    targetColor,
    displayText: `Tap NOT ${targetColor.name}`,
  };
}

export function generateTileColors(themeId?: string): TileColor[] {
  const theme = themeId ? TILE_THEMES.find((t) => t.id === themeId) : undefined;
  const colors = theme ? getThemedTileColors(theme) : TILE_COLORS;
  const tiles: TileColor[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    tiles.push(colors[Math.floor(Math.random() * colors.length)]);
  }
  return tiles;
}

export function getThemedTileColors(theme: TileTheme): TileColor[] {
  return [
    { name: "BLUE", color: theme.colors.blue, key: "blue" },
    { name: "RED", color: theme.colors.red, key: "red" },
    { name: "GREEN", color: theme.colors.green, key: "green" },
    { name: "YELLOW", color: theme.colors.yellow, key: "yellow" },
    { name: "ORANGE", color: theme.colors.orange, key: "orange" },
    { name: "PURPLE", color: theme.colors.purple, key: "purple" },
  ];
}

export function isTapCorrect(
  rule: GameRule,
  tileIndex: number,
  tiles: TileColor[],
  flashingIndex: number | null
): boolean {
  const tile = tiles[tileIndex];

  switch (rule.type) {
    case "tap_color":
      return tile.key === rule.targetColor!.key;
    case "tap_not_color":
      return tile.key !== rule.targetColor!.key;
    case "tap_flashing":
      return tileIndex === flashingIndex;
    default:
      return false;
  }
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconFamily: "Ionicons" | "MaterialCommunityIcons" | "Feather";
  condition: (stats: BadgeStats) => boolean;
}

export interface BadgeStats {
  totalGames: number;
  bestScore: number;
  totalScore: number;
  bestCombo: number;
  perfectRounds: number;
  fastestReaction: number;
  gamesWithoutMistake: number;
  currentStreak: number;
  longestStreak: number;
}

export type PerformanceRank = "S" | "A" | "B" | "C" | "D";

export interface RankInfo {
  rank: PerformanceRank;
  label: string;
  color: string;
  description: string;
}

export function calculateRank(score: number, accuracy: number, maxCombo: number, difficulty: Difficulty): RankInfo {
  const diffMultiplier = difficulty === "hard" ? 1.3 : difficulty === "easy" ? 0.8 : 1.0;
  const adjustedScore = score * diffMultiplier;
  const comboBonus = maxCombo * 2;
  const accuracyBonus = accuracy * 0.5;
  const total = adjustedScore + comboBonus + accuracyBonus;

  if (total >= 200 && accuracy >= 90) return { rank: "S", label: "SUPERB", color: Colors.rankS, description: "Legendary performance!" };
  if (total >= 140 && accuracy >= 75) return { rank: "A", label: "AWESOME", color: Colors.rankA, description: "Outstanding reflexes!" };
  if (total >= 80 && accuracy >= 60) return { rank: "B", label: "GREAT", color: Colors.rankB, description: "Solid performance!" };
  if (total >= 40) return { rank: "C", label: "OKAY", color: Colors.rankC, description: "Room to improve!" };
  return { rank: "D", label: "TRY AGAIN", color: Colors.rankD, description: "Keep practicing!" };
}

export const XP_PER_POINT = 1;
export const XP_BONUS_PERFECT = 50;
export const XP_BONUS_S_RANK = 30;

export interface LevelInfo {
  level: number;
  currentXP: number;
  xpForNext: number;
  progress: number;
  title: string;
}

const LEVEL_TITLES = [
  "Beginner", "Novice", "Tapper", "Quick Fingers", "Sharp Eye",
  "Reflex Hero", "Speed Demon", "Combo Master", "Elite Tapper", "Legend",
  "Grandmaster", "Untouchable", "Mythic", "Transcendent", "Godlike",
];

export function getLevelInfo(totalXP: number): LevelInfo {
  let level = 1;
  let remaining = totalXP;
  let xpForNext = 100;

  while (remaining >= xpForNext && level < 99) {
    remaining -= xpForNext;
    level++;
    xpForNext = Math.floor(100 * Math.pow(1.15, level - 1));
  }

  const progress = xpForNext > 0 ? remaining / xpForNext : 1;
  const titleIndex = Math.min(Math.floor((level - 1) / 3), LEVEL_TITLES.length - 1);

  return {
    level,
    currentXP: remaining,
    xpForNext,
    progress: Math.min(progress, 1),
    title: LEVEL_TITLES[titleIndex],
  };
}

export function calculateXPEarned(score: number, accuracy: number, rank: PerformanceRank): number {
  let xp = score * XP_PER_POINT;
  if (accuracy === 100) xp += XP_BONUS_PERFECT;
  if (rank === "S") xp += XP_BONUS_S_RANK;
  return Math.round(xp);
}

export function getDailySeed(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

export function generateDailyRules(seed: string): GameRule[] {
  const rng = seededRandom(seed);
  const rules: GameRule[] = [];
  const ruleTypes: RuleType[] = ["tap_color", "tap_not_color", "tap_flashing"];

  for (let i = 0; i < 8; i++) {
    const typeIdx = Math.floor(rng() * ruleTypes.length);
    const ruleType = ruleTypes[typeIdx];

    if (ruleType === "tap_flashing") {
      rules.push({ type: "tap_flashing", displayText: "Tap the FLASHING tile" });
    } else {
      const colorIdx = Math.floor(rng() * TILE_COLORS.length);
      const color = TILE_COLORS[colorIdx];
      rules.push({
        type: ruleType,
        targetColor: color,
        displayText: ruleType === "tap_color" ? `Tap ${color.name}` : `Tap NOT ${color.name}`,
      });
    }
  }

  return rules;
}

export const BADGES: Badge[] = [
  {
    id: "first_game",
    title: "First Tap",
    description: "Play your first game",
    icon: "game-controller",
    iconFamily: "Ionicons",
    condition: (s) => s.totalGames >= 1,
  },
  {
    id: "ten_games",
    title: "Getting Warmed Up",
    description: "Play 10 games",
    icon: "flame",
    iconFamily: "Ionicons",
    condition: (s) => s.totalGames >= 10,
  },
  {
    id: "fifty_games",
    title: "Dedicated Player",
    description: "Play 50 games",
    icon: "trophy",
    iconFamily: "Ionicons",
    condition: (s) => s.totalGames >= 50,
  },
  {
    id: "score_50",
    title: "Rising Star",
    description: "Score 50 points in a single game",
    icon: "star",
    iconFamily: "Ionicons",
    condition: (s) => s.bestScore >= 50,
  },
  {
    id: "score_100",
    title: "Century Club",
    description: "Score 100 points in a single game",
    icon: "star-outline",
    iconFamily: "Ionicons",
    condition: (s) => s.bestScore >= 100,
  },
  {
    id: "score_200",
    title: "Elite Tapper",
    description: "Score 200 points in a single game",
    icon: "diamond",
    iconFamily: "Ionicons",
    condition: (s) => s.bestScore >= 200,
  },
  {
    id: "combo_5",
    title: "Combo King",
    description: "Reach a 5x combo multiplier",
    icon: "flash",
    iconFamily: "Ionicons",
    condition: (s) => s.bestCombo >= 5,
  },
  {
    id: "perfect_round",
    title: "Flawless",
    description: "Complete a game with no mistakes",
    icon: "shield-checkmark",
    iconFamily: "Ionicons",
    condition: (s) => s.gamesWithoutMistake >= 1,
  },
  {
    id: "speed_demon",
    title: "Speed Demon",
    description: "Average reaction under 300ms",
    icon: "speedometer",
    iconFamily: "Ionicons",
    condition: (s) => s.fastestReaction > 0 && s.fastestReaction < 300,
  },
  {
    id: "streak_3",
    title: "Hot Streak",
    description: "Play 3 games in a row",
    icon: "trending-up",
    iconFamily: "Ionicons",
    condition: (s) => s.longestStreak >= 3,
  },
  {
    id: "streak_7",
    title: "On Fire",
    description: "Play 7 games in a row",
    icon: "bonfire",
    iconFamily: "Ionicons",
    condition: (s) => s.longestStreak >= 7,
  },
  {
    id: "total_1000",
    title: "Point Collector",
    description: "Accumulate 1,000 total points",
    icon: "wallet",
    iconFamily: "Ionicons",
    condition: (s) => s.totalScore >= 1000,
  },
];

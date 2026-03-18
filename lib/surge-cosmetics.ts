import AsyncStorage from "@react-native-async-storage/async-storage";

export type RingThemeId =
  | "neon_purple"
  | "gold_ring"
  | "void_ring"
  | "ember_ring"
  | "ice_ring";

export interface RingTheme {
  id: RingThemeId;
  name: string;
  description: string;
  unlockText: string;
  free: boolean;
  ringColor: string;
  glowColor: string;
  targetColor: string;
}

export const RING_THEMES: RingTheme[] = [
  {
    id: "neon_purple",
    name: "Neon Purple",
    description: "Electric violet rings — the default surge",
    unlockText: "Default — always unlocked",
    free: true,
    ringColor: "#A78BFA",
    glowColor: "#7C3AED",
    targetColor: "#E040FB",
  },
  {
    id: "gold_ring",
    name: "Gold Surge",
    description: "Molten gold for those who master the timing",
    unlockText: "Score 150+ in a single Classic run",
    free: false,
    ringColor: "#FFD700",
    glowColor: "#FF8F00",
    targetColor: "#FFB300",
  },
  {
    id: "void_ring",
    name: "Void",
    description: "Cold white rings on pure darkness",
    unlockText: "Reach Rhythm rank (500 XP)",
    free: false,
    ringColor: "#FFFFFF",
    glowColor: "#B0BEC5",
    targetColor: "#ECEFF1",
  },
  {
    id: "ember_ring",
    name: "Ember",
    description: "Burning orange rings that pulse with heat",
    unlockText: "Hit a 20x combo in one run",
    free: false,
    ringColor: "#FF6D00",
    glowColor: "#FF3D00",
    targetColor: "#FFAB40",
  },
  {
    id: "ice_ring",
    name: "Ice Crystal",
    description: "Frozen cyan rings — glacial precision",
    unlockText: "Survive 60 seconds in Endless mode",
    free: false,
    ringColor: "#00E5FF",
    glowColor: "#0091EA",
    targetColor: "#80D8FF",
  },
];

const KEYS = {
  UNLOCKED_THEMES: "surge_unlocked_themes",
  EQUIPPED_THEME:  "surge_equipped_theme",
};

const DEFAULT_UNLOCKED: RingThemeId[] = ["neon_purple"];

export function getRingTheme(id: RingThemeId): RingTheme {
  return RING_THEMES.find((t) => t.id === id) ?? RING_THEMES[0];
}

export async function getUnlockedRingThemes(): Promise<RingThemeId[]> {
  const val = await AsyncStorage.getItem(KEYS.UNLOCKED_THEMES);
  if (!val) return [...DEFAULT_UNLOCKED];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_UNLOCKED];
  } catch {
    return [...DEFAULT_UNLOCKED];
  }
}

export async function saveUnlockedRingThemes(ids: RingThemeId[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.UNLOCKED_THEMES, JSON.stringify(ids));
}

export async function getEquippedRingTheme(): Promise<RingThemeId> {
  const val = await AsyncStorage.getItem(KEYS.EQUIPPED_THEME);
  return (val as RingThemeId) ?? "neon_purple";
}

export async function setEquippedRingTheme(id: RingThemeId): Promise<void> {
  await AsyncStorage.setItem(KEYS.EQUIPPED_THEME, id);
}

export async function checkAndUnlockRingThemes(runStats: {
  score: number;
  maxCombo: number;
  totalXP: number;
  timeSurvived: number;
  mode: string;
}): Promise<{ newThemes: RingThemeId[] }> {
  const { score, maxCombo, totalXP, timeSurvived, mode } = runStats;
  const unlocked = await getUnlockedRingThemes();
  const newThemes: RingThemeId[] = [];

  if (!unlocked.includes("gold_ring") && mode === "classic" && score >= 150) {
    unlocked.push("gold_ring");
    newThemes.push("gold_ring");
  }

  if (!unlocked.includes("void_ring") && totalXP >= 500) {
    unlocked.push("void_ring");
    newThemes.push("void_ring");
  }

  if (!unlocked.includes("ember_ring") && maxCombo >= 20) {
    unlocked.push("ember_ring");
    newThemes.push("ember_ring");
  }

  if (!unlocked.includes("ice_ring") && mode === "endless" && timeSurvived >= 60) {
    unlocked.push("ice_ring");
    newThemes.push("ice_ring");
  }

  if (newThemes.length > 0) {
    await saveUnlockedRingThemes(unlocked);
  }

  return { newThemes };
}

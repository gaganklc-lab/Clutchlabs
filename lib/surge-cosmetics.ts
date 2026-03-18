import AsyncStorage from "@react-native-async-storage/async-storage";

export type RingThemeId =
  | "neon_purple"
  | "gold_ring"
  | "void_ring"
  | "ember_ring"
  | "ice_ring"
  | "pro_obsidian"
  | "pro_aurora";

export interface RingTheme {
  id: RingThemeId;
  name: string;
  description: string;
  unlockText: string;
  free: boolean;
  proOnly: boolean;
  ringColor: string;
  glowColor: string;
  targetColor: string;
}

export const RING_THEMES: RingTheme[] = [
  {
    id: "neon_purple",
    name: "Neon Cyan",
    description: "Electric cyan rings — the default surge",
    unlockText: "Default — always unlocked",
    free: true,
    proOnly: false,
    ringColor: "#00E5FF",
    glowColor: "#0091EA",
    targetColor: "#80D8FF",
  },
  {
    id: "gold_ring",
    name: "Gold Surge",
    description: "Molten gold for those who master the timing",
    unlockText: "Score 150+ in a single Classic run",
    free: false,
    proOnly: false,
    ringColor: "#FFD700",
    glowColor: "#FF8F00",
    targetColor: "#FFB300",
  },
  {
    id: "void_ring",
    name: "Void",
    description: "Deep dark rings on pure shadow",
    unlockText: "Reach Rhythm rank (500 XP)",
    free: false,
    proOnly: false,
    ringColor: "#37474F",
    glowColor: "#1A1A2E",
    targetColor: "#546E7A",
  },
  {
    id: "ember_ring",
    name: "Ember",
    description: "Burning orange rings that pulse with heat",
    unlockText: "Hit a 20x combo in one run",
    free: false,
    proOnly: false,
    ringColor: "#FF6D00",
    glowColor: "#FF3D00",
    targetColor: "#FFAB40",
  },
  {
    id: "ice_ring",
    name: "Ice Crystal",
    description: "Frozen white-blue rings — glacial precision",
    unlockText: "Survive 60 seconds in Endless mode",
    free: false,
    proOnly: false,
    ringColor: "#E3F4FF",
    glowColor: "#90CAF9",
    targetColor: "#BBDEFB",
  },
  {
    id: "pro_obsidian",
    name: "Obsidian Pro",
    description: "Dark volcanic rings with crimson core — Pro exclusive",
    unlockText: "Surge Pro subscribers only",
    free: false,
    proOnly: true,
    ringColor: "#B71C1C",
    glowColor: "#4A148C",
    targetColor: "#E53935",
  },
  {
    id: "pro_aurora",
    name: "Aurora Pro",
    description: "Northern lights shimmering — Pro exclusive",
    unlockText: "Surge Pro subscribers only",
    free: false,
    proOnly: true,
    ringColor: "#00E676",
    glowColor: "#1DE9B6",
    targetColor: "#69F0AE",
  },
];

const KEYS = {
  UNLOCKED_THEMES: "surge_unlocked_themes",
  EQUIPPED_THEME: "surge_equipped_theme",
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

const PRO_THEMES: RingThemeId[] = ["pro_obsidian", "pro_aurora"];

export async function unlockProThemes(): Promise<RingThemeId[]> {
  const unlocked = await getUnlockedRingThemes();
  const newThemes: RingThemeId[] = [];
  for (const id of PRO_THEMES) {
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      newThemes.push(id);
    }
  }
  if (newThemes.length > 0) {
    await saveUnlockedRingThemes(unlocked);
  }
  return newThemes;
}

export async function revokeProThemes(): Promise<void> {
  const unlocked = await getUnlockedRingThemes();
  const filtered = unlocked.filter((id) => !PRO_THEMES.includes(id));
  await saveUnlockedRingThemes(filtered);

  const equipped = await getEquippedRingTheme();
  if (PRO_THEMES.includes(equipped)) {
    await setEquippedRingTheme("neon_purple");
  }
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

  if (
    !unlocked.includes("ice_ring") &&
    mode === "endless" &&
    timeSurvived >= 60
  ) {
    unlocked.push("ice_ring");
    newThemes.push("ice_ring");
  }

  if (newThemes.length > 0) {
    await saveUnlockedRingThemes(unlocked);
  }

  return { newThemes };
}

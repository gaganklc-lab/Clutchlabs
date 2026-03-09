import AsyncStorage from "@react-native-async-storage/async-storage";

export type OrbStyleId = "core_blue" | "neon_pulse" | "overdrive_gold";
export type TrailStyleId = "cyan_trail" | "violet_trail" | "gold_spark";

export interface OrbStyle {
  id: OrbStyleId;
  name: string;
  description: string;
  unlockText: string;
  free: boolean;
  colors: {
    aura: string;
    mid: string;
    core: string;
  };
}

export interface TrailStyle {
  id: TrailStyleId;
  name: string;
  description: string;
  unlockText: string;
  free: boolean;
  color: string;
}

export const ORB_STYLES: OrbStyle[] = [
  {
    id: "core_blue",
    name: "Core Blue",
    description: "The original cyan energy orb",
    unlockText: "Default — always unlocked",
    free: true,
    colors: { aura: "#00E5FF30", mid: "#00E5FF55", core: "#00E5FF" },
  },
  {
    id: "neon_pulse",
    name: "Neon Pulse",
    description: "Violet energy surging with phantom speed",
    unlockText: "Reach Phantom rank (200 XP)",
    free: false,
    colors: { aura: "#7B61FF30", mid: "#7B61FF80", core: "#A78BFA" },
  },
  {
    id: "overdrive_gold",
    name: "Overdrive Gold",
    description: "Pure gold — for those who push beyond limits",
    unlockText: "Score 100+ in a single run",
    free: false,
    colors: { aura: "#FFD70030", mid: "#FFD70055", core: "#FFB300" },
  },
];

export const TRAIL_STYLES: TrailStyle[] = [
  {
    id: "cyan_trail",
    name: "Cyan Trail",
    description: "Clean electric cyan wake",
    unlockText: "Default — always unlocked",
    free: true,
    color: "#00E5FF",
  },
  {
    id: "violet_trail",
    name: "Violet Trail",
    description: "Deep purple phantom streak",
    unlockText: "Hit a 10x combo in one run",
    free: false,
    color: "#7B61FF",
  },
  {
    id: "gold_spark",
    name: "Gold Spark",
    description: "Molten gold sparks — endless legend fuel",
    unlockText: "Reach Speed Level 3 in Endless mode",
    free: false,
    color: "#FFD700",
  },
];

const KEYS = {
  UNLOCKED_COSMETICS: "velocity_unlocked_cosmetics",
  EQUIPPED_ORB: "velocity_equipped_orb",
  EQUIPPED_TRAIL: "velocity_equipped_trail",
};

const DEFAULT_UNLOCKED = {
  orbs: ["core_blue"] as OrbStyleId[],
  trails: ["cyan_trail"] as TrailStyleId[],
};

export function getOrbStyle(id: OrbStyleId): OrbStyle {
  return ORB_STYLES.find((o) => o.id === id) ?? ORB_STYLES[0];
}

export function getTrailStyle(id: TrailStyleId): TrailStyle {
  return TRAIL_STYLES.find((t) => t.id === id) ?? TRAIL_STYLES[0];
}

export async function getUnlockedCosmetics(): Promise<{
  orbs: OrbStyleId[];
  trails: TrailStyleId[];
}> {
  const val = await AsyncStorage.getItem(KEYS.UNLOCKED_COSMETICS);
  if (!val) return { ...DEFAULT_UNLOCKED };
  const parsed = JSON.parse(val);
  return {
    orbs: parsed.orbs ?? [...DEFAULT_UNLOCKED.orbs],
    trails: parsed.trails ?? [...DEFAULT_UNLOCKED.trails],
  };
}

export async function saveUnlockedCosmetics(data: {
  orbs: OrbStyleId[];
  trails: TrailStyleId[];
}): Promise<void> {
  await AsyncStorage.setItem(KEYS.UNLOCKED_COSMETICS, JSON.stringify(data));
}

export async function getEquippedOrb(): Promise<OrbStyleId> {
  const val = await AsyncStorage.getItem(KEYS.EQUIPPED_ORB);
  return (val as OrbStyleId) ?? "core_blue";
}

export async function setEquippedOrb(id: OrbStyleId): Promise<void> {
  await AsyncStorage.setItem(KEYS.EQUIPPED_ORB, id);
}

export async function getEquippedTrail(): Promise<TrailStyleId> {
  const val = await AsyncStorage.getItem(KEYS.EQUIPPED_TRAIL);
  return (val as TrailStyleId) ?? "cyan_trail";
}

export async function setEquippedTrail(id: TrailStyleId): Promise<void> {
  await AsyncStorage.setItem(KEYS.EQUIPPED_TRAIL, id);
}

export async function checkAndUnlockCosmetics(runStats: {
  score: number;
  maxCombo: number;
  totalXP: number;
  speedLevel: number;
  mode: string;
}): Promise<{ newOrbs: OrbStyleId[]; newTrails: TrailStyleId[] }> {
  const { score, maxCombo, totalXP, speedLevel, mode } = runStats;
  const unlocked = await getUnlockedCosmetics();
  const newOrbs: OrbStyleId[] = [];
  const newTrails: TrailStyleId[] = [];

  if (!unlocked.orbs.includes("neon_pulse") && totalXP >= 200) {
    unlocked.orbs.push("neon_pulse");
    newOrbs.push("neon_pulse");
  }

  if (!unlocked.orbs.includes("overdrive_gold") && score >= 100) {
    unlocked.orbs.push("overdrive_gold");
    newOrbs.push("overdrive_gold");
  }

  if (!unlocked.trails.includes("violet_trail") && maxCombo >= 10) {
    unlocked.trails.push("violet_trail");
    newTrails.push("violet_trail");
  }

  if (!unlocked.trails.includes("gold_spark") && mode === "endless" && speedLevel >= 3) {
    unlocked.trails.push("gold_spark");
    newTrails.push("gold_spark");
  }

  if (newOrbs.length > 0 || newTrails.length > 0) {
    await saveUnlockedCosmetics(unlocked);
  }

  return { newOrbs, newTrails };
}

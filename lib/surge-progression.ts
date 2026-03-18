export type SurgeTitle = "Novice" | "Pulse" | "Rhythm" | "Resonance" | "Surge Master";

interface SurgeTitleTier {
  title: SurgeTitle;
  xpRequired: number;
  color: string;
  description: string;
}

const SURGE_TITLE_TIERS: SurgeTitleTier[] = [
  { title: "Novice",       xpRequired: 0,    color: "#9E9E9E", description: "Learning the rhythm" },
  { title: "Pulse",        xpRequired: 200,  color: "#A78BFA", description: "Feeling the beat" },
  { title: "Rhythm",       xpRequired: 500,  color: "#7C3AED", description: "In perfect sync" },
  { title: "Resonance",    xpRequired: 1200, color: "#E040FB", description: "One with the surge" },
  { title: "Surge Master", xpRequired: 3000, color: "#FFD700", description: "Beyond the limit" },
];

export function getSurgeTitle(xp: number): SurgeTitle {
  let current: SurgeTitle = "Novice";
  for (const tier of SURGE_TITLE_TIERS) {
    if (xp >= tier.xpRequired) current = tier.title;
  }
  return current;
}

export function getSurgeTitleInfo(title: SurgeTitle): SurgeTitleTier {
  return SURGE_TITLE_TIERS.find((t) => t.title === title) ?? SURGE_TITLE_TIERS[0];
}

export function getSurgeTitleColor(title: SurgeTitle): string {
  return getSurgeTitleInfo(title).color;
}

export function getNextSurgeTitle(xp: number): { title: SurgeTitle; xpRequired: number; xpNeeded: number } | null {
  for (const tier of SURGE_TITLE_TIERS) {
    if (xp < tier.xpRequired) {
      return { title: tier.title, xpRequired: tier.xpRequired, xpNeeded: tier.xpRequired - xp };
    }
  }
  return null;
}

export function getSurgeTierXP(xp: number): { current: number; needed: number } {
  let currentFloor = 0;
  let nextCeiling = 0;
  for (let i = 0; i < SURGE_TITLE_TIERS.length; i++) {
    if (xp >= SURGE_TITLE_TIERS[i].xpRequired) {
      currentFloor = SURGE_TITLE_TIERS[i].xpRequired;
      nextCeiling = SURGE_TITLE_TIERS[i + 1]?.xpRequired ?? SURGE_TITLE_TIERS[i].xpRequired;
    }
  }
  const isMax = getNextSurgeTitle(xp) === null;
  if (isMax) return { current: 1, needed: 1 };
  return { current: xp - currentFloor, needed: nextCeiling - currentFloor };
}

export { SURGE_TITLE_TIERS };

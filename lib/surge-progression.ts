export type SurgeTitle =
  | "Novice"
  | "Pulse"
  | "Rhythm"
  | "Beat"
  | "Flow"
  | "Resonance"
  | "Surge"
  | "Elite"
  | "Surge Master";

interface SurgeTitleTier {
  title: SurgeTitle;
  xpRequired: number;
  color: string;
  icon: string;
  description: string;
}

const SURGE_TITLE_TIERS: SurgeTitleTier[] = [
  { title: "Novice",       xpRequired: 0,    color: "#9E9E9E", icon: "radio-button-off-outline", description: "Learning the rhythm" },
  { title: "Pulse",        xpRequired: 150,  color: "#B0BEC5", icon: "pulse-outline",            description: "Feeling the beat" },
  { title: "Rhythm",       xpRequired: 350,  color: "#4FC3F7", icon: "musical-notes-outline",    description: "Moving with the flow" },
  { title: "Beat",         xpRequired: 650,  color: "#26C6DA", icon: "timer-outline",             description: "Locked in the groove" },
  { title: "Flow",         xpRequired: 1100, color: "#A78BFA", icon: "water-outline",             description: "Effortless precision" },
  { title: "Resonance",    xpRequired: 1800, color: "#E040FB", icon: "radio-button-on-outline",   description: "One with the surge" },
  { title: "Surge",        xpRequired: 2800, color: "#7C3AED", icon: "flash-outline",             description: "Riding the energy" },
  { title: "Elite",        xpRequired: 4200, color: "#FF6D00", icon: "star-outline",              description: "Master-class timing" },
  { title: "Surge Master", xpRequired: 6000, color: "#FFD700", icon: "trophy-outline",            description: "Beyond the limit" },
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

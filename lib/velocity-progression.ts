export type VelocityTitle = "Runner" | "Phantom" | "Surge" | "Overdrive" | "Legend";

interface TitleTier {
  title: VelocityTitle;
  xpRequired: number;
  color: string;
  description: string;
}

const TITLE_TIERS: TitleTier[] = [
  { title: "Runner",    xpRequired: 0,    color: "#9E9E9E", description: "Just getting started" },
  { title: "Phantom",   xpRequired: 200,  color: "#00E5FF", description: "Moving like a ghost" },
  { title: "Surge",     xpRequired: 500,  color: "#7B61FF", description: "Pure electric speed" },
  { title: "Overdrive", xpRequired: 1200, color: "#FF9F43", description: "Beyond the limit" },
  { title: "Legend",    xpRequired: 3000, color: "#FFD700", description: "Untouchable" },
];

export function getVelocityTitle(xp: number): VelocityTitle {
  let current: VelocityTitle = "Runner";
  for (const tier of TITLE_TIERS) {
    if (xp >= tier.xpRequired) current = tier.title;
  }
  return current;
}

export function getTitleInfo(title: VelocityTitle): TitleTier {
  return TITLE_TIERS.find((t) => t.title === title) ?? TITLE_TIERS[0];
}

export function getTitleColor(title: VelocityTitle): string {
  return getTitleInfo(title).color;
}

export function getNextTitle(xp: number): { title: VelocityTitle; xpRequired: number; xpNeeded: number } | null {
  for (const tier of TITLE_TIERS) {
    if (xp < tier.xpRequired) {
      return { title: tier.title, xpRequired: tier.xpRequired, xpNeeded: tier.xpRequired - xp };
    }
  }
  return null;
}

export function getCurrentTierXP(xp: number): { current: number; needed: number } {
  let currentFloor = 0;
  let nextCeiling = 0;
  for (let i = 0; i < TITLE_TIERS.length; i++) {
    if (xp >= TITLE_TIERS[i].xpRequired) {
      currentFloor = TITLE_TIERS[i].xpRequired;
      nextCeiling = TITLE_TIERS[i + 1]?.xpRequired ?? TITLE_TIERS[i].xpRequired;
    }
  }
  const isMax = getNextTitle(xp) === null;
  if (isMax) return { current: 1, needed: 1 };
  return { current: xp - currentFloor, needed: nextCeiling - currentFloor };
}

export { TITLE_TIERS };

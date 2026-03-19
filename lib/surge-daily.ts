import AsyncStorage from "@react-native-async-storage/async-storage";

const DAILY_DATE_KEY = "surge_daily_date";
const DAILY_STATE_KEY = "surge_daily_state";
const DAILY_CHALLENGE_KEY = "surge_daily_challenge";

export const DAILY_MAX_ATTEMPTS = 3;
export const DAILY_XP_MULTIPLIER = 1.5;

export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateSeed(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (((hash << 5) - hash) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const CHALLENGE_NAMES = [
  "Speed Demon",
  "Precision Master",
  "Tempo Rush",
  "Rhythm Strike",
  "Lightning Round",
  "Flow State",
  "Pulse Breaker",
  "Surge Protocol",
  "Beat Keeper",
  "Resonance Run",
];

const RING_STYLES = ["CLASSIC", "ASSAULT", "TEMPO", "ZEN", "SURGE"] as const;
export type DailyRingStyle = typeof RING_STYLES[number];

export interface DailyChallenge {
  name: string;
  cycleStart: number;
  rampRate: number;
  ringStyle: DailyRingStyle;
  dateKey: string;
  seed: number;
}

export interface DailyState {
  attemptsUsed: number;
  bestScore: number;
  completed: boolean;
}

function computeChallenge(key: string): DailyChallenge {
  const seed = dateSeed(key);
  return {
    name: CHALLENGE_NAMES[seed % CHALLENGE_NAMES.length],
    cycleStart: 900 + (seed % 5) * 75,
    rampRate: 25 + (seed % 5) * 5,
    ringStyle: RING_STYLES[(seed >> 3) % RING_STYLES.length],
    dateKey: key,
    seed,
  };
}

export function getDailyChallenge(dateKey?: string): DailyChallenge {
  const key = dateKey ?? getTodayKey();
  return computeChallenge(key);
}

export async function getTodayChallenge(): Promise<DailyChallenge> {
  const todayKey = getTodayKey();
  const storedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);

  if (storedDate === todayKey) {
    const stored = await AsyncStorage.getItem(DAILY_CHALLENGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as DailyChallenge;
      } catch {}
    }
  }

  const challenge = computeChallenge(todayKey);
  await AsyncStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(challenge));
  return challenge;
}

export async function getDailyState(): Promise<DailyState> {
  const todayKey = getTodayKey();
  const storedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);

  if (storedDate !== todayKey) {
    const fresh: DailyState = { attemptsUsed: 0, bestScore: 0, completed: false };
    const challenge = computeChallenge(todayKey);
    await AsyncStorage.multiSet([
      [DAILY_DATE_KEY, todayKey],
      [DAILY_STATE_KEY, JSON.stringify(fresh)],
      [DAILY_CHALLENGE_KEY, JSON.stringify(challenge)],
    ]);
    return fresh;
  }

  const val = await AsyncStorage.getItem(DAILY_STATE_KEY);
  if (!val) {
    const fresh: DailyState = { attemptsUsed: 0, bestScore: 0, completed: false };
    await AsyncStorage.setItem(DAILY_STATE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    return JSON.parse(val) as DailyState;
  } catch {
    return { attemptsUsed: 0, bestScore: 0, completed: false };
  }
}

export async function recordDailyAttempt(score: number): Promise<DailyState> {
  const state = await getDailyState();
  if (state.completed) return state;
  state.attemptsUsed = Math.min(state.attemptsUsed + 1, DAILY_MAX_ATTEMPTS);
  if (score > state.bestScore) state.bestScore = score;
  if (state.attemptsUsed >= DAILY_MAX_ATTEMPTS) state.completed = true;
  await AsyncStorage.setItem(DAILY_STATE_KEY, JSON.stringify(state));
  return state;
}

export async function resetIfNewDay(): Promise<boolean> {
  const today = getTodayKey();
  const stored = await AsyncStorage.getItem(DAILY_DATE_KEY);
  if (stored !== today) {
    const fresh: DailyState = { attemptsUsed: 0, bestScore: 0, completed: false };
    const challenge = computeChallenge(today);
    await AsyncStorage.multiSet([
      [DAILY_DATE_KEY, today],
      [DAILY_STATE_KEY, JSON.stringify(fresh)],
      [DAILY_CHALLENGE_KEY, JSON.stringify(challenge)],
    ]);
    return true;
  }
  return false;
}

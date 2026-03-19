import AsyncStorage from "@react-native-async-storage/async-storage";

const DAILY_DATE_KEY = "surge_daily_date";
const DAILY_STATE_KEY = "surge_daily_state";

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

export interface DailyChallenge {
  name: string;
  cycleStart: number;
  rampRate: number;
  dateKey: string;
  seed: number;
}

export interface DailyState {
  attemptsUsed: number;
  bestScore: number;
  completed: boolean;
}

export function getDailyChallenge(dateKey?: string): DailyChallenge {
  const key = dateKey ?? getTodayKey();
  const seed = dateSeed(key);
  return {
    name: CHALLENGE_NAMES[seed % CHALLENGE_NAMES.length],
    cycleStart: 900 + (seed % 5) * 75,
    rampRate: 25 + (seed % 5) * 5,
    dateKey: key,
    seed,
  };
}

export async function getDailyState(): Promise<DailyState> {
  const todayKey = getTodayKey();
  const storedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);

  if (storedDate !== todayKey) {
    const fresh: DailyState = { attemptsUsed: 0, bestScore: 0, completed: false };
    await AsyncStorage.multiSet([
      [DAILY_DATE_KEY, todayKey],
      [DAILY_STATE_KEY, JSON.stringify(fresh)],
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
    await AsyncStorage.multiSet([
      [DAILY_DATE_KEY, today],
      [DAILY_STATE_KEY, JSON.stringify(fresh)],
    ]);
    return true;
  }
  return false;
}

type AnalyticsEvent =
  | "game_started"
  | "game_ended"
  | "badge_unlocked"
  | "settings_changed"
  | "score_shared"
  | "screen_viewed"
  | "velocity_game_end"
  | "velocity_results_viewed"
  | "surge_game_end"
  | "surge_results_viewed";

interface AnalyticsPayload {
  [key: string]: string | number | boolean | undefined;
}

const eventLog: Array<{ event: AnalyticsEvent; payload?: AnalyticsPayload; timestamp: number }> = [];

export function trackEvent(event: AnalyticsEvent, payload?: AnalyticsPayload): void {
  eventLog.push({
    event,
    payload,
    timestamp: Date.now(),
  });

  if (__DEV__) {
    console.log(`[Analytics] ${event}`, payload ?? "");
  }
}

export function getEventLog() {
  return [...eventLog];
}

export function clearEventLog() {
  eventLog.length = 0;
}

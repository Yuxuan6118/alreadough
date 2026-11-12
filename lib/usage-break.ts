// "You have been chatting for a while" reminder: every 2 hours of continuous use. Pure functions (unit-testable).
// "Continuous" = she keeps sending messages with gaps under 30 minutes; only time she is actually chatting
// (a message within the last 10 minutes, page visible) counts.
export const BREAK_AFTER_MS = 2 * 60 * 60 * 1000;
const IDLE_RESET_MS = 30 * 60 * 1000;
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

export type UsageState = { lastActive: number; continuousMs: number; nextAt: number };

export const newUsageState = (now: number): UsageState => ({ lastActive: now, continuousMs: 0, nextAt: BREAK_AFTER_MS });
export const markActive = (state: UsageState, now: number): UsageState => ({ ...state, lastActive: now });

export function tickUsage(state: UsageState, now: number, visible: boolean, tickMs: number): { state: UsageState; remind: boolean } {
  if (now - state.lastActive > IDLE_RESET_MS) return { state: { ...state, continuousMs: 0, nextAt: BREAK_AFTER_MS }, remind: false };
  if (!visible || now - state.lastActive > ACTIVE_WINDOW_MS) return { state, remind: false };
  const continuousMs = state.continuousMs + tickMs;
  if (continuousMs >= state.nextAt) return { state: { ...state, continuousMs, nextAt: state.nextAt + BREAK_AFTER_MS }, remind: true };
  return { state: { ...state, continuousMs }, remind: false };
}

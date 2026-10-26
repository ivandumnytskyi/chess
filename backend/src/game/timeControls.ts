import type { Color } from "../types/chess";

export const TIME_CONTROLS = {
  "1+0": { initialMs: 60_000, incrementMs: 0 },
  "2+1": { initialMs: 120_000, incrementMs: 1_000 },
  "10+0": { initialMs: 600_000, incrementMs: 0 },
} as const;

export type TimeControlId = keyof typeof TIME_CONTROLS;

export const DEFAULT_TIME_CONTROL: TimeControlId = "10+0";

export const isTimeControlId = (value: unknown): value is TimeControlId =>
  typeof value === "string" && Object.keys(TIME_CONTROLS).includes(value);

export type Clock = {
  whiteRemainingMs: number;
  blackRemainingMs: number;
  lastMoveAt: number;
};

export type ClockUpdate = {
  clock: Clock;
  timedOut: boolean;
};

export const createClock = (timeControl: TimeControlId, now: number): Clock => {
  const { initialMs } = TIME_CONTROLS[timeControl];
  return { whiteRemainingMs: initialMs, blackRemainingMs: initialMs, lastMoveAt: now };
};

// Time left for `color` at `now`, counting down only while it is their turn (the clock runs since lastMoveAt).
export const remainingAt = (clock: Clock, color: Color, now: number): number => {
  const base = color === "white" ? clock.whiteRemainingMs : clock.blackRemainingMs;
  return base - Math.max(0, now - clock.lastMoveAt);
};

// Charges the mover for the time since the last move, then adds the increment.
// Returns the updated clock without mutating the input, so a rejected move leaves it unchanged.
export const applyMoveToClock = (
  clock: Clock,
  mover: Color,
  now: number,
  incrementMs: number
): ClockUpdate => {
  const elapsed = Math.max(0, now - clock.lastMoveAt);
  const moverRemaining = mover === "white" ? clock.whiteRemainingMs : clock.blackRemainingMs;
  const left = moverRemaining - elapsed;
  const timedOut = left <= 0;
  const updated = timedOut ? 0 : left + incrementMs;

  return {
    clock: {
      whiteRemainingMs: mover === "white" ? updated : clock.whiteRemainingMs,
      blackRemainingMs: mover === "black" ? updated : clock.blackRemainingMs,
      lastMoveAt: now,
    },
    timedOut,
  };
};

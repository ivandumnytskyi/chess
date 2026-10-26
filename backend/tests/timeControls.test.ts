import { describe, expect, it } from "vitest";
import {
  TIME_CONTROLS,
  applyMoveToClock,
  createClock,
  isTimeControlId,
  remainingAt,
  type Clock,
} from "../src/game/timeControls";

const startClock: Clock = { whiteRemainingMs: 60_000, blackRemainingMs: 60_000, lastMoveAt: 0 };

describe("isTimeControlId", () => {
  it.each([
    ["1+0", true],
    ["2+1", true],
    ["10+0", true],
    ["3+2", false],
    ["toString", false],
    ["", false],
  ])("accepts only the presets: %s -> %s", (value, expected) => {
    const result = isTimeControlId(value);

    expect(result).toBe(expected);
  });

  it("rejects non-string values", () => {
    const result = isTimeControlId(60_000);

    expect(result).toBe(false);
  });
});

describe("createClock", () => {
  it.each(Object.keys(TIME_CONTROLS) as (keyof typeof TIME_CONTROLS)[])(
    "starts both clocks at the initial time for %s",
    (timeControl) => {
      const initialMs = TIME_CONTROLS[timeControl].initialMs;

      const clock = createClock(timeControl, 1_000);

      expect(clock).toEqual({ whiteRemainingMs: initialMs, blackRemainingMs: initialMs, lastMoveAt: 1_000 });
    }
  );
});

describe("remainingAt", () => {
  const clock: Clock = { whiteRemainingMs: 50_000, blackRemainingMs: 40_000, lastMoveAt: 10_000 };

  it.each([
    { name: "counts down the white clock", color: "white" as const, now: 14_000, expected: 46_000 },
    { name: "counts down the black clock", color: "black" as const, now: 14_000, expected: 36_000 },
    { name: "reaches zero exactly at expiry", color: "white" as const, now: 60_000, expected: 0 },
    { name: "goes negative when overdue", color: "black" as const, now: 60_000, expected: -10_000 },
    { name: "does not count before lastMoveAt", color: "white" as const, now: 5_000, expected: 50_000 },
  ])("$name", ({ color, now, expected }) => {
    const result = remainingAt(clock, color, now);

    expect(result).toBe(expected);
  });
});

describe("applyMoveToClock", () => {
  it.each([
    {
      name: "charges white for elapsed time",
      clock: startClock,
      mover: "white" as const,
      now: 5_000,
      incrementMs: 0,
      white: 55_000,
      black: 60_000,
    },
    {
      name: "adds the increment after charging",
      clock: startClock,
      mover: "white" as const,
      now: 5_000,
      incrementMs: 1_000,
      white: 56_000,
      black: 60_000,
    },
    {
      name: "charges black from the previous move time",
      clock: { whiteRemainingMs: 50_000, blackRemainingMs: 60_000, lastMoveAt: 5_000 },
      mover: "black" as const,
      now: 8_000,
      incrementMs: 0,
      white: 50_000,
      black: 57_000,
    },
  ])("$name", ({ clock, mover, now, incrementMs, white, black }) => {
    const result = applyMoveToClock(clock, mover, now, incrementMs);

    expect(result.timedOut).toBe(false);
    expect(result.clock).toEqual({ whiteRemainingMs: white, blackRemainingMs: black, lastMoveAt: now });
  });

  it.each([
    { name: "flags when time is exactly used up", now: 60_000 },
    { name: "flags when time is overdrawn", now: 75_000 },
  ])("$name", ({ now }) => {
    const result = applyMoveToClock(startClock, "white", now, 1_000);

    expect(result.timedOut).toBe(true);
    expect(result.clock.whiteRemainingMs).toBe(0);
  });

  it("does not mutate the input clock", () => {
    const clock: Clock = { ...startClock };

    applyMoveToClock(clock, "white", 5_000, 1_000);

    expect(clock).toEqual(startClock);
  });
});

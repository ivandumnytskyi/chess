import type { Color } from "../../types";

const pad = (value: number) => String(value).padStart(2, "0");

// Shows tenths of a second once under 10 seconds, like most online chess clocks.
const formatClock = (ms: number): string => {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (clamped < 10_000) {
    const tenths = Math.floor((clamped % 1000) / 100);
    return `${minutes}:${pad(seconds)}.${tenths}`;
  }
  return `${minutes}:${pad(seconds)}`;
};

type ClockProps = {
  color: Color;
  remainingMs: number;
  active: boolean;
};

const Clock = ({ color, remainingMs, active }: ClockProps) => {
  const isLow = remainingMs < 10_000;
  return (
    <div
      className={`flex justify-between items-center w-full px-4 py-2 rounded-lg text-2xl font-mono text-white ${
        active ? "bg-blue-600" : "bg-neutral-700"
      }`}
    >
      <span className="text-base capitalize">{color}</span>
      <span className={isLow ? "text-red-400" : ""}>{formatClock(remainingMs)}</span>
    </div>
  );
};

export default Clock;

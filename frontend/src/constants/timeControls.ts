export const TIME_CONTROL_OPTIONS = [
  { id: "1+0", label: "Bullet 1+0", incrementMs: 0 },
  { id: "2+1", label: "Bullet 2+1", incrementMs: 1_000 },
  { id: "10+0", label: "Rapid 10+0", incrementMs: 0 },
] as const;

export type TimeControlId = (typeof TIME_CONTROL_OPTIONS)[number]["id"];

export const DEFAULT_TIME_CONTROL: TimeControlId = "10+0";

export const incrementFor = (id: TimeControlId): number =>
  TIME_CONTROL_OPTIONS.find((option) => option.id === id)?.incrementMs ?? 0;

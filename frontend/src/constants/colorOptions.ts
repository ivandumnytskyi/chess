export const COLOR_OPTIONS = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "random", label: "Random" },
] as const;

export type ColorOptionId = (typeof COLOR_OPTIONS)[number]["id"];

export const BotDifficultyLevels = {
  "easy": {
    elo: 1320,
    moveTimeMs: 100,
  },
  "medium": {
    elo: 1800,
    moveTimeMs: 300,
  },
  "hard": {
    elo: 3000,
    moveTimeMs: 800,
  }
} as const;

export type BotDifficultyLevel = keyof typeof BotDifficultyLevels;
export const BotDifficultyLevels = {
  "easy": {
    elo: 1320,
    moveTimeMs: 300,
    limitStrength: true
  },
  "medium": {
    elo: 1800,
    moveTimeMs: 1000,
    limitStrength: true
  },
  "hard": {
    elo: 3000,
    moveTimeMs: 1200,
    limitStrength: false
  }
} as const;

export type BotDifficultyLevel = keyof typeof BotDifficultyLevels;
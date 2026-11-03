-- CreateEnum
CREATE TYPE "BotDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "botColor" "Color",
ADD COLUMN     "botDifficulty" "BotDifficulty";


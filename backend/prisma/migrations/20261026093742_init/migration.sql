-- CreateEnum
CREATE TYPE "Color" AS ENUM ('white', 'black');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('active', 'finished');

-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('white_wins', 'black_wins', 'draw');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('checkmate', 'stalemate', 'draw', 'timeout', 'resignation');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "whitePlayerId" UUID,
    "blackPlayerId" UUID,
    "timeControlId" TEXT NOT NULL,
    "timeInitialMs" INTEGER NOT NULL,
    "timeIncrementMs" INTEGER NOT NULL,
    "whiteRemainingMs" INTEGER NOT NULL,
    "blackRemainingMs" INTEGER NOT NULL,
    "lastMoveAt" TIMESTAMP(3),
    "currentTurn" "Color" NOT NULL DEFAULT 'white',
    "status" "GameStatus" NOT NULL DEFAULT 'active',
    "result" "GameResult",
    "endReason" "EndReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "ply" INTEGER NOT NULL,
    "color" "Color" NOT NULL,
    "move" JSONB NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "Game_whitePlayerId_createdAt_idx" ON "Game"("whitePlayerId", "createdAt");

-- CreateIndex
CREATE INDEX "Game_blackPlayerId_createdAt_idx" ON "Game"("blackPlayerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Move_gameId_ply_key" ON "Move"("gameId", "ply");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "EndReason" ADD VALUE 'agreement';

-- AlterEnum
ALTER TYPE "InviteStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "drawOfferedBy" "Color";

-- AlterTable
ALTER TABLE "GameInvite" ADD COLUMN "pairKey" TEXT;

-- Pending invites created before this column existed get the same key the application builds (ids sorted, joined with ":").
UPDATE "GameInvite"
SET "pairKey" = LEAST("senderId"::text COLLATE "C", "recipientId"::text COLLATE "C") || ':' || GREATEST("senderId"::text COLLATE "C", "recipientId"::text COLLATE "C")
WHERE "status" = 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "GameInvite_pairKey_key" ON "GameInvite"("pairKey");

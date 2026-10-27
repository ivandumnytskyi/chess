import type { Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { prisma } from "../../lib/prisma";
import { isUuid } from "../../lib/uuid";
import { normalizeUsername, isUniqueViolation } from "../../lib/username";
import { DEFAULT_TIME_CONTROL, isTimeControlId } from "../game/timeControls";
import { newGameData } from "./GameController";

// Invites are meant to be answered while the sender is waiting, so they lapse quickly.
const INVITE_TTL_MS = 30 * 60 * 1000;

const inviteSelect = {
  id: true,
  timeControlId: true,
  senderColor: true,
  createdAt: true,
  expiresAt: true,
  sender: { select: { username: true } },
  recipient: { select: { username: true } },
} as const;

type InviteRow = {
  id: string;
  timeControlId: string;
  senderColor: "white" | "black" | null;
  createdAt: Date;
  expiresAt: Date;
  sender: { username: string | null };
  recipient: { username: string | null };
};

const toInviteView = (invite: InviteRow) => ({
  id: invite.id,
  from: invite.sender.username,
  to: invite.recipient.username,
  timeControlId: invite.timeControlId,
  color: invite.senderColor ?? "random",
  createdAt: invite.createdAt,
  expiresAt: invite.expiresAt,
});

const getUserId = (res: Response): string => (res.locals.user as User).id;

// Same key for both directions, so A inviting B and B inviting A collide.
const pairKeyFor = (a: string, b: string): string => [a, b].sort().join(":");

export async function sendInvite(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const { username, timeControl, color } = (req.body ?? {}) as { username?: unknown; timeControl?: unknown; color?: unknown };

  if (color !== undefined && color !== "white" && color !== "black" && color !== "random") {
    res.status(400).json({ error: "Invalid color" });
    return;
  }
  const senderColor = color === "white" || color === "black" ? color : null;

  const recipientName = normalizeUsername(username);
  if (!recipientName) {
    res.status(400).json({ error: "Enter a valid username" });
    return;
  }
  if (timeControl !== undefined && !isTimeControlId(timeControl)) {
    res.status(400).json({ error: "Invalid time control" });
    return;
  }
  const timeControlId = isTimeControlId(timeControl) ? timeControl : DEFAULT_TIME_CONTROL;

  const sender = await prisma.profile.findUnique({ where: { id: userId }, select: { username: true } });
  if (!sender?.username) {
    res.status(403).json({ error: "Choose a username before inviting friends" });
    return;
  }

  const recipient = await prisma.profile.findUnique({ where: { username: recipientName }, select: { id: true } });
  if (!recipient) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (recipient.id === userId) {
    res.status(400).json({ error: "You cannot invite yourself" });
    return;
  }

  const now = new Date();
  const pairKey = pairKeyFor(userId, recipient.id);

  // A lapsed invite still holds the pair key, so it is closed before a new one is created.
  await prisma.gameInvite.updateMany({
    where: { pairKey, expiresAt: { lte: now } },
    data: { status: "expired", pairKey: null, respondedAt: now },
  });

  // The unique pair key makes the database reject a second pending invite, even from a concurrent request.
  let invite: InviteRow;
  try {
    invite = await prisma.gameInvite.create({
      data: {
        senderId: userId,
        recipientId: recipient.id,
        pairKey,
        timeControlId,
        senderColor,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      },
      select: inviteSelect,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    res.status(409).json({ error: "There is already a pending invite between you two" });
    return;
  }

  res.status(201).json({ invite: toInviteView(invite) });
}

export async function listInvites(_req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const open = { status: "pending", expiresAt: { gt: new Date() } } as const;

  const [incoming, outgoing] = await Promise.all([
    prisma.gameInvite.findMany({
      where: { ...open, recipientId: userId },
      orderBy: { createdAt: "desc" },
      select: inviteSelect,
    }),
    prisma.gameInvite.findMany({
      where: { ...open, senderId: userId },
      orderBy: { createdAt: "desc" },
      select: inviteSelect,
    }),
  ]);

  res.json({ incoming: incoming.map(toInviteView), outgoing: outgoing.map(toInviteView) });
}

// Only the recipient may accept or decline and only the sender may cancel, so anyone else gets "not found".
// A permitted user gets a conflict when the invite was already answered or has expired.
async function rejectInvite(inviteId: string, userId: string, role: "senderId" | "recipientId", res: Response): Promise<void> {
  const known = await prisma.gameInvite.findFirst({
    where: { id: inviteId, [role]: userId },
    select: { id: true },
  });
  if (!known) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  res.status(409).json({ error: "Invite is no longer pending" });
}

const readInviteId = (req: Request): string | null => (isUuid(req.params.id) ? req.params.id : null);

// Only the recipient may decline and only the sender may cancel; both are one-way moves out of pending.
const closeInvite = (status: "declined" | "cancelled") => async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(res);
  const inviteId = readInviteId(req);
  if (!inviteId) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const now = new Date();
  const { count } = await prisma.gameInvite.updateMany({
    where: {
      id: inviteId,
      ...(status === "cancelled" ? { senderId: userId } : { recipientId: userId }),
      status: "pending",
      expiresAt: { gt: now },
    },
    data: { status, pairKey: null, respondedAt: now },
  });

  if (count !== 1) {
    await rejectInvite(inviteId, userId, status === "cancelled" ? "senderId" : "recipientId", res);
    return;
  }
  res.json({ status });
};

export const declineInvite = closeInvite("declined");
export const cancelInvite = closeInvite("cancelled");

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const inviteId = readInviteId(req);
  if (!inviteId) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const now = new Date();
  // The conditional update claims the invite, so two accepts at once cannot both create a game.
  const accepted = await prisma.$transaction(async (tx) => {
    const { count } = await tx.gameInvite.updateMany({
      where: { id: inviteId, recipientId: userId, status: "pending", expiresAt: { gt: now } },
      data: { status: "accepted", pairKey: null, respondedAt: now },
    });
    if (count !== 1) return null;

    const invite = await tx.gameInvite.findFirst({
      where: { id: inviteId },
      select: { senderId: true, timeControlId: true, senderColor: true },
    });
    if (!invite || !isTimeControlId(invite.timeControlId)) throw new Error(`Invite ${inviteId} is invalid`);

    // The sender may have asked for a color; otherwise it is a coin flip.
    const senderIsWhite = invite.senderColor ? invite.senderColor === "white" : Math.random() < 0.5;
    const whiteId = senderIsWhite ? invite.senderId : userId;
    const blackId = senderIsWhite ? userId : invite.senderId;
    const { data } = newGameData(invite.timeControlId, whiteId, blackId, now.getTime());
    const game = await tx.game.create({ data });
    await tx.gameInvite.update({ where: { id: inviteId }, data: { gameId: game.id } });

    return { gameId: game.id, color: senderIsWhite ? "black" : "white", timeControl: invite.timeControlId } as const;
  });

  if (!accepted) {
    await rejectInvite(inviteId, userId, "recipientId", res);
    return;
  }
  res.status(201).json(accepted);
}

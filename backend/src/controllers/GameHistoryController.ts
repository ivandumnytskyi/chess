import type { Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { prisma } from "../../lib/prisma";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLimit(value: unknown): number | null {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const limit = Number(value);
  return limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

// Results are stored per color, so this converts them to win, loss or draw for the given player.
function outcomeFor(color: "white" | "black", result: string | null): "win" | "loss" | "draw" | null {
  if (!result) return null;
  if (result === "draw") return "draw";
  return (color === "white") === (result === "white_wins") ? "win" : "loss";
}

export async function listGames(req: Request, res: Response): Promise<void> {
  const user: User = res.locals.user;

  const limit = readLimit(req.query.limit);
  if (limit === null) {
    res.status(400).json({ error: `limit must be a whole number from 1 to ${MAX_LIMIT}` });
    return;
  }

  const { cursor } = req.query;
  if (cursor !== undefined && (typeof cursor !== "string" || !UUID_PATTERN.test(cursor))) {
    res.status(400).json({ error: "cursor must be a game id" });
    return;
  }

  // One extra row shows whether another page exists without a second query.
  const rows = await prisma.game.findMany({
    where: { status: "finished", OR: [{ whitePlayerId: user.id }, { blackPlayerId: user.id }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      whitePlayerId: true,
      timeControlId: true,
      status: true,
      result: true,
      endReason: true,
      createdAt: true,
      finishedAt: true,
      whitePlayer: { select: { username: true } },
      blackPlayer: { select: { username: true } },
    },
  });

  const page = rows.slice(0, limit);
  const games = page.map((game) => {
    const color = game.whitePlayerId === user.id ? "white" : "black";
    const opponent = color === "white" ? game.blackPlayer : game.whitePlayer;
    return {
      id: game.id,
      color,
      opponentUsername: opponent?.username ?? null,
      timeControlId: game.timeControlId,
      status: game.status,
      result: game.result,
      endReason: game.endReason,
      outcome: outcomeFor(color, game.result),
      createdAt: game.createdAt,
      finishedAt: game.finishedAt,
    };
  });

  const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
  res.json({ games, nextCursor });
}

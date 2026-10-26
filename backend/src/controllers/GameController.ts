import { type Request, type Response } from "express";
import type { User } from "@supabase/supabase-js";
import { ChessGame } from "../game/ChessGame";
import type { Color, GameStatus, MoveData, Position } from "../types/chess";
import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  applyMoveToClock,
  createClock,
  isTimeControlId,
  remainingAt,
  type Clock,
  type TimeControlId,
} from "../game/timeControls";
import { prisma } from "../../lib/prisma";
import { Prisma, type Game as GameRow } from "../../generated/prisma/client";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LoadedGame = {
  row: GameRow;
  game: ChessGame;
  moveCount: number;
};

const getUserId = (res: Response): string => (res.locals.user as User).id;

const resultFor = (winner: Color): "white_wins" | "black_wins" =>
  winner === "white" ? "white_wins" : "black_wins";

// Rebuilds the in-memory board by replaying the stored moves. Returns null when the game is missing or the user is not a player.
const loadOwnedGame = async (gameId: unknown, userId: string): Promise<LoadedGame | null> => {
  if (typeof gameId !== "string" || !UUID_PATTERN.test(gameId)) return null;

  const row = await prisma.game.findFirst({
    where: {
      id: gameId,
      OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
    },
    include: { moves: { orderBy: { ply: "asc" } } },
  });
  if (!row) return null;

  const game = new ChessGame();
  for (const stored of row.moves) {
    const move: unknown = stored.move;
    if (!isMoveData(move)) throw new Error(`Stored move ${stored.ply} of game ${row.id} is invalid`);
    game.makeMove({ from: move.from, to: move.to }, stored.color);
  }

  return { row, game, moveCount: row.moves.length };
};

const clockFromRow = (row: GameRow): Clock => ({
  whiteRemainingMs: row.whiteRemainingMs,
  blackRemainingMs: row.blackRemainingMs,
  lastMoveAt: (row.lastMoveAt ?? row.createdAt).getTime(),
});

const opponentOf = (color: Color): Color => (color === "white" ? "black" : "white");

const clockView = (clock: Clock) => ({
  whiteRemainingMs: clock.whiteRemainingMs,
  blackRemainingMs: clock.blackRemainingMs,
});

const COLORS: readonly unknown[] = ["white", "black"];
const isColor = (value: unknown): value is Color => COLORS.includes(value);

const isSquareIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 8;

const isPosition = (value: unknown): value is Position =>
  typeof value === "object" && value !== null &&
  isSquareIndex((value as Position).row) && isSquareIndex((value as Position).col);

const isMoveData = (value: unknown): value is MoveData =>
  typeof value === "object" && value !== null &&
  isPosition((value as MoveData).from) && isPosition((value as MoveData).to);

// 1. Create new game → return gameId
export const createNewGame = async (req: Request, res: Response) => {
  const { timeControl } = (req.body ?? {}) as { timeControl?: unknown };
  if (timeControl !== undefined && !isTimeControlId(timeControl)) {
    return res.status(400).send("Invalid time control");
  }
  const timeControlId = isTimeControlId(timeControl) ? timeControl : DEFAULT_TIME_CONTROL;

  const game = new ChessGame();
  const clock = createClock(timeControlId, Date.now());
  const row = await prisma.game.create({
    data: {
      whitePlayerId: getUserId(res),
      timeControlId,
      timeInitialMs: TIME_CONTROLS[timeControlId].initialMs,
      timeIncrementMs: TIME_CONTROLS[timeControlId].incrementMs,
      whiteRemainingMs: clock.whiteRemainingMs,
      blackRemainingMs: clock.blackRemainingMs,
      lastMoveAt: new Date(clock.lastMoveAt),
    },
  });

  res.json({
    gameId: row.id,
    boardState: game.getBoardState(),
    currentTurn: game.getCurrentTurn(),
    timeControl: timeControlId,
    clock: clockView(clock),
  });
}

// 2. Make move → use gameId to find game
export const makeMove = async (req: Request, res: Response) => {
  const { gameId, moveData, color } = (req.body ?? {}) as { gameId?: unknown; moveData?: unknown; color?: unknown };
  if (typeof gameId !== "string" || !isColor(color) || !isMoveData(moveData)) {
    return res.status(400).send("Invalid request body");
  }
  const loaded = await loadOwnedGame(gameId, getUserId(res));
  if (!loaded) return res.status(404).send("Game not found");
  const { row, game, moveCount } = loaded;
  if (row.status === "finished") return res.status(409).send("Game is over");

  const now = Date.now();
  const update = applyMoveToClock(clockFromRow(row), color, now, row.timeIncrementMs);
  if (update.timedOut) {
    const winner = opponentOf(color);
    await finishGame(row.id, update.clock, now, { winner, endReason: "timeout" });
    return res.status(409).json({ error: "Time expired", winner, clock: clockView(update.clock) });
  }

  try {
    game.makeMove(moveData, color);
  } catch (err) {
    return res.status(400).send(err instanceof Error ? err.message : "Invalid move");
  }

  const status = game.getGameStatus();
  const ended = endOfGame(status, color);
  await prisma.$transaction([
    prisma.move.create({
      data: {
        gameId: row.id,
        ply: moveCount + 1,
        color,
        move: { from: moveData.from, to: moveData.to } as Prisma.InputJsonValue,
      },
    }),
    prisma.game.update({
      where: { id: row.id },
      data: {
        whiteRemainingMs: update.clock.whiteRemainingMs,
        blackRemainingMs: update.clock.blackRemainingMs,
        lastMoveAt: new Date(now),
        currentTurn: game.getCurrentTurn(),
        ...ended,
        finishedAt: ended.status === "finished" ? new Date(now) : null,
      },
    }),
  ]);

  res.json({
    boardState: game.getBoardState(),
    currentTurn: game.getCurrentTurn(),
    status,
    legalMoves: game.getLegalMovesForTurn(),
    clock: clockView(update.clock),
  });
}

// Maps the board's end state to the stored result. Active and check games return no end fields.
const endOfGame = (status: GameStatus, mover: Color) => {
  if (status === "checkmate") {
    return { status: "finished" as const, result: resultFor(mover), endReason: "checkmate" as const };
  }
  if (status === "stalemate") {
    return { status: "finished" as const, result: "draw" as const, endReason: "stalemate" as const };
  }
  if (status === "draw") {
    return { status: "finished" as const, result: "draw" as const, endReason: "draw" as const };
  }
  return { status: "active" as const, result: null, endReason: null };
};

const finishGame = (
  gameId: string,
  clock: Clock,
  now: number,
  outcome: { winner: Color; endReason: "timeout" }
) =>
  prisma.game.update({
    where: { id: gameId },
    data: {
      whiteRemainingMs: clock.whiteRemainingMs,
      blackRemainingMs: clock.blackRemainingMs,
      lastMoveAt: new Date(now),
      status: "finished",
      result: resultFor(outcome.winner),
      endReason: outcome.endReason,
      finishedAt: new Date(now),
    },
  });

// Flags the side to move when its clock has run out, without waiting for another move.
export const timeoutGame = async (req: Request, res: Response) => {
  const { gameId } = (req.body ?? {}) as { gameId?: unknown };
  if (typeof gameId !== "string") {
    return res.status(400).send("Invalid request body");
  }
  const loaded = await loadOwnedGame(gameId, getUserId(res));
  if (!loaded) return res.status(404).send("Game not found");
  const { row, game } = loaded;
  if (row.status === "finished") return res.status(409).send("Game is over");

  const now = Date.now();
  const clock = clockFromRow(row);
  const turn = game.getCurrentTurn();
  if (remainingAt(clock, turn, now) > 0) {
    return res.status(409).send("Time has not expired");
  }

  if (turn === "white") clock.whiteRemainingMs = 0;
  else clock.blackRemainingMs = 0;
  const winner = opponentOf(turn);
  await finishGame(row.id, clock, now, { winner, endReason: "timeout" });
  res.json({ winner, clock: clockView(clock) });
}

// 3. Get legal moves for every piece of the side to move → use gameId
export const getAllLegalMoves = async (req: Request, res: Response) => {
  const { gameId } = req.query as { gameId: string };
  const loaded = await loadOwnedGame(gameId, getUserId(res));

  if (!loaded) return res.status(404).send("Game not found");
  res.json({ legalMoves: loaded.game.getLegalMovesForTurn() });
}
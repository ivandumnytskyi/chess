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
import { broadcastGameMove } from "../../lib/supabase";
import { Prisma, type Game as GameRow } from "../../generated/prisma/client";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LoadedGame = {
  row: GameRow & { whitePlayer: { username: string | null } | null; blackPlayer: { username: string | null } | null };
  game: ChessGame;
  moveCount: number;
  moves: MoveData[];
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
    relationLoadStrategy: "join",
    include: {
      moves: { orderBy: { ply: "asc" } },
      whitePlayer: { select: { username: true } },
      blackPlayer: { select: { username: true } },
    },
  });
  if (!row) return null;

  const game = new ChessGame();
  const moves: MoveData[] = [];
  for (const stored of row.moves) {
    const move: unknown = stored.move;
    if (!isMoveData(move)) throw new Error(`Stored move ${stored.ply} of game ${row.id} is invalid`);
    game.makeMove({ from: move.from, to: move.to }, stored.color, move.promotion);
    moves.push(move);
  }

  return { row, game, moveCount: row.moves.length, moves };
};

const clockFromRow = (row: GameRow): Clock => ({
  whiteRemainingMs: row.whiteRemainingMs,
  blackRemainingMs: row.blackRemainingMs,
  lastMoveAt: (row.lastMoveAt ?? row.createdAt).getTime(),
});

const opponentOf = (color: Color): Color => (color === "white" ? "black" : "white");

// Row data for a fresh game with a full clock. Solo games have no black player.
export const newGameData = (
  timeControlId: TimeControlId,
  whitePlayerId: string,
  blackPlayerId: string | null,
  now: number,
) => {
  const clock = createClock(timeControlId, now);
  return {
    clock,
    data: {
      whitePlayerId,
      ...(blackPlayerId ? { blackPlayerId } : {}),
      timeControlId,
      timeInitialMs: TIME_CONTROLS[timeControlId].initialMs,
      timeIncrementMs: TIME_CONTROLS[timeControlId].incrementMs,
      whiteRemainingMs: clock.whiteRemainingMs,
      blackRemainingMs: clock.blackRemainingMs,
      lastMoveAt: new Date(clock.lastMoveAt),
    },
  };
};

// In a two-player game each player may only move their own color. Solo games let the owner move both.
const mayMoveAs = (row: GameRow, userId: string, color: Color): boolean => {
  if (!row.whitePlayerId || !row.blackPlayerId) return true;
  return (color === "white" ? row.whitePlayerId : row.blackPlayerId) === userId;
};

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

const PROMOTION_PIECES: readonly unknown[] = ["queen", "rook", "bishop", "knight"];

const isMoveData = (value: unknown): value is MoveData =>
  typeof value === "object" && value !== null &&
  isPosition((value as MoveData).from) && isPosition((value as MoveData).to) &&
  ((value as MoveData).promotion === undefined || PROMOTION_PIECES.includes((value as MoveData).promotion));

// 1. Create new game → return gameId
export const createNewGame = async (req: Request, res: Response) => {
  const { timeControl } = (req.body ?? {}) as { timeControl?: unknown };
  if (timeControl !== undefined && !isTimeControlId(timeControl)) {
    return res.status(400).send("Invalid time control");
  }
  const timeControlId = isTimeControlId(timeControl) ? timeControl : DEFAULT_TIME_CONTROL;

  const game = new ChessGame();
  const { clock, data } = newGameData(timeControlId, getUserId(res), null, Date.now());
  const row = await prisma.game.create({ data });

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
  if (!mayMoveAs(row, getUserId(res), color)) return res.status(403).send("Not your color");
  if (row.status === "finished") return res.status(409).send("Game is over");

  const now = Date.now();
  const update = applyMoveToClock(clockFromRow(row), color, now, row.timeIncrementMs);
  if (update.timedOut) {
    const winner = opponentOf(color);
    await finishGame(row.id, update.clock, now, { winner, endReason: "timeout" });
    return res.status(409).json({ error: "Time expired", winner, clock: clockView(update.clock) });
  }

  try {
    game.makeMove(moveData, color, moveData.promotion);
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
        move: {
          from: moveData.from,
          to: moveData.to,
          ...(moveData.promotion ? { promotion: moveData.promotion } : {}),
        } as Prisma.InputJsonValue,
      },
    }),
    prisma.game.update({
      where: { id: row.id },
      data: {
        whiteRemainingMs: update.clock.whiteRemainingMs,
        blackRemainingMs: update.clock.blackRemainingMs,
        lastMoveAt: new Date(now),
        currentTurn: game.getCurrentTurn(),
        // Moving counts as turning down a draw offer made by the other side.
        drawOfferedBy: row.drawOfferedBy === color ? row.drawOfferedBy : null,
        ...ended,
        finishedAt: ended.status === "finished" ? new Date(now) : null,
      },
    }),
  ]);

  const realtimeAccessToken: unknown = res.locals.realtimeAccessToken;
  if (typeof realtimeAccessToken === "string") {
    void broadcastGameMove(realtimeAccessToken, row.id, moveCount + 1, moveData)
      .catch((error: unknown) => {
        console.error("Could not broadcast validated game move", error);
      });
  }

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

// Ends the game on time when the side to move has run out of clock. Returns the result, or null if the game goes on.
const flagIfExpired = async ({ row, game }: LoadedGame, now: number): Promise<{ winner: Color; clock: Clock } | null> => {
  if (row.status === "finished") return null;

  const clock = clockFromRow(row);
  const turn = game.getCurrentTurn();
  if (remainingAt(clock, turn, now) > 0) return null;

  if (turn === "white") clock.whiteRemainingMs = 0;
  else clock.blackRemainingMs = 0;
  const winner = opponentOf(turn);
  await finishGame(row.id, clock, now, { winner, endReason: "timeout" });
  return { winner, clock };
};

// Flags the side to move when its clock has run out, without waiting for another move.
export const timeoutGame = async (req: Request, res: Response) => {
  const { gameId } = (req.body ?? {}) as { gameId?: unknown };
  if (typeof gameId !== "string") {
    return res.status(400).send("Invalid request body");
  }
  const loaded = await loadOwnedGame(gameId, getUserId(res));
  if (!loaded) return res.status(404).send("Game not found");
  if (loaded.row.status === "finished") return res.status(409).send("Game is over");

  const flagged = await flagIfExpired(loaded, Date.now());
  if (!flagged) return res.status(409).send("Time has not expired");

  res.json({ winner: flagged.winner, clock: clockView(flagged.clock) });
}

// 3. Get legal moves for every piece of the side to move → use gameId
export const getAllLegalMoves = async (req: Request, res: Response) => {
  const { gameId } = req.query as { gameId: string };
  const loaded = await loadOwnedGame(gameId, getUserId(res));

  if (!loaded) return res.status(404).send("Game not found");
  res.json({ legalMoves: loaded.game.getLegalMovesForTurn() });
}

// The color a player has in a two-player game. Solo games have no fixed seat.
const seatOf = (row: GameRow, userId: string): Color | null => {
  if (!row.whitePlayerId || !row.blackPlayerId) return null;
  return row.whitePlayerId === userId ? "white" : "black";
};

const winnerOf = (result: GameRow["result"]): Color | null =>
  result === "white_wins" ? "white" : result === "black_wins" ? "black" : null;

const gameView = ({ row, game, moves }: LoadedGame, userId: string, now: number) => {
  const finished = row.status === "finished";
  const turn = game.getCurrentTurn();
  const clock = clockView(clockFromRow(row));
  // The stored time is from the last move, so the side to move is charged for the time since then.
  if (!finished) {
    const left = Math.max(0, remainingAt(clockFromRow(row), turn, now));
    if (turn === "white") clock.whiteRemainingMs = left;
    else clock.blackRemainingMs = left;
  }
  const lastMove = moves[moves.length - 1];

  return {
    gameId: row.id,
    yourColor: seatOf(row, userId),
    timeControl: row.timeControlId,
    boardState: game.getBoardState(),
    currentTurn: turn,
    status: game.getGameStatus(),
    finished,
    result: row.result,
    winner: winnerOf(row.result),
    endReason: row.endReason,
    legalMoves: finished ? [] : game.getLegalMovesForTurn(),
    moveCount: moves.length,
    lastMove: lastMove ? { from: lastMove.from, to: lastMove.to } : null,
    drawOfferedBy: finished ? null : row.drawOfferedBy,
    players: { white: row.whitePlayer?.username ?? null, black: row.blackPlayer?.username ?? null },
    clock,
  };
};

// 4. Load a game's current state. Clients poll this to see the opponent's moves, and a lapsed clock ends the game here.
export const getGame = async (req: Request, res: Response) => {
  const userId = getUserId(res);
  const now = Date.now();

  const t0 = performance.now();
  let loaded = await loadOwnedGame(req.params.id, userId);
  if (!loaded) return res.status(404).send("Game not found");

  const t1 = performance.now();
  if (await flagIfExpired(loaded, now)) {
    loaded = await loadOwnedGame(req.params.id, userId);
    if (!loaded) return res.status(404).send("Game not found");
  }

  const t2 = performance.now();
  const view = gameView(loaded, userId, now);
  res.json(view);
}

type ActiveGame = { loaded: LoadedGame; seat: Color };

// Shared checks for resigning and draw offers: a two-player game that is still running. Sends the error itself.
const loadActiveTwoPlayerGame = async (req: Request, res: Response): Promise<ActiveGame | null> => {
  const { gameId } = (req.body ?? {}) as { gameId?: unknown };
  if (typeof gameId !== "string") {
    res.status(400).send("Invalid request body");
    return null;
  }
  const loaded = await loadOwnedGame(gameId, getUserId(res));
  if (!loaded) {
    res.status(404).send("Game not found");
    return null;
  }
  const seat = seatOf(loaded.row, getUserId(res));
  if (!seat) {
    res.status(400).send("Not a two-player game");
    return null;
  }
  if (loaded.row.status === "finished") {
    res.status(409).send("Game is over");
    return null;
  }
  const flagged = await flagIfExpired(loaded, Date.now());
  if (flagged) {
    res.status(409).json({ error: "Time expired", winner: flagged.winner, clock: clockView(flagged.clock) });
    return null;
  }
  return { loaded, seat };
};

// The conditional updates below only match a running game, so a result that landed first is never overwritten.
export const resignGame = async (req: Request, res: Response) => {
  const active = await loadActiveTwoPlayerGame(req, res);
  if (!active) return;
  const { loaded, seat } = active;

  const winner = opponentOf(seat);
  const { count } = await prisma.game.updateMany({
    where: { id: loaded.row.id, status: "active" },
    data: {
      status: "finished",
      result: resultFor(winner),
      endReason: "resignation",
      drawOfferedBy: null,
      finishedAt: new Date(),
    },
  });
  if (count !== 1) return res.status(409).send("Game is over");

  res.json({ winner });
}

export const offerDraw = async (req: Request, res: Response) => {
  const active = await loadActiveTwoPlayerGame(req, res);
  if (!active) return;
  const { loaded, seat } = active;

  const { count } = await prisma.game.updateMany({
    where: { id: loaded.row.id, status: "active", drawOfferedBy: null },
    data: { drawOfferedBy: seat },
  });
  if (count !== 1) return res.status(409).send("A draw offer is already pending");

  res.json({ drawOfferedBy: seat });
}

export const acceptDraw = async (req: Request, res: Response) => {
  const active = await loadActiveTwoPlayerGame(req, res);
  if (!active) return;
  const { loaded, seat } = active;

  const { count } = await prisma.game.updateMany({
    where: { id: loaded.row.id, status: "active", drawOfferedBy: opponentOf(seat) },
    data: { status: "finished", result: "draw", endReason: "agreement", drawOfferedBy: null, finishedAt: new Date() },
  });
  if (count !== 1) return res.status(409).send("There is no draw offer to accept");

  res.json({ result: "draw" });
}

export const declineDraw = async (req: Request, res: Response) => {
  const active = await loadActiveTwoPlayerGame(req, res);
  if (!active) return;
  const { loaded, seat } = active;

  const { count } = await prisma.game.updateMany({
    where: { id: loaded.row.id, status: "active", drawOfferedBy: opponentOf(seat) },
    data: { drawOfferedBy: null },
  });
  if (count !== 1) return res.status(409).send("There is no draw offer to decline");

  res.json({ drawOfferedBy: null });
}
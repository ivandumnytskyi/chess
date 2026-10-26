import { type Request, type Response } from "express";
import type { User } from "@supabase/supabase-js";
import { ChessGame } from "../game/ChessGame";
import type { Color, MoveData, Position } from "../types/chess";
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

interface StoredGame {
  game: ChessGame;
  ownerId: string;
  timeControl: TimeControlId;
  clock: Clock;
  winner?: Color;
}

// Store games in memory (with IDs as keys)
const games: Map<string, StoredGame> = new Map();

const getUserId = (res: Response): string => (res.locals.user as User).id;

// Returns the stored game only when it exists and belongs to the requesting user.
const getOwnedStoredGame = (gameId: unknown, userId: string): StoredGame | undefined => {
  if (typeof gameId !== "string") return undefined;
  const stored = games.get(gameId);
  return stored && stored.ownerId === userId ? stored : undefined;
};

const getOwnedGame = (gameId: unknown, userId: string): ChessGame | undefined =>
  getOwnedStoredGame(gameId, userId)?.game;

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
export const createNewGame = (req: Request, res: Response) => {
  const { timeControl } = (req.body ?? {}) as { timeControl?: unknown };
  if (timeControl !== undefined && !isTimeControlId(timeControl)) {
    return res.status(400).send("Invalid time control");
  }
  const timeControlId = isTimeControlId(timeControl) ? timeControl : DEFAULT_TIME_CONTROL;

  const gameId: string = crypto.randomUUID();; // uuid 
  const game = new ChessGame();
  const clock = createClock(timeControlId, Date.now());
  games.set(gameId, { game, ownerId: getUserId(res), timeControl: timeControlId, clock });

  res.json({
    gameId,
    boardState: game.getBoardState(),
    currentTurn: game.getCurrentTurn(),
    timeControl: timeControlId,
    clock: clockView(clock),
  });
}

// 2. Make move → use gameId to find game
export const makeMove = (req: Request, res: Response) => {
  const { gameId, moveData, color } = (req.body ?? {}) as { gameId?: unknown; moveData?: unknown; color?: unknown };
  if (typeof gameId !== "string" || !isColor(color) || !isMoveData(moveData)) {
    return res.status(400).send("Invalid request body");
  }
  const stored = getOwnedStoredGame(gameId, getUserId(res));
  if (!stored) return res.status(404).send("Game not found");
  if (stored.winner) return res.status(409).send("Game is over");

  const { game } = stored;
  const update = applyMoveToClock(stored.clock, color, Date.now(), TIME_CONTROLS[stored.timeControl].incrementMs);
  if (update.timedOut) {
    stored.clock = update.clock;
    stored.winner = opponentOf(color);
    return res.status(409).json({ error: "Time expired", winner: stored.winner, clock: clockView(stored.clock) });
  }

  try {
    game.makeMove(moveData, color);
  } catch (err) {
    return res.status(400).send(err instanceof Error ? err.message : "Invalid move");
  }
  stored.clock = update.clock;
  res.json({
    boardState: game.getBoardState(),
    currentTurn: game.getCurrentTurn(),
    status: game.getGameStatus(),
    legalMoves: game.getLegalMovesForTurn(),
    clock: clockView(stored.clock),
  });
}

// Flags the side to move when its clock has run out, without waiting for another move.
export const timeoutGame = (req: Request, res: Response) => {
  const { gameId } = (req.body ?? {}) as { gameId?: unknown };
  if (typeof gameId !== "string") {
    return res.status(400).send("Invalid request body");
  }
  const stored = getOwnedStoredGame(gameId, getUserId(res));
  if (!stored) return res.status(404).send("Game not found");
  if (stored.winner) return res.status(409).send("Game is over");

  const turn = stored.game.getCurrentTurn();
  if (remainingAt(stored.clock, turn, Date.now()) > 0) {
    return res.status(409).send("Time has not expired");
  }

  if (turn === "white") stored.clock.whiteRemainingMs = 0;
  else stored.clock.blackRemainingMs = 0;
  stored.winner = opponentOf(turn);
  res.json({ winner: stored.winner, clock: clockView(stored.clock) });
}

// 3. Get legal moves for every piece of the side to move → use gameId
export const getAllLegalMoves = (req: Request, res: Response) => {
  const { gameId } = req.query as { gameId: string };
  const game = getOwnedGame(gameId, getUserId(res));

  if (!game) return res.status(404).send("Game not found");
  res.json({ legalMoves: game.getLegalMovesForTurn() });
}
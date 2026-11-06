import { type Request, type Response } from "express";
import type { User } from "@supabase/supabase-js";
import { ChessGame } from "../game/ChessGame";
import type { Color, GameStatus, MoveData, Position } from "../types/chess";
import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  UNTIMED_TIME_CONTROL,
  applyMoveToClock,
  createClock,
  isSoloTimeControlId,
  isTimeControlId,
  remainingAt,
  type Clock,
  type SoloTimeControlId,
  type TimeControlId,
} from "../game/timeControls";
import { BotDifficultyLevels, type BotDifficultyLevel } from "../bot/botDifficultyLevels";
import { botEngine } from "../bot/StockFishEngine";
import { convertMove } from "../pieces/helpers/convMoveSt";
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

// Row data for a fresh game. Solo games have no black player. Untimed games store no clock and no time limit.
export const newGameData = (
  timeControlId: SoloTimeControlId,
  whitePlayerId: string | null,
  blackPlayerId: string | null,
  now: number,
  untimed = false,
) => {
  const clockTimeControl = !untimed && isTimeControlId(timeControlId) ? timeControlId : null;
  const clock = clockTimeControl ? createClock(clockTimeControl, now) : null;
  return {
    clock,
    data: {
      ...(whitePlayerId ? { whitePlayerId } : {}),
      ...(blackPlayerId ? { blackPlayerId } : {}),
      timeControlId,
      timeInitialMs: clockTimeControl ? TIME_CONTROLS[clockTimeControl].initialMs : 0,
      timeIncrementMs: clockTimeControl ? TIME_CONTROLS[clockTimeControl].incrementMs : 0,
      whiteRemainingMs: clock?.whiteRemainingMs ?? 0,
      blackRemainingMs: clock?.blackRemainingMs ?? 0,
      lastMoveAt: clock ? new Date(clock.lastMoveAt) : null,
    },
  };
};

// Bot games and untimed solo games have no clock, so moves never time out.
const isUntimedGame = (row: GameRow): boolean =>
  row.botColor !== null || row.timeControlId === UNTIMED_TIME_CONTROL;

// In a two-player game each player may only move their own color. Solo games let the owner move both.
// In a bot game the bot's color is never movable by the player.
const mayMoveAs = (row: GameRow, userId: string, color: Color): boolean => {
  if (row.botColor === color) return false;
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

const isBotDifficultyLevel = (value: unknown): value is BotDifficultyLevel =>
  typeof value === "string" && Object.hasOwn(BotDifficultyLevels, value);

const moveJson = (move: MoveData): Prisma.InputJsonValue => ({
  from: move.from,
  to: move.to,
  ...(move.promotion ? { promotion: move.promotion } : {}),
}) as Prisma.InputJsonValue;

// Asks Stockfish for a move at the given level and plays it on the board.
const chooseBotMove = async (game: ChessGame, botColor: Color, level: BotDifficultyLevel): Promise<MoveData> => {
  const uci = await botEngine.bestMove(game.getFenNotation(), BotDifficultyLevels[level]);
  if (!uci) throw new Error("Bot has no legal move");
  const move = convertMove(uci);
  game.makeMove(move, botColor, move.promotion);
  return move;
};

// 1. Create new game → return gameId. A bot game is created when botDifficulty is sent.
export const createNewGame = async (req: Request, res: Response) => {
  const { timeControl, botDifficulty, playerColor } = (req.body ?? {}) as {
    timeControl?: unknown;
    botDifficulty?: unknown;
    playerColor?: unknown;
  };
  if (timeControl !== undefined && !isSoloTimeControlId(timeControl)) {
    return res.status(400).send("Invalid time control");
  }
  if (botDifficulty !== undefined && !isBotDifficultyLevel(botDifficulty)) {
    return res.status(400).send("Invalid bot difficulty");
  }
  if (playerColor !== undefined && !isColor(playerColor)) {
    return res.status(400).send("Invalid player color");
  }
  const userId = getUserId(res);
  const humanColor: Color = isColor(playerColor) ? playerColor : "white";

  const game = new ChessGame();
  const botLevel = isBotDifficultyLevel(botDifficulty) ? botDifficulty : null;
  // Bot games are untimed; the time control is only used for human games.
  const timeControlId: SoloTimeControlId = botLevel ? "10+0" : (isSoloTimeControlId(timeControl) ? timeControl : DEFAULT_TIME_CONTROL);
  const botColor = botLevel ? opponentOf(humanColor) : null;

  // White moves first. When the bot is white, its opening move is chosen before the game row is written,
  // so a failed engine call leaves no half-created game behind.
  let botMove: MoveData | null = null;
  if (botLevel && botColor && game.getCurrentTurn() === botColor) {
    try {
      botMove = await chooseBotMove(game, botColor, botLevel);
    } catch {
      return res.status(503).send("Bot is unavailable");
    }
  }

  const { clock, data } = newGameData(
    timeControlId,
    humanColor === "white" ? userId : null,
    humanColor === "black" ? userId : null,
    Date.now(),
    botLevel !== null,
  );
  const row = await prisma.game.create({
    data: {
      ...data,
      ...(botLevel && botColor ? { botDifficulty: botLevel, botColor } : {}),
      ...(botMove && botColor
        ? {
          currentTurn: game.getCurrentTurn(),
          moves: { create: { ply: 1, color: botColor, move: moveJson(botMove) } },
        }
        : {}),
    },
  });

  res.json({
    gameId: row.id,
    boardState: game.getBoardState(),
    currentTurn: game.getCurrentTurn(),
    timeControl: timeControlId,
    clock: clock ? clockView(clock) : null,
    botDifficulty: row.botDifficulty,
    botColor: row.botColor,
    botMove,
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
  const update = isUntimedGame(row) ? null : applyMoveToClock(clockFromRow(row), color, now, row.timeIncrementMs);
  if (update?.timedOut) {
    const winner = opponentOf(color);
    await finishGame(row.id, update.clock, now, { winner, endReason: "timeout" });
    return res.status(409).json({ error: "Time expired", winner, clock: clockView(update.clock) });
  }

  try {
    game.makeMove(moveData, color, moveData.promotion);
  } catch (err) {
    return res.status(400).send(err instanceof Error ? err.message : "Invalid move");
  }

  // Bot reply is chosen before anything is saved, so an engine failure leaves the game unchanged.
  const status = game.getGameStatus();
  const botColor = row.botColor;
  const botIsToMove = botColor !== null && game.getCurrentTurn() === botColor;
  let botMove: MoveData | null = null;
  if (botColor && row.botDifficulty && botIsToMove && endOfGame(status, color).status === "active") {
    try {
      botMove = await chooseBotMove(game, botColor, row.botDifficulty);
    } catch {
      return res.status(503).send("Bot is unavailable");
    }
  }

  const finalStatus = game.getGameStatus();
  const mover: Color = botMove && botColor ? botColor : color;
  const ended = endOfGame(finalStatus, mover);
  const clock = update?.clock ?? null;
  const savedMoves: { ply: number; color: Color; move: MoveData }[] = [
    { ply: moveCount + 1, color, move: moveData },
    ...(botMove && botColor ? [{ ply: moveCount + 2, color: botColor, move: botMove }] : []),
  ];
  await prisma.$transaction([
    ...savedMoves.map((saved) =>
      prisma.move.create({
        data: {
          gameId: row.id,
          ply: saved.ply,
          color: saved.color,
          move: moveJson(saved.move),
        },
      }),
    ),
    prisma.game.update({
      where: { id: row.id },
      data: {
        ...(clock ? { whiteRemainingMs: clock.whiteRemainingMs, blackRemainingMs: clock.blackRemainingMs, lastMoveAt: new Date(now) } : {}),
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
    for (const saved of savedMoves) {
      void broadcastGameMove(realtimeAccessToken, row.id, saved.ply, saved.move)
        .catch((error: unknown) => {
          console.error(JSON.stringify({
            event: "game_move_broadcast_request_failed",
            gameId: row.id,
            ply: saved.ply,
            error: error instanceof Error ? error.message : String(error),
          }));
        });
    }
  }

  const boardState = game.getBoardState();
  const legalMoves = game.getLegalMovesForTurn();
  res.json({
    boardState,
    currentTurn: game.getCurrentTurn(),
    status: finalStatus,
    winner: winnerOf(ended.result),
    endReason: ended.endReason,
    legalMoves,
    clock: clock ? clockView(clock) : null,
    botMove,
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
  if (row.status === "finished" || isUntimedGame(row)) return null;

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
  if (isUntimedGame(loaded.row)) return res.status(409).send("Game has no clock");

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
  if (row.botColor) {
    return row.whitePlayerId === userId || row.blackPlayerId === userId ? opponentOf(row.botColor) : null;
  }
  if (!row.whitePlayerId || !row.blackPlayerId) return null;
  return row.whitePlayerId === userId ? "white" : "black";
};

const winnerOf = (result: GameRow["result"]): Color | null =>
  result === "white_wins" ? "white" : result === "black_wins" ? "black" : null;

const gameView = ({ row, game, moves }: LoadedGame, userId: string, now: number) => {
  const finished = row.status === "finished";
  const turn = game.getCurrentTurn();
  const clock = isUntimedGame(row) ? null : clockView(clockFromRow(row));
  // The stored time is from the last move, so the side to move is charged for the time since then.
  if (clock && !finished) {
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
    isBotGame: row.botColor !== null,
    botDifficulty: row.botDifficulty,
    clock,
  };
};

// 4. Load a game's current state. Clients poll this to see the opponent's moves, and a lapsed clock ends the game here.
export const getGame = async (req: Request, res: Response) => {
  const userId = getUserId(res);
  const now = Date.now();

  let loaded = await loadOwnedGame(req.params.id, userId);
  if (!loaded) return res.status(404).send("Game not found");

  if (await flagIfExpired(loaded, now)) {
    loaded = await loadOwnedGame(req.params.id, userId);
    if (!loaded) return res.status(404).send("Game not found");
  }

  const view = gameView(loaded, userId, now);
  res.json(view);
}

type ActiveGame = { loaded: LoadedGame; seat: Color };

// Shared checks for resigning and draw offers: a running game the viewer has a seat in. Sends the error itself.
// Draw offers pass twoPlayerOnly, which rejects bot games.
const loadActiveSeatedGame = async (
  req: Request,
  res: Response,
  { twoPlayerOnly }: { twoPlayerOnly: boolean },
): Promise<ActiveGame | null> => {
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
  if (!seat || (twoPlayerOnly && loaded.row.botColor !== null)) {
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
  const active = await loadActiveSeatedGame(req, res, { twoPlayerOnly: false });
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
  const active = await loadActiveSeatedGame(req, res, { twoPlayerOnly: true });
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
  const active = await loadActiveSeatedGame(req, res, { twoPlayerOnly: true });
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
  const active = await loadActiveSeatedGame(req, res, { twoPlayerOnly: true });
  if (!active) return;
  const { loaded, seat } = active;

  const { count } = await prisma.game.updateMany({
    where: { id: loaded.row.id, status: "active", drawOfferedBy: opponentOf(seat) },
    data: { drawOfferedBy: null },
  });
  if (count !== 1) return res.status(409).send("There is no draw offer to decline");

  res.json({ drawOfferedBy: null });
}
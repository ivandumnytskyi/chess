import { type Request, type Response } from "express";
import { ChessGame } from "../game/ChessGame";
import type { Color, MoveData, Position } from "../types/chess";

// Store games in memory (with IDs as keys)
const games: Map<string, ChessGame> = new Map();

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

// Query params arrive as strings, so only a single digit 0-7 is accepted.
const toIndex = (value: unknown): number | undefined =>
  typeof value === "string" && /^[0-7]$/.test(value) ? Number(value) : undefined;

// 1. Create new game → return gameId
export const createNewGame = (req: Request, res: Response) => {
  const gameId: string = crypto.randomUUID();; // uuid 
  const game = new ChessGame();
  games.set(gameId, game);
 
  res.json({ gameId, boardState: game.getBoardState(), currentTurn: game.getCurrentTurn() });
}

// 2. Make move → use gameId to find game
export const makeMove = (req: Request, res: Response) => {
  const { gameId, moveData, color } = (req.body ?? {}) as { gameId?: unknown; moveData?: unknown; color?: unknown };
  if (typeof gameId !== "string" || !isColor(color) || !isMoveData(moveData)) {
    return res.status(400).send("Invalid request body");
  }
  const game = games.get(gameId);
  if (!game) return res.status(404).send("Game not found");
  
  try {
    game.makeMove(moveData, color);
  } catch (err) {
    return res.status(400).send(err instanceof Error ? err.message : "Invalid move");
  }
  res.json({ boardState: game.getBoardState(), currentTurn: game.getCurrentTurn() });
}

// 3. Get legal moves → use gameId
export const getLegalMoves = (req: Request, res: Response) => {
  const { gameId, row, col } = req.query as { gameId: string, row: string, col: string };
  const rowIndex = toIndex(row);
  const colIndex = toIndex(col);
  if (rowIndex === undefined || colIndex === undefined) return res.status(400).send("Invalid row or col");
  const game = games.get(gameId);

  if (!game) return res.status(404).send("Game not found");
  const legalMoves = game.getLegalMoves({ row: rowIndex, col: colIndex });
  res.json({ legalMoves });
}

// 4. Get game status → use gameId
export const getGameStatus = (req: Request, res: Response) => {
  const { gameId } = req.query as { gameId: string };
  const game = games.get(gameId);

  if (!game) return res.status(404).send("Game not found");
  res.json({ status: game.getGameStatus(), currentTurn: game.getCurrentTurn(), boardState: game.getBoardState() });
}

// 5. Get board state → use gameId
export const getBoardState = (req: Request, res: Response) => {
  const { gameId } = req.query as { gameId: string };
  const game = games.get(gameId);

  if (!game) return res.status(404).send("Game not found");
  res.json({ boardState: game.getBoardState(), currentTurn: game.getCurrentTurn() });
}
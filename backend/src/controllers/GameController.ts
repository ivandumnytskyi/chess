import { type Request, type Response } from "express";
import { ChessGame } from "../game/ChessGame";
import type { Color, MoveData } from "../types/chess";

// Store games in memory (with IDs as keys)
const games: Map<string, ChessGame> = new Map();

// 1. Create new game → return gameId
export const createNewGame = (req: Request, res: Response) => {
  const gameId: string = crypto.randomUUID();; // uuid 
  const game = new ChessGame();
  games.set(gameId, game);
 
  res.json({ gameId, boardState: game.getBoardState(), currentTurn: game.getCurrentTurn() });
}

// 2. Make move → use gameId to find game
export const makeMove = (req: Request, res: Response) => {
  const { gameId, moveData, color }: {gameId: string, moveData: MoveData, color: Color} = req.body;
  const game = games.get(gameId);
  if (!game) return res.status(404).send("Game not found");
  
  const success = game.makeMove(moveData, color);
  if (!success) return res.status(400).send("Invalid move");
  res.json({ boardState: game.getBoardState(), currentTurn: game.getCurrentTurn() });
}

// 3. Get legal moves → use gameId
export const getLegalMoves = (req: Request, res: Response) => {
  const { gameId, row, col } = req.query as { gameId: string, row: string, col: string };
  const game = games.get(gameId);

  if (!game) return res.status(404).send("Game not found");
  const legalMoves = game.getLegalMoves({row: Number(row), col: Number(col)});
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
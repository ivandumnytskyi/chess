export type Color = "white" | "black";

export type GameStatus =
  | 'active'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw'

export type Position = {
  row: number;
  col: number;
};

export type MoveData = {
  from: Position;
  to: Position;
};

export type PieceType =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";

export type Cell = { pieceType: PieceType; color: Color } | null;

export type GameView = {
  gameId: string;
  squares: Cell[][];
  currentTurn: Color;
  status: GameStatus;
  winner?: Color;
};

// Remaining time per side, as last reported by the server at `syncedAt` (local clock).
export type ClockState = {
  whiteRemainingMs: number;
  blackRemainingMs: number;
  syncedAt: number;
};

export type Color = "white" | "black";

export type GameStatus =
  | 'active'
  | 'check'
  | 'checkmate'
  | 'stalemate'

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
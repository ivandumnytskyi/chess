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

export type PromotionPiece = "queen" | "rook" | "bishop" | "knight";

export type MoveData = {
  from: Position;
  to: Position;
  promotion?: PromotionPiece;
};

export type PieceType =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";
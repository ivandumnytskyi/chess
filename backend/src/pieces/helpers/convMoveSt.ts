import type { MoveData, Position, PromotionPiece } from "../../types/chess";

const PROMOTION_BY_LETTER: Record<string, PromotionPiece> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

const toPosition = (square: string): Position => ({
  row: 8 - Number(square[1]),
  col: square.charCodeAt(0) - "a".charCodeAt(0),
});

export function convertMove(move: string): MoveData {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
    throw new Error("Invalid move format");
  }

  const promotionLetter = move[4];
  const promotion = promotionLetter ? PROMOTION_BY_LETTER[promotionLetter] : undefined;

  return {
    from: toPosition(move.slice(0, 2)),
    to: toPosition(move.slice(2, 4)),
    ...(promotion ? { promotion } : {}),
  };
}
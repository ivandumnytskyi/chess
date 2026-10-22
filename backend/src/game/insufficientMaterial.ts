import type { Board } from "./Board";
import type { Piece } from "../pieces/Piece";

export function hasInsufficientMaterial(board: Board): boolean {
  const nonKingPieces = board.squares
    .flat()
    .filter(
      (piece): piece is Piece =>
        piece !== null && piece.pieceType !== "king"
    );

  if (
    nonKingPieces.some(
      piece =>
        piece.pieceType === "pawn" ||
        piece.pieceType === "rook" ||
        piece.pieceType === "queen"
    )
  ) {
    return false;
  }

  if (nonKingPieces.length <= 1) {
    return true;
  }

  if (nonKingPieces.some(piece => piece.pieceType === "knight")) {
    return false;
  }

  const bishopSquareColor =
    (nonKingPieces[0].position.row + nonKingPieces[0].position.col) % 2;
  return nonKingPieces.every(
    piece =>
      piece.pieceType === "bishop" &&
      (piece.position.row + piece.position.col) % 2 === bishopSquareColor
  );
}

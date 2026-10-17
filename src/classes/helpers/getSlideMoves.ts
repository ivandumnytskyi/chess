import type { Piece } from "../Piece";
import type { Board } from "../Board";
import type { Position } from "../../types/Position";

export function getSlidingMoves(
  piece: Piece,
  board: Board,
  directions: Position[]
): Position[] {
  const moves: Position[] = [];
  const { row, col } = piece.position;

  for (const direction of directions) {
    let r = row + direction.row;
    let c = col + direction.col;

    while (board.isInside({ row: r, col: c })) {
      const position = { row: r, col: c };
      const target = board.getPiece(position);

      if (target === null) {
        moves.push(position);
      } else {
        if (target.color !== piece.color) {
          moves.push(position);
        }

        break;
      }

      r += direction.row;
      c += direction.col;
    }
  }

  return moves;
}
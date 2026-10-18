import type { Piece } from "../Piece";
import type { Board } from "../../game/Board";
import type { Position } from "../../types/Position";

export function getSlidingAttacks(
  piece: Piece,
  board: Board,
  directions: Position[]
): Position[] {
  const attacks: Position[] = [];
  const { row, col } = piece.position;

  for (const direction of directions) {
    let r = row + direction.row;
    let c = col + direction.col;

    while (board.isInside({ row: r, col: c })) {
      const position = { row: r, col: c };
      const target = board.getPiece(position);

      attacks.push(position);

      if (target !== null) {
        break;
      }

      r += direction.row;
      c += direction.col;
    }
  }

  return attacks;
}
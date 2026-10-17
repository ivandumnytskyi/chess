import { Board } from "./Board";
import { Piece } from "./Piece";
import type { Position } from "../types/Position";
import type { Color } from "../types/Color";

export class Bishop extends Piece {
  constructor(color: Color, starPosition: Position) {
    super(color, starPosition, "bishop")
  }

  getPossibleMoves(board: Board): Position[] {
    const { row, col } = this.position
    const moves: Position[] = []
    const directions: Position[] = [
      { row: 1, col: 1 },
      { row: 1, col: -1 },
      { row: -1, col: 1 },
      { row: -1, col: -1 },
    ]

    for (const direction of directions) {
      let r = row + direction.row;
      let c = col + direction.col;

      while (board.isInside({ row: r, col: c })) {
        const position = { row: r, col: c };
        const target = board.getPiece(position);
        if (target === null) {
          moves.push(position)
        } else {
          if (target.color !== this.color) {
            moves.push(position)
          }

          break
        }
        
        r += direction.row;
        c += direction.col;
      }
    }

    return moves
  }
}
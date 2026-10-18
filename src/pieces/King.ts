import type { Board } from "../game/Board";
import { Piece } from "./Piece";
import type { Position } from "../types/Position";
import type { Color } from "../types/Color";

export class King extends Piece {
  constructor(color: Color, starPosition: Position) {
    super(color, starPosition, "king")
  }

  getPossibleMoves(board: Board): Position[] {
    const directions: Position[] = [
      { row: 1, col: 1 },
      { row: 1, col: -1 },
      { row: -1, col: 1 },
      { row: -1, col: -1 },
      { row: 1, col: 0 },
      { row: -1, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: -1 },
    ]

    const { row, col } = this.position

    const moves = directions.map(d => { return { row: d.row + row, col: d.col + col } }).filter(position => {
      if (!board.isInside(position)) {
        return false;
      }

      const target = board.getPiece(position);
      return target === null || target.color !== this.color;
    })

    return moves
  }
}
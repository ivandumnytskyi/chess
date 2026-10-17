import type { Board } from "../game/Board";
import { Piece } from "./Piece";
import type { Position } from "../types/Position";
import type { Color } from "../types/Color";
import { getSlidingMoves } from "./helpers/getSlideMoves";

export class Queen extends Piece {
  constructor(color: Color, starPosition: Position) {
    super(color, starPosition, "queen")
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

    return getSlidingMoves(this, board, directions)
  }
}
import type { Board } from "../game/Board";
import { Piece } from "./Piece";
import type { Position } from "../types/Position";
import type { Color } from "../types/Color";
import { getSlidingMoves } from "./helpers/getSlideMoves";

export class Bishop extends Piece {
  constructor(color: Color, starPosition: Position) {
    super(color, starPosition, "bishop")
  }

  getPossibleMoves(board: Board): Position[] {
    const directions: Position[] = [
      { row: 1, col: 1 },
      { row: 1, col: -1 },
      { row: -1, col: 1 },
      { row: -1, col: -1 },
    ]
    return getSlidingMoves(this, board, directions)
  }

  getAttackSquares(board: Board): Position[] {
    const directions: Position[] = [
      { row: 1, col: 1 },
      { row: 1, col: -1 },
      { row: -1, col: 1 },
      { row: -1, col: -1 },
    ]

    return getSlidingMoves(this, board, directions)
  }
}
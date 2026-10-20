import type { Board } from "../game/Board";
import { Piece } from "./Piece";
import type { Position, Color } from "../types/chess";
import { getSlidingMoves } from "./helpers/getSlideMoves";
import { getSlidingAttacks } from "./helpers/getSlideAttacks";

export class Bishop extends Piece {
  constructor(
    color: Color,
    startingPosition: Position,
    hasMoved: boolean = false,
    position?: Position
  ) {
    super(color, startingPosition, 'bishop', hasMoved, position);
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

    return getSlidingAttacks(this, board, directions)
  }

  clone(): Bishop {
    const clone = new Bishop(
      this.color,
      { ...this.startingPosition },
      this.hasMoved,
      { ...this.position }
    );

    return clone;
  }
}
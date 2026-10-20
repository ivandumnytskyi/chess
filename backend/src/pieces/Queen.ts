import type { Board } from "../game/Board";
import { Piece } from "./Piece";
import type { Color, Position } from "../types/chess";
import { getSlidingMoves } from "./helpers/getSlideMoves";
import { getSlidingAttacks } from "./helpers/getSlideAttacks";

export class Queen extends Piece {
  constructor(
    color: Color,
    startingPosition: Position,
    hasMoved: boolean = false,
    position?: Position
  ) {
    super(color, startingPosition, 'queen', hasMoved, position);
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

  getAttackSquares(board: Board): Position[] {
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


    return getSlidingAttacks(this, board, directions)
  }

  clone(): Queen {
    const clone = new Queen(
      this.color,
      { ...this.startingPosition },
      this.hasMoved,
      { ...this.position }
    );

    clone.hasMoved = this.hasMoved;

    return clone;
  }
}
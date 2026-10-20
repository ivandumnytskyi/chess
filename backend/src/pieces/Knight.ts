import { Piece } from "./Piece";
import type { Position, Color } from "../types/chess";
import type { Board } from "../game/Board";

export class Knight extends Piece {
  constructor(
    color: Color,
    startingPosition: Position,
    hasMoved: boolean = false,
    position?: Position
  ) {
    super(color, startingPosition, 'knight', hasMoved, position);
  }

  getAttackSquares(board: Board): Position[] {
    const { row, col } = this.position;

    const directions: Position[] = [
      { row: -2, col: -1 },
      { row: -2, col: 1 },
      { row: -1, col: -2 },
      { row: -1, col: 2 },
      { row: 1, col: -2 },
      { row: 1, col: 2 },
      { row: 2, col: -1 },
      { row: 2, col: 1 },
    ]

    return directions
      .map(direction => ({
        row: row + direction.row,
        col: col + direction.col,
      }))
      .filter(position => board.isInside(position));
  }

  getPossibleMoves(board: Board): Position[] {
    return this.getAttackSquares(board).filter(position => {
      const target = board.getPiece(position);

      return target === null || target.color !== this.color;
    });
  }

  clone(): Knight {
    const clone = new Knight(
      this.color,
      { ...this.startingPosition },
      this.hasMoved,
      { ...this.position }
    );

    return clone;
  }
}
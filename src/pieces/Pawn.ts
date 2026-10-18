import { Piece } from "./Piece";
import type { Position } from "../types/Position";
import type { Board } from "../game/Board";
import type { Color } from "../types/Color";

export class Pawn extends Piece {
  constructor(color: Color, startPosition: Position) {
    super(color, startPosition, "pawn");
  }
  getPossibleMoves(board: Board): Position[] {
    const direction = this.color === "white" ? -1 : 1;
    const { row, col } = this.position;
    const nextRow = row + direction;
    const twoRowMove = row + direction * 2
    const moves: Position[] = []
    if (!board.isInside({ row: nextRow, col })) {
      return moves
    }
    const posibleCaptures: Position[] = this.getAttackSquares(board)

    moves.push(
      ...posibleCaptures.filter(c => {
        const target = board.getPiece(c);
        return target !== null && target.color !== this.color;
      })
    );

    const oneStep: Position = { row: nextRow, col };

    if (board.getPiece(oneStep) === null) {
      moves.push(oneStep);

      const twoSteps: Position = { row: twoRowMove, col };

      if (
        !this.hasMoved &&
        board.isInside(twoSteps) &&
        board.getPiece(twoSteps) === null
      ) {
        moves.push(twoSteps);
      }
    }

    return moves
  }
  getAttackSquares(board: Board): Position[] {
    const { row, col } = this.position;
    const direction = this.color === 'white' ? -1 : 1;

    const attacks: Position[] = [];

    for (const offset of [-1, 1]) {
      const position = {
        row: row + direction,
        col: col + offset,
      };

      if (board.isInside(position)) {
        attacks.push(position);
      }
    }

    return attacks;
  }
}
import { Piece } from "./Piece";
import type { Position } from "../types/Position";
import { Board } from "./Board";
import type { Color } from "../types/Color";

export class Knight extends Piece {
  constructor(color: Color, startPosition: Position) {
    super(color, startPosition, "knight");
  }

  getPossibleMoves(board: Board): Position[] {
    const { row, col } = this.position;
    const ofset:Position[] = [
      {row: -2, col: -1},
      {row: -2, col: 1},
      {row: -1, col: -2},
      {row: -1, col: 2},
      {row: 1, col: -2},
      {row: 1, col: 2},
      {row: 2, col: -1},
      {row: 2, col: 1},
    ]
    const moves: Position[] = ofset.map((ofs)=>{
      return {row: ofs.row + row, col: ofs.col + col}
    }).filter(position => {
      if (!board.isInside(position)) {
        return false;
      }

      const target = board.getPiece(position);
      return target === null || target.color !== this.color;
    });

    return moves
  }
}
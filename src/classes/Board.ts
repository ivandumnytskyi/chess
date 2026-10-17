import { Piece } from "./Piece"
import type { Position } from "../types/Position";
import type { MoveData } from "../types/MoveData";

export class Board {
  private squares: (Piece | null)[][];
  constructor() {
    this.squares = Array.from({ length: 8 }, () =>
      Array<Piece | null>(8).fill(null)
    );
  }

  getPiece(position: Position): Piece | null {
    if (!this.isInside(position)) {
      return null;
    }
    return this.squares[position.row][position.col];
  }

  placePiece(piece: Piece): void {
    const { row, col } = piece.position;
    this.squares[row][col] = piece
  }

  removePiece(position: Position): Piece | null {
    const piece = this.getPiece(position);

    this.squares[position.row][position.col] = null;
    return piece;
  }

  movePiece(moveData: MoveData): void {
    const piece = this.getPiece(moveData.from);

    if (!piece) {
      throw new Error("No piece at the starting position");
    }

    this.removePiece(moveData.from)

    piece.position = moveData.to;
    piece.hasMoved = true
    this.placePiece(piece)
  }

  isInside(position: Position): boolean {
    const { row, col } = position;

    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }
}
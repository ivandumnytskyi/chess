import type { Piece } from "../pieces/Piece";
import type { Position } from "../types/Position";
import type { MoveData } from "../types/MoveData";
import { Pawn } from "../pieces/Pawn";
import { Rook } from "../pieces/Rook";
import { Knight } from "../pieces/Knight";
import { Bishop } from "../pieces/Bishop";
import { Queen } from "../pieces/Queen";
import { King } from "../pieces/King";

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

  setupInitialPosition(): void {
    // Black pieces
    this.placePiece(new Rook("black", { row: 0, col: 0 }));
    this.placePiece(new Knight("black", { row: 0, col: 1 }));
    this.placePiece(new Bishop("black", { row: 0, col: 2 }));
    this.placePiece(new Queen("black", { row: 0, col: 3 }));
    this.placePiece(new King("black", { row: 0, col: 4 }));
    this.placePiece(new Bishop("black", { row: 0, col: 5 }));
    this.placePiece(new Knight("black", { row: 0, col: 6 }));
    this.placePiece(new Rook("black", { row: 0, col: 7 }));

    // Black pawns
    for (let col = 0; col < 8; col++) {
      this.placePiece(new Pawn("black", { row: 1, col }));
    }

    // White pawns
    for (let col = 0; col < 8; col++) {
      this.placePiece(new Pawn("white", { row: 6, col }));
    }

    // White pieces
    this.placePiece(new Rook("white", { row: 7, col: 0 }));
    this.placePiece(new Knight("white", { row: 7, col: 1 }));
    this.placePiece(new Bishop("white", { row: 7, col: 2 }));
    this.placePiece(new Queen("white", { row: 7, col: 3 }));
    this.placePiece(new King("white", { row: 7, col: 4 }));
    this.placePiece(new Bishop("white", { row: 7, col: 5 }));
    this.placePiece(new Knight("white", { row: 7, col: 6 }));
    this.placePiece(new Rook("white", { row: 7, col: 7 }));
  }
}
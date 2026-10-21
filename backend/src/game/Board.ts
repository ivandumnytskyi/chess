import type { Piece } from "../pieces/Piece";
import type { Position, MoveData, Color, PieceType } from "../types/chess";
import { Pawn } from "../pieces/Pawn";
import { Rook } from "../pieces/Rook";
import { Knight } from "../pieces/Knight";
import { Bishop } from "../pieces/Bishop";
import { Queen } from "../pieces/Queen";
import { King } from "../pieces/King";

export class Board {
  public squares: (Piece | null)[][];
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
    if (!this.isInside(piece.position)) {
      throw new Error("Position is outside the board");
    }
    this.squares[row][col] = piece;
  }

  removePiece(position: Position): Piece | null {
    const piece = this.getPiece(position);

    this.squares[position.row][position.col] = null;
    return piece;
  }

  movePiece(moveData: MoveData): void {
    if (!this.isInside(moveData.from) || !this.isInside(moveData.to)) {
      throw new Error("Move position is outside the board");
    }

    const piece = this.getPiece(moveData.from);

    if (!piece) {
      throw new Error("No piece at the starting position");
    }

    const target = this.getPiece(moveData.to);
    if (target?.color === piece.color) {
      throw new Error("Cannot capture your own piece");
    }
    if (target?.pieceType === "king") {
      throw new Error("A king cannot be captured");
    }

    this.removePiece(moveData.from);
    piece.position = { ...moveData.to };
    piece.hasMoved = true;
    this.placePiece(piece);
  }

  clone(): Board {
    const cloneBoard = new Board()
    for (const row of this.squares) {
      for (const piece of row) {
        if (piece) {
          cloneBoard.placePiece(piece.clone());
        }
      }
    }
    return cloneBoard
  }

  findKing(color: Color): Piece | undefined {
    for (const row of this.squares) {
      for (const piece of row) {
        if (piece?.color === color && piece.pieceType === "king") {
          return piece
        }
      }
    }

  }

  isInside(position: Position): boolean {
    const { row, col } = position;

    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  isSquareAttacked(position: Position, byColor: Color): boolean {
    for (const row of this.squares) {
      for (const piece of row) {
        if (piece === null || piece.color !== byColor) {
          continue;
        }

        const attacks = piece.getAttackSquares(this);

        if (
          attacks.some(
            square =>
              square.row === position.row &&
              square.col === position.col
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  promotion(color: Color, pieceType: PieceType, position: Position) {
    const pawn = this.getPiece(position);

    if (pawn?.pieceType !== "pawn" || pawn.color !== color) {
      throw new Error("No matching pawn to promote");
    }

    let promotedPiece: Piece;

    switch (pieceType) {
      case "queen":
        promotedPiece = new Queen(color, position);
        break;
      case "rook":
        promotedPiece = new Rook(color, position);
        break;
      case "bishop":
        promotedPiece = new Bishop(color, position);
        break;
      case "knight":
        promotedPiece = new Knight(color, position);
        break;
      default:
        throw new Error("Invalid promotion piece");
    }

    this.removePiece(position);
    this.placePiece(promotedPiece);
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
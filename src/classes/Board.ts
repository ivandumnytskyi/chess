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

  getPiece(position: Position): Piece|null{
    return this.squares[position.row][position.col];
  }

  placePiece(Piece:Piece):void{
    const { row, col } = Piece.position;
    this.squares[row][col] = Piece
  }

  removePiece(position: Position): Piece | null {
    const piece = this.getPiece(position);

    this.squares[position.row][position.col] = null;

    return piece;
  }

  movePiece(moveData:MoveData):void{
    const Piece = this.removePiece(moveData.from)

    if (!Piece) {
    throw new Error("No piece at the starting position");
  }

    Piece.position = moveData.to;
    this.placePiece(Piece)
  }
}
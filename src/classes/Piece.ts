import type { Color } from "../types/Color";
import type { Position } from "../types/Position";
import type { PieceType } from "../types/PieceType";
import { Board } from "./Board" 

export abstract class Piece {
  constructor(
    public readonly color: Color,
    public readonly startingPosition: Position,
    public position: Position,
    public pieceType: PieceType
  ) {}

  //Piece move logic
  abstract getPossibleMoves(board: Board): Position[];
}
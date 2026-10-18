import type { Color } from "../types/Color";
import type { Position } from "../types/Position";
import type { PieceType } from "../types/PieceType";
import type { Board } from "../game/Board";

export abstract class Piece {
  public hasMoved = false;
  public position: Position;
  constructor(
    public readonly color: Color,
    public readonly startingPosition: Position,
    public pieceType: PieceType
  ) { this.position = { ...startingPosition }; }

  //Piece move logic
  abstract getPossibleMoves(board: Board): Position[];
}
import type { Color, Position, PieceType } from "../types/chess";
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
  abstract getAttackSquares(board: Board): Position[]
}
import { Board } from "./Board";
import type { Color, GameStatus, MoveData, Position } from "../types/chess";

export class ChessGame {
  private board: Board;
  private currentTurn: Color;
  private gameStatus: GameStatus;
  private movesHistory: MoveData[];

  constructor() {
    this.board = new Board()
    this.board.setupInitialPosition();

    this.movesHistory = []
    this.currentTurn = 'white'
    this.gameStatus = 'active'
  }

  getBoard() {
    return this.board
  }

  getLegalMoves(from: Position): Position[] {
    const piece = this.board.getPiece(from);
    if (!piece) return [];

    const candidates = piece.getPossibleMoves(this.board);

    return candidates.filter(to => {
      const target = this.board.getPiece(to);
      if (target?.pieceType === "king") {
        return false;
      }

      const simulatedBoard = this.board.clone();
      simulatedBoard.movePiece({ from, to });

      const king = simulatedBoard.findKing(piece.color);
      if (!king) {
        throw new Error(`Missing ${piece.color} king`);
      }

      const opponent = piece.color === "white" ? "black" : "white";
      return !simulatedBoard.isSquareAttacked(king.position, opponent);
    });
  }

  makeMove(move: MoveData, whoMoved: Color): Board {
    if (this.gameStatus === 'checkmate' || this.gameStatus === 'stalemate') {
      throw new Error("The game is not active");
    }

    if (whoMoved !== this.currentTurn) {
      throw new Error("It's not your turn");
    }

    const chosenPiece = this.board.getPiece(move.from);
    if (!chosenPiece) {
      throw new Error("No piece at the starting position");
    }

    if (chosenPiece.color !== this.currentTurn) {
      throw new Error("It's not your piece");
    }

    const legalMoves = this.getLegalMoves(move.from);
    if (!legalMoves.some(
      position => position.row === move.to.row && position.col === move.to.col
    )) {
      throw new Error("Illegal move");
    }

    this.board.movePiece(move);
    this.movesHistory.push({
      from: { ...move.from },
      to: { ...move.to },
    });
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

    const opponent = this.currentTurn;
    let opponentHasLegalMove = false;

    for (let row = 0; row < 8 && !opponentHasLegalMove; row++) {
      for (let col = 0; col < 8; col++) {
        const position = { row, col };
        const piece = this.board.getPiece(position);

        if (piece?.color === opponent && this.getLegalMoves(position).length > 0) {
          opponentHasLegalMove = true;
          break;
        }
      }
    }

    const opponentKing = this.board.findKing(opponent);
    if (!opponentKing) {
      throw new Error(`Missing ${opponent} king`);
    }

    const opponentIsInCheck = this.board.isSquareAttacked(
      opponentKing.position,
      whoMoved
    );

    if (!opponentHasLegalMove) {
      this.gameStatus = opponentIsInCheck ? 'checkmate' : 'stalemate';
    } else {
      this.gameStatus = opponentIsInCheck ? 'check' : 'active';
    }

    return this.board
  }
}
import { Board } from "./Board";
import { Color, GameStatus, MoveData, Position } from "../types/chess";

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
    //basic check
    if (this.gameStatus === 'checkmate' || this.gameStatus === 'stalemate') {
      throw new Error("The game is not active");
    }
    //checks does the use can move pices now
    if (whoMoved !== this.currentTurn) {
      throw new Error("It's not your turn");
    }

    const chosenPiece = this.board.getPiece(move.from)

    //checks does there is pice
    if (!chosenPiece) {
      throw new Error("No piece at the starting position");
    }


    //checks does player moved it`s own pice
    if (chosenPiece.color !== this.currentTurn) {
      throw new Error("It's not your piece")
    }

    const legalMoves = this.getLegalMoves(move.from);

    const isLegal = legalMoves.some(
      position => position.row === move.to.row && position.col === move.to.col
    );

    if (!isLegal) {
      throw new Error("Illegal move");
    }

    this.board.movePiece(move)
    //swap turn
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
    //save last turn
    this.movesHistory.push({ ...move });

    return this.board
  }
}
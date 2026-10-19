import { Board } from "./Board";
import { Color, GameStatus, MoveData } from "../types/chess";

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
    return JSON.stringify(this.board)
  }

  makeMove(move: MoveData, whoMoved: Color): Board {
    //basic check
    if (this.gameStatus !== 'active') {
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

    const posibleMoves = chosenPiece.getPossibleMoves(this.board)

    //check does move is legal for this piece
    if (!posibleMoves.includes(move.to)) {
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
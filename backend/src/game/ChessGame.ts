import { Board } from "./Board";
import type { Color, GameStatus, MoveData, Position } from "../types/chess";

export class ChessGame {
  private board: Board = new Board();
  private currentTurn: Color = 'white';
  private gameStatus: GameStatus = 'active';
  private movesHistory: MoveData[] = [];
  private enPassantTarget: Position | null = null;

  constructor() {
    this.board.setupInitialPosition();
  }

  getBoardState() {
    return this.board.clone()
  }

  getLegalMoves(from: Position): Position[] {
    const piece = this.board.getPiece(from);
    if (!piece) return [];

    const candidates = piece.getPossibleMoves(this.board);
    
    if (
      piece.pieceType === "king" &&
      !piece.hasMoved &&
      from.row === (piece.color === "white" ? 7 : 0) &&
      from.col === 4 &&
      piece.startingPosition.row === from.row &&
      piece.startingPosition.col === from.col
    ) {
      for (const rookCol of [0, 7]) {
        const rook = this.board.getPiece({ row: from.row, col: rookCol });

        if (
          rook?.pieceType !== "rook" ||
          rook.color !== piece.color ||
          rook.hasMoved ||
          rook.startingPosition.row !== from.row ||
          rook.startingPosition.col !== rookCol
        ) {
          continue;
        }

        const kingCol = rookCol === 7 ? 6 : 2;
        const pathCols = rookCol === 7 ? [5, 6] : [1, 2, 3];
        if (pathCols.every(col => this.board.getPiece({ row: from.row, col }) === null)) {
          candidates.push({ row: from.row, col: kingCol });
        }
      }
    }

    if (piece.pieceType === "pawn" && this.enPassantTarget) {
      const target = this.enPassantTarget;
      const capturedPawn = this.board.getPiece({
        row: from.row,
        col: target.col,
      });

      if (
        target.row === from.row + (piece.color === "white" ? -1 : 1) &&
        Math.abs(target.col - from.col) === 1 &&
        this.board.getPiece(target) === null &&
        capturedPawn?.pieceType === "pawn" &&
        capturedPawn.color !== piece.color
      ) {
        candidates.push({ ...target });
      }
    }

    return candidates.filter(to => {
      const target = this.board.getPiece(to);
      if (target?.pieceType === "king") {
        return false;
      }

      const simulatedBoard = this.board.clone();
      const isEnPassant =
        piece.pieceType === "pawn" &&
        from.col !== to.col &&
        target === null &&
        this.enPassantTarget?.row === to.row &&
        this.enPassantTarget.col === to.col;

      if (isEnPassant) {
        simulatedBoard.removePiece({ row: from.row, col: to.col });
      }

      const isCastling =
        piece.pieceType === "king" &&
        from.row === to.row &&
        Math.abs(to.col - from.col) === 2;
      const opponent = piece.color === "white" ? "black" : "white";

      if (isCastling) {
        const kingSide = to.col > from.col;
        const transitPosition = {
          row: from.row,
          col: from.col + (kingSide ? 1 : -1),
        };

        if (this.board.isSquareAttacked(from, opponent)) {
          return false;
        }

        const transitBoard = this.board.clone();
        transitBoard.movePiece({ from, to: transitPosition });
        if (transitBoard.isSquareAttacked(transitPosition, opponent)) {
          return false;
        }

        simulatedBoard.movePiece({
          from: { row: from.row, col: kingSide ? 7 : 0 },
          to: { row: from.row, col: kingSide ? 5 : 3 },
        });
      }

      simulatedBoard.movePiece({ from, to });

      const king = simulatedBoard.findKing(piece.color);
      if (!king) {
        throw new Error(`Missing ${piece.color} king`);
      }

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

    const isEnPassant =
      chosenPiece.pieceType === "pawn" &&
      move.from.col !== move.to.col &&
      this.board.getPiece(move.to) === null &&
      this.enPassantTarget?.row === move.to.row &&
      this.enPassantTarget.col === move.to.col;

    if (isEnPassant) {
      this.board.removePiece({ row: move.from.row, col: move.to.col });
    }

    const isCastling =
      chosenPiece.pieceType === "king" &&
      move.from.row === move.to.row &&
      Math.abs(move.to.col - move.from.col) === 2;

    this.board.movePiece(move);

    if (isCastling) {
      const kingSide = move.to.col > move.from.col;

      this.board.movePiece({
        from: {
          row: move.from.row,
          col: kingSide ? 7 : 0,
        },
        to: {
          row: move.from.row,
          col: kingSide ? 5 : 3,
        },
      });
    }

    this.movesHistory.push({
      from: { ...move.from },
      to: { ...move.to },
    });

    this.enPassantTarget = null;
    if (
      chosenPiece.pieceType === "pawn" &&
      Math.abs(move.from.row - move.to.row) === 2
    ) {
      this.enPassantTarget = {
        row: (move.from.row + move.to.row) / 2,
        col: move.to.col,
      };
    }
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
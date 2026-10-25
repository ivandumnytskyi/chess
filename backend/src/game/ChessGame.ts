import { Board } from "./Board";
import { hasInsufficientMaterial } from "./insufficientMaterial";
import type { Color, GameStatus, MoveData, Position, PieceType } from "../types/chess";

type PromotionPieceType = "queen" | "rook" | "bishop" | "knight";

export class ChessGame {
  private board: Board = new Board();
  private currentTurn: Color = 'white';
  private gameStatus: GameStatus = 'active';
  private enPassantTarget: Position | null = null;
  private halfMove: number = 0;
  private fullMoveNumber = 1;
  private castlingRights = new Set<"K" | "Q" | "k" | "q">(["K", "Q", "k", "q"]);
  private positionHistory = new Map<string, number>();

  constructor() {
    this.board.setupInitialPosition();
    this.positionHistory.set(this.getRepetitionKey(), 1);
  }

  getBoardState() {
    return this.board.clone()
  }

  getGameStatus(): GameStatus {
    return this.gameStatus;
  }

  getCurrentTurn(): Color {
    return this.currentTurn;
  }

  getFenNotation(): string {
    return this.fenNotation(
      this.currentTurn,
      this.getCastlingRights(),
      this.enPassantTarget,
      this.halfMove,
      this.fullMoveNumber
    );
  }

  getLegalMovesForTurn(): { from: Position; moves: Position[] }[] {
    const result: { from: Position; moves: Position[] }[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const from = { row, col };
        const piece = this.board.getPiece(from);
        if (!piece || piece.color !== this.currentTurn) continue;
        const moves = this.getLegalMoves(from);
        if (moves.length > 0) result.push({ from, moves });
      }
    }
    return result;
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
        const castlingRight =
          piece.color === "white"
            ? rookCol === 7 ? "K" : "Q"
            : rookCol === 7 ? "k" : "q";
        const rook = this.board.getPiece({ row: from.row, col: rookCol });

        if (
          !this.castlingRights.has(castlingRight) ||
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

  makeMove(
    move: MoveData,
    whoMoved: Color,
    promotionPieceType?: PromotionPieceType
  ): Board {
    if (this.gameStatus === 'checkmate' || this.gameStatus === 'stalemate' || this.gameStatus === 'draw') {
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

    const isCastling =
      chosenPiece.pieceType === "king" &&
      move.from.row === move.to.row &&
      Math.abs(move.to.col - move.from.col) === 2;
    const isCapture =
      this.board.getPiece(move.to) !== null || isEnPassant;
    const capturedPiece = this.board.getPiece(move.to);

    const promotionRow = chosenPiece.color === "white" ? 0 : 7;
    const isPromotion =
      chosenPiece.pieceType === "pawn" && move.to.row === promotionRow;
    let promotionType: PromotionPieceType | undefined;

    if (isPromotion) {
      switch (promotionPieceType) {
        case "queen":
        case "rook":
        case "bishop":
        case "knight":
          promotionType = promotionPieceType;
          break;
        default:
          throw new Error("Choose queen, rook, bishop, or knight for promotion");
      }
    } else if (promotionPieceType !== undefined) {
      throw new Error("Promotion piece can only be specified for a promoting move");
    }

    if (chosenPiece.pieceType === "king") {
      this.castlingRights.delete(chosenPiece.color === "white" ? "K" : "k");
      this.castlingRights.delete(chosenPiece.color === "white" ? "Q" : "q");
    } else if (chosenPiece.pieceType === "rook") {
      if (move.from.row === 7 && move.from.col === 0) this.castlingRights.delete("Q");
      if (move.from.row === 7 && move.from.col === 7) this.castlingRights.delete("K");
      if (move.from.row === 0 && move.from.col === 0) this.castlingRights.delete("q");
      if (move.from.row === 0 && move.from.col === 7) this.castlingRights.delete("k");
    }
    if (capturedPiece?.pieceType === "rook") {
      if (move.to.row === 7 && move.to.col === 0) this.castlingRights.delete("Q");
      if (move.to.row === 7 && move.to.col === 7) this.castlingRights.delete("K");
      if (move.to.row === 0 && move.to.col === 0) this.castlingRights.delete("q");
      if (move.to.row === 0 && move.to.col === 7) this.castlingRights.delete("k");
    }

    if (isEnPassant) {
      this.board.removePiece({ row: move.from.row, col: move.to.col });
    }

    this.board.movePiece(move);

    if (promotionType) {
      this.board.promotion(chosenPiece.color, promotionType, move.to);
    }

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
    if (chosenPiece.pieceType === 'pawn' || isCapture) {
      this.halfMove = 0
    } else {
      this.halfMove += 1
    }

    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
    if (whoMoved === "black") {
      this.fullMoveNumber += 1;
    }

    const positionKey = this.getRepetitionKey();
    const occurrenceCount = (this.positionHistory.get(positionKey) ?? 0) + 1;
    this.positionHistory.set(positionKey, occurrenceCount);

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
    } else if (
      hasInsufficientMaterial(this.board) ||
      this.halfMove >= 100 ||
      occurrenceCount >= 3
    ) {
      this.gameStatus = 'draw'
    } else {
      this.gameStatus = opponentIsInCheck ? 'check' : 'active';
    }

    return this.getBoardState()
  }

  fenNotation(
    activeColor: Color = "white",
    castlingRights?: string,
    enPassantTarget: Position | null = null,
    halfMoveClock = 0,
    fullMoveNumber = 1
  ): string {
    const transcript: Record<PieceType, string> = {
      bishop: "b",
      king: "k",
      knight: "n",
      pawn: "p",
      queen: "q",
      rook: "r",
    };
    const ranks = this.board.squares.map(row => {
      let rank = "";
      let emptySquares = 0;

      for (const piece of row) {
        if (!piece) {
          emptySquares += 1;
          continue;
        }

        if (emptySquares > 0) {
          rank += emptySquares;
          emptySquares = 0;
        }

        const letter = transcript[piece.pieceType];
        rank += piece.color === "white" ? letter.toUpperCase() : letter;
      }

      if (emptySquares > 0) {
        rank += emptySquares;
      }
      return rank;
    });

    const enPassantSquare = enPassantTarget
      ? `${String.fromCharCode(97 + enPassantTarget.col)}${8 - enPassantTarget.row}`
      : "-";
    const hasCastlingPieces = (color: Color, row: number, rookCol: number): boolean => {
      const king = this.board.getPiece({ row, col: 4 });
      const rook = this.board.getPiece({ row, col: rookCol });

      return (
        king?.pieceType === "king" &&
        king.color === color &&
        !king.hasMoved &&
        king.startingPosition.row === row &&
        king.startingPosition.col === 4 &&
        rook?.pieceType === "rook" &&
        rook.color === color &&
        !rook.hasMoved &&
        rook.startingPosition.row === row &&
        rook.startingPosition.col === rookCol
      );
    };
    const inferredCastlingRights = [
      hasCastlingPieces("white", 7, 7) ? "K" : "",
      hasCastlingPieces("white", 7, 0) ? "Q" : "",
      hasCastlingPieces("black", 0, 7) ? "k" : "",
      hasCastlingPieces("black", 0, 0) ? "q" : "",
    ].join("");

    return [
      ranks.join("/"),
      activeColor === "white" ? "w" : "b",
      castlingRights ?? (inferredCastlingRights || "-"),
      enPassantSquare,
      halfMoveClock,
      fullMoveNumber,
    ].join(" ");
  }

  private getCastlingRights(): string {
    return ["K", "Q", "k", "q"]
      .filter(right => this.castlingRights.has(right as "K" | "Q" | "k" | "q"))
      .join("") || "-";
  }

  private getRepetitionKey(): string {
    let repetitionEnPassantTarget: Position | null = null;

    if (this.enPassantTarget) {
      const direction = this.currentTurn === "white" ? -1 : 1;
      const sourceRow = this.enPassantTarget.row - direction;

      for (const sourceCol of [this.enPassantTarget.col - 1, this.enPassantTarget.col + 1]) {
        const source = { row: sourceRow, col: sourceCol };
        const pawn = this.board.getPiece(source);

        if (
          pawn?.pieceType === "pawn" &&
          pawn.color === this.currentTurn &&
          this.getLegalMoves(source).some(
            destination =>
              destination.row === this.enPassantTarget?.row &&
              destination.col === this.enPassantTarget?.col
          )
        ) {
          repetitionEnPassantTarget = this.enPassantTarget;
          break;
        }
      }
    }

    return this.fenNotation(
      this.currentTurn,
      this.getCastlingRights(),
      repetitionEnPassantTarget
    ).split(" ").slice(0, 4).join(" ");
  }
}
import { describe, expect, it } from "vitest";
import { ChessGame } from "../src/game/ChessGame";

function playUciSequence(
  game: ChessGame,
  moves: string,
  startingColor: "white" | "black" = "white"
): void {
  const sequence = moves.trim().split(/\s+/);
  for (const [index, move] of sequence.entries()) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
      throw new Error(`Invalid coordinate move: ${move}`);
    }
    const from = {
      row: 8 - Number(move[1]),
      col: move.charCodeAt(0) - 97,
    };
    const to = {
      row: 8 - Number(move[3]),
      col: move.charCodeAt(2) - 97,
    };
    const promotion = { q: "queen", r: "rook", b: "bishop", n: "knight" } as const;
    const promotionType = move[4] ? promotion[move[4] as keyof typeof promotion] : undefined;
    const color =
      index % 2 === 0
        ? startingColor
        : startingColor === "white"
          ? "black"
          : "white";
    game.makeMove({ from, to }, color, promotionType);
  }
}

describe("ChessGame", () => {
  it("starts in the standard position", () => {
    const game = new ChessGame();

    expect(game.getGameStatus()).toBe("active");
    expect(game.getFenNotation()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("updates the position and turn after a legal pawn move", () => {
    const game = new ChessGame();

    playUciSequence(game, "e2e4");

    expect(game.getFenNotation()).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    );
  });

  it("rejects a move when it is not that player's turn", () => {
    const game = new ChessGame();
    const startingPosition = game.getFenNotation();

    expect(() =>
      game.makeMove(
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } },
        "black"
      )
    ).toThrow("It's not your turn");
    expect(game.getFenNotation()).toBe(startingPosition);
  });

  it("rejects an illegal move without changing the position", () => {
    const game = new ChessGame();
    const startingPosition = game.getFenNotation();

    expect(() => playUciSequence(game, "e2e5")).toThrow("Illegal move");
    expect(game.getFenNotation()).toBe(startingPosition);
  });

  it("returns a board copy that cannot change the game position", () => {
    const game = new ChessGame();
    const boardCopy = game.getBoardState();

    boardCopy.removePiece({ row: 6, col: 4 });

    expect(game.getFenNotation()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("returns legal opening moves for a knight", () => {
    const game = new ChessGame();
    const moves = game.getLegalMoves({ row: 7, col: 1 });

    expect(moves).toEqual(
      expect.arrayContaining([
        { row: 5, col: 0 },
        { row: 5, col: 2 },
      ])
    );
    expect(moves).toHaveLength(2);
  });

  it("returns a detached board copy from makeMove", () => {
    const game = new ChessGame();
    playUciSequence(game, "e2e4");
    const result = game.getBoardState();

    result.removePiece({ row: 4, col: 4 });

    expect(game.getFenNotation()).toContain("4P3");
  });

  it("records a pawn capture", () => {
    const game = new ChessGame();
    playUciSequence(game, "e2e4 d7d5 e4d5");

    expect(game.getFenNotation()).toBe(
      "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2"
    );
  });

  it("ends the game after checkmate", () => {
    const game = new ChessGame();
    playUciSequence(game, "f2f3 e7e5 g2g4 d8h4");

    expect(game.getGameStatus()).toBe("checkmate");
    expect(game.getFenNotation()).toBe(
      "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"
    );
    const board = game.getBoardState();
    expect(board.getPiece({ row: 4, col: 7 })?.pieceType).toBe("queen");
    expect(board.getPiece({ row: 0, col: 4 })?.pieceType).toBe("king");
    expect(board.getPiece({ row: 7, col: 4 })?.pieceType).toBe("king");
    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 4 }, to: { row: 6, col: 4 } },
        "white"
      )
    ).toThrow("The game is not active");
  });

  it("sets stalemate and prevents further moves", () => {
    const game = new ChessGame();

    playUciSequence(
      game,
      "e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 a5c7 a6h6 h2h4 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6 c8e6"
    );

    expect(game.getGameStatus()).toBe("stalemate");
    expect(game.getFenNotation()).toBe(
      "5bnr/4p1pq/4Qpkr/7p/7P/4P3/PPPP1PP1/RNB1KBNR b KQ - 2 10"
    );
    expect(() =>
      game.makeMove(
        { from: { row: 2, col: 6 }, to: { row: 1, col: 5 } },
        "black"
      )
    ).toThrow("The game is not active");
  });

  it("rejects a move that does not answer check", () => {
    const game = new ChessGame();

    playUciSequence(game, "f2f3 e7e5 h2h3 d8h4");
    const positionBeforeIllegalMove = game.getFenNotation();

    expect(game.getGameStatus()).toBe("check");
    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 0 }, to: { row: 6, col: 0 } },
        "white"
      )
    ).toThrow("Illegal move");
    expect(game.getFenNotation()).toBe(positionBeforeIllegalMove);
    expect(game.getGameStatus()).toBe("check");
  });

  it("rejects a king move onto a square attacked by a bishop", () => {
    const game = new ChessGame();

    playUciSequence(game, "e2e3 b7b6 g2g3 c8a6 f1g2 h7h6");
    const positionBeforeIllegalMove = game.getFenNotation();

    expect(game.getGameStatus()).toBe("active");
    expect(game.getLegalMoves({ row: 7, col: 4 })).not.toContainEqual({
      row: 7,
      col: 5,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 4 }, to: { row: 7, col: 5 } },
        "white"
      )
    ).toThrow("Illegal move");
    expect(game.getFenNotation()).toBe(positionBeforeIllegalMove);
  });

  it("rejects a move from an empty square", () => {
    const game = new ChessGame();

    expect(() =>
      game.makeMove(
        { from: { row: 4, col: 4 }, to: { row: 3, col: 4 } },
        "white"
      )
    ).toThrow("No piece at the starting position");
  });

  it("rejects moving the opponent's piece", () => {
    const game = new ChessGame();

    expect(() =>
      game.makeMove(
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } },
        "white"
      )
    ).toThrow("It's not your piece");
  });

  it.each([
    { row: -1, col: 0 },
    { row: 8, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 8 },
  ])("returns no legal moves for an out-of-bounds square", position => {
    const game = new ChessGame();

    expect(game.getLegalMoves(position)).toEqual([]);
  });

  it("rejects a promotion choice on a move that does not promote", () => {
    const game = new ChessGame();
    const startingPosition = game.getFenNotation();

    expect(() =>
      game.makeMove(
        { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } },
        "white",
        "queen"
      )
    ).toThrow("Promotion piece can only be specified for a promoting move");
    expect(game.getFenNotation()).toBe(startingPosition);
  });

  it("allows en passant and removes the captured pawn", () => {
    const game = new ChessGame();

    playUciSequence(game, "e2e4 a7a6 e4e5 d7d5 e5d6");

    const board = game.getBoardState();
    expect(board.getPiece({ row: 2, col: 3 })?.pieceType).toBe("pawn");
    expect(board.getPiece({ row: 2, col: 3 })?.color).toBe("white");
    expect(board.getPiece({ row: 3, col: 3 })).toBeNull();
  });

  it("allows kingside castling and moves the rook", () => {
    const game = new ChessGame();

    playUciSequence(game, "g1f3 a7a6 g2g3 a6a5 f1g2 a5a4 e1g1");

    const board = game.getBoardState();
    expect(board.getPiece({ row: 7, col: 6 })?.pieceType).toBe("king");
    expect(board.getPiece({ row: 7, col: 5 })?.pieceType).toBe("rook");
    expect(board.getPiece({ row: 7, col: 4 })).toBeNull();
    expect(board.getPiece({ row: 7, col: 7 })).toBeNull();
    expect(game.getFenNotation()).toContain(" b kq ");
  });

  it("allows queenside castling and moves the rook", () => {
    const game = new ChessGame();

    playUciSequence(game, "d2d4 a7a6 c1f4 a6a5 b1c3 a5a4 d1d2 h7h6 e1c1");

    const board = game.getBoardState();
    expect(board.getPiece({ row: 7, col: 2 })?.pieceType).toBe("king");
    expect(board.getPiece({ row: 7, col: 3 })?.pieceType).toBe("rook");
    expect(board.getPiece({ row: 7, col: 0 })).toBeNull();
    expect(board.getPiece({ row: 7, col: 4 })).toBeNull();
    expect(game.getFenNotation().split(" ")[2]).toBe("kq");
  });

  it("removes kingside castling rights after a rook moves away and returns", () => {
    const game = new ChessGame();

    playUciSequence(game, "h2h4 a7a6 h1h2 a6a5 h2h1 a5a4");

    expect(game.getFenNotation().split(" ")[2]).toBe("Qkq");
    expect(game.getLegalMoves({ row: 7, col: 4 })).not.toContainEqual({
      row: 7,
      col: 6,
    });
  });

  it("does not allow castling through an attacked square", () => {
    const game = new ChessGame();

    playUciSequence(game, "e2e3 b7b6 g2g3 c8a6 f1g2 h7h6 g1f3 g7g6");

    expect(game.getLegalMoves({ row: 7, col: 4 })).not.toContainEqual({
      row: 7,
      col: 6,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 4 }, to: { row: 7, col: 6 } },
        "white"
      )
    ).toThrow("Illegal move");
  });

  it("does not allow castling while the king is in check", () => {
    const game = new ChessGame();

    playUciSequence(game, "g1h3 e7e5 g2g4 d7d5 f1g2 c7c6 f2f3 d8h4");

    expect(game.getGameStatus()).toBe("check");
    expect(game.getLegalMoves({ row: 7, col: 4 })).not.toContainEqual({
      row: 7,
      col: 6,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 4 }, to: { row: 7, col: 6 } },
        "white"
      )
    ).toThrow("Illegal move");
  });

  it("does not allow castling to an attacked destination square", () => {
    const game = new ChessGame();

    playUciSequence(game, "f2f3 c7c6 g2g4 d8b6 f1g2 h7h6");

    expect(game.getGameStatus()).toBe("active");
    expect(game.getLegalMoves({ row: 7, col: 4 })).not.toContainEqual({
      row: 7,
      col: 6,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 4 }, to: { row: 7, col: 6 } },
        "white"
      )
    ).toThrow("Illegal move");
  });

  it("rejects en passant when it exposes the king to a rook", () => {
    const game = new ChessGame();

    playUciSequence(
      game,
      "e2e4 h7h6 e1e2 h8h7 e2e3 h6h5 e4e5 h5h4 e3e4 a7a6 e5e6 a6a5 e4e5 b7b6 f2f4 c7c6 f4f5 h7h5 a2a3 g7g5"
    );

    expect(game.getLegalMoves({ row: 3, col: 5 })).not.toContainEqual({
      row: 2,
      col: 6,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 3, col: 5 }, to: { row: 2, col: 6 } },
        "white"
      )
    ).toThrow("Illegal move");
    expect(game.getGameStatus()).toBe("active");
  });

  it("expires en passant after the eligible pawn makes another move", () => {
    const game = new ChessGame();

    playUciSequence(game, "e2e4 a7a6 e4e5 d7d5 b1c3 g7g6");

    expect(game.getFenNotation().split(" ")[3]).toBe("-");
    expect(game.getLegalMoves({ row: 3, col: 4 })).not.toContainEqual({
      row: 2,
      col: 3,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 3, col: 4 }, to: { row: 2, col: 3 } },
        "white"
      )
    ).toThrow("Illegal move");
  });

  it("rejects en passant when it would expose the king to a rook on the same rank", () => {
    const game = new ChessGame();

    playUciSequence(
      game,
      "e2e3 a7a6 f2f3 a6a5 g2g4 a5a4 e1f2 a8a6 f2g3 a6a5 h2h3 h7h6 g3h4 b7b6 g4g5 b8c6 h4h5 f7f5"
    );

    const board = game.getBoardState();
    expect(board.getPiece({ row: 3, col: 7 })?.pieceType).toBe("king");
    expect(board.getPiece({ row: 3, col: 0 })?.pieceType).toBe("rook");
    expect(board.getPiece({ row: 3, col: 6 })?.pieceType).toBe("pawn");
    expect(board.getPiece({ row: 3, col: 5 })?.pieceType).toBe("pawn");
    expect(game.getFenNotation().split(" ")[3]).toBe("f6");
    expect(game.getLegalMoves({ row: 3, col: 6 })).not.toContainEqual({
      row: 2,
      col: 5,
    });
    expect(() =>
      game.makeMove(
        { from: { row: 3, col: 6 }, to: { row: 2, col: 5 } },
        "white"
      )
    ).toThrow("Illegal move");
    expect(game.getGameStatus()).toBe("active");
    expect(game.getFenNotation().split(" ")[3]).toBe("f6");
  });

  it("requires a valid promotion choice and promotes a pawn", () => {
    const game = new ChessGame();
    playUciSequence(game, "a2a4 b7b5 a4b5 b8c6 b5b6 h7h6 b6b7 h6h5");
    const positionBeforePromotion = game.getFenNotation();
    const promotionMove = {
      from: { row: 1, col: 1 },
      to: { row: 0, col: 1 },
    };

    expect(() => game.makeMove(promotionMove, "white")).toThrow(
      "Choose queen, rook, bishop, or knight for promotion"
    );
    expect(game.getFenNotation()).toBe(positionBeforePromotion);

    game.makeMove(promotionMove, "white", "queen");
    expect(game.getBoardState().getPiece({ row: 0, col: 1 })?.pieceType).toBe(
      "queen"
    );
  });

  it.each([
    { suffix: "q", piece: "queen", nextMove: "a8a7" },
    { suffix: "r", piece: "rook", nextMove: "a8a7" },
    { suffix: "b", piece: "bishop", nextMove: "a8b7" },
    { suffix: "n", piece: "knight", nextMove: "a8b6" },
  ] as const)(
    "allows capture-promotion to $piece and then moves it legally",
    ({ suffix, piece, nextMove }) => {
      const game = new ChessGame();
      playUciSequence(game, "a2a4 b7b5 a4b5 a7a6 b5b6 h7h6 b6b7 h6h5");

      playUciSequence(game, `b7a8${suffix}`);

      const promotedBoard = game.getBoardState();
      expect(promotedBoard.getPiece({ row: 0, col: 0 })?.pieceType).toBe(piece);
      expect(promotedBoard.getPiece({ row: 0, col: 0 })?.color).toBe("white");

      playUciSequence(game, `g8f6 ${nextMove}`, "black");

      const movedBoard = game.getBoardState();
      const destination = {
        row: 8 - Number(nextMove[3]),
        col: nextMove.charCodeAt(2) - 97,
      };
      expect(movedBoard.getPiece({ row: 0, col: 0 })).toBeNull();
      expect(movedBoard.getPiece(destination)?.pieceType).toBe(piece);
      expect(movedBoard.getPiece(destination)?.color).toBe("white");
    }
  );

  it("removes black queenside castling rights when a white pawn captures the original rook", () => {
    const game = new ChessGame();

    playUciSequence(game, "a2a4 b7b5 a4b5 a7a6 b5b6 h7h6 b6b7 h6h5 b7a8q");

    expect(game.getFenNotation().split(" ")[2]).toBe("KQk");
    expect(game.getBoardState().getPiece({ row: 0, col: 0 })?.pieceType).toBe(
      "queen"
    );
  });

  it("ends in a draw when a position occurs three times", () => {
    const game = new ChessGame();

    for (let repetition = 0; repetition < 2; repetition++) {
      playUciSequence(game, "g1f3 g8f6 f3g1 f6g8");
    }

    expect(() =>
      game.makeMove(
        { from: { row: 7, col: 1 }, to: { row: 5, col: 0 } },
        "white"
      )
    ).toThrow("The game is not active");
  });

  it("ends in a draw after 100 half-moves without a pawn move or capture", () => {
    const game = new ChessGame();

    playUciSequence(
      game,
      `g1h3 b8a6 h3g5 g8h6 g5h3 h8g8 b1a3 h6g4
      h3g5 g4e5 g5h3 a6b8 a3b5 g8h8 h1g1 b8a6
      b5a3 e5g4 g1h1 g4e5 h1g1 h8g8 a3b1 a6c5
      h3g5 e5c4 g5f3 a8b8 b1a3 c5e4 a3b5 e4g5
      b5c3 g5h3 c3a4 c4e5 a1b1 h3f4 g1h1 e5g4
      f3e5 f4g6 b1a1 g6h8 e5f3 g4e3 a4b6 h8g6
      f3g1 g6h8 b6a8 e3c4 g1f3 h8g6 a8b6 c4a3
      f3g1 g8h8 b6c4 g6h4 a1b1 h4f5 b1a1 h8g8
      g1f3 f5h6 f3e5 b8a8 h1g1 a3b5 g1h1 b5c3
      e5f3 c3b5 f3h4 h6g4 h4g6 g4e3 h1g1 b5a3
      c4e5 a8b8 g6f4 e3d5 f4d3 d5e3 d3b4 a3b1
      g1h1 e3g4 b4c6 g8h8 e5f3 g4f6 c6a5 f6d5
      f3g1 b8a8 a5b3 b1a3`
    );

    expect(game.getGameStatus()).toBe("draw");
    expect(game.getFenNotation()).toBe(
      "r1bqkb1r/pppppppp/8/3n4/8/nN6/PPPPPPPP/R1BQKBNR w - - 100 51"
    );
  });
});
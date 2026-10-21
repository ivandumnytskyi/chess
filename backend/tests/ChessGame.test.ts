import { describe, expect, it } from "vitest";
import { ChessGame } from "../src/game/ChessGame";

describe("ChessGame", () => {
  it("starts in the standard position", () => {
    const game = new ChessGame();

    expect(game.getFenNotation()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });
});
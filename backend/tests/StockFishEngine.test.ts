import { afterAll, describe, expect, it } from "vitest";
import { botEngine } from "../src/bot/StockFishEngine";
import { ChessGame } from "../src/game/ChessGame";
import type { Position } from "../src/types/chess";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Fool's mate: white is checkmated, so Stockfish reports "bestmove (none)".
const CHECKMATED_FEN = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
const SETTINGS = { elo: 1500, moveTimeMs: 200 };
const ENGINE_TEST_TIMEOUT_MS = 20_000;
const MIN_ELO = 1320;
const MAX_ELO = 3000;

const toSquare = ({ row, col }: Position): string =>
  `${String.fromCharCode(97 + col)}${8 - row}`;

const legalStartMoves = (): string[] =>
  new ChessGame()
    .getLegalMovesForTurn()
    .flatMap(({ from, moves }) => moves.map((to) => `${toSquare(from)}${toSquare(to)}`));

afterAll(() => {
  botEngine.shutdown();
});

describe("StockfishBotEngine", () => {
  it("returns a legal first move from the starting position", async () => {
    const move = await botEngine.bestMove(START_FEN, SETTINGS);

    expect(legalStartMoves()).toContain(move);
  }, ENGINE_TEST_TIMEOUT_MS);

  it("returns null when the side to move has no legal moves", async () => {
    const move = await botEngine.bestMove(CHECKMATED_FEN, SETTINGS);

    expect(move).toBeNull();
  }, ENGINE_TEST_TIMEOUT_MS);

  it("resolves overlapping requests one after another", async () => {
    const [first, second] = await Promise.all([
      botEngine.bestMove(START_FEN, SETTINGS),
      botEngine.bestMove(START_FEN, SETTINGS),
    ]);

    expect(legalStartMoves()).toContain(first);
    expect(legalStartMoves()).toContain(second);
  }, ENGINE_TEST_TIMEOUT_MS);
});

const SEARCH_RUNS = 12;

const distinctMovesAt = async (elo: number): Promise<number> => {
  const moves = new Set<string | null>();
  for (let run = 0; run < SEARCH_RUNS; run++) {
    moves.add(await botEngine.bestMove(START_FEN, { elo, moveTimeMs: 100 }));
  }
  return moves.size;
};

it("plays more varied moves at minimum Elo than at maximum Elo", async () => {
  const lowVariety = await distinctMovesAt(MIN_ELO);
  const highVariety = await distinctMovesAt(MAX_ELO);

  expect(lowVariety).toBeGreaterThan(highVariety);
}, 60_000);
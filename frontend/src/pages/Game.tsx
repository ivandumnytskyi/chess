import { useEffect, useState } from "react";
import type { GameView, Cell, Color, GameStatus, MoveData, Position } from "../types";
import { useTheme } from "../context/ThemeContext";
import Board from "../components/Game/Board";
import GameOverlay from "../components/Game/GameOverlay";
import { authorizedFetch } from "../lib/authorization";

const API_URL = "http://localhost:3000/api";

async function createGame(): Promise<GameView> {
  const res = await authorizedFetch(`${API_URL}/game`, { method: "POST" });
  const data: { gameId: string; boardState: { squares: Cell[][] }; currentTurn: Color } = await res.json();
  return { gameId: data.gameId, squares: data.boardState.squares, currentTurn: data.currentTurn, status: "active" };
}

const pieceKey = (position: Position) => `${position.row}-${position.col}`;

type PieceMoves = { from: Position; moves: Position[] };

const toMovesByPiece = (entries: PieceMoves[]): Record<string, Position[]> =>
  Object.fromEntries(entries.map(({ from, moves }) => [pieceKey(from), moves]));

async function fetchAllLegalMoves(gameId: string): Promise<Record<string, Position[]>> {
  const res = await authorizedFetch(`${API_URL}/game/all-legal-moves?gameId=${gameId}`);
  const data: { legalMoves: PieceMoves[] } = await res.json();
  return toMovesByPiece(data.legalMoves);
}

function Game() {
  const { themeIndex, pieceTheme } = useTheme();
  
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [movesByPiece, setMovesByPiece] = useState<Record<string, Position[]>>({});
  const [error, setError] = useState<string | null>(null);

  const legalMoves = selectedPiece ? movesByPiece[pieceKey(selectedPiece)] ?? [] : [];

  useEffect(() => {
    const load = async () => {
      try {
        const newGame = await createGame();
        setGame(newGame);
        setMovesByPiece(await fetchAllLegalMoves(newGame.gameId));
      } catch {
        setError("Could not reach the server");
      }
    };
    load();
  }, []);

  const squares = game?.squares ?? [];

  const restart = async () => {
    try {
      const newGame = await createGame();
      setGame(newGame);
      setSelectedPiece(null);
      setMovesByPiece(await fetchAllLegalMoves(newGame.gameId));
    } catch {
      setError("Could not reach the server");
    }
  };

  const handleSquareClick = async (row: number, col: number) => {
    if (!game) return;
    const clicked: Position = { row, col };

    try {
      if (selectedPiece && legalMoves.some((m) => m.row === row && m.col === col)) {
        const color = game.squares[selectedPiece.row][selectedPiece.col]?.color;
        if (!color) return;
        const moveData: MoveData = { from: selectedPiece, to: clicked };
        const res = await authorizedFetch(`${API_URL}/game/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: game.gameId, moveData, color }),
        });
        if (!res.ok) {
          setError(await res.text());
          return;
        }
        const data: {
          boardState: { squares: Cell[][] };
          currentTurn: Color;
          status: GameStatus;
          legalMoves: PieceMoves[];
        } = await res.json();
        setGame({ ...game, squares: data.boardState.squares, currentTurn: data.currentTurn, status: data.status });
        setMovesByPiece(toMovesByPiece(data.legalMoves));
        setSelectedPiece(null);
        return;
      }

      const piece = game.squares[row][col];
      if (!piece || piece.color !== game.currentTurn) {
        setSelectedPiece(null);
        return;
      }
      setError(null);
      setSelectedPiece(clicked);
    } catch {
      setError("Could not reach the server");
    }
  };
  return (
    <>
      {error && <p className="absolute top-2 left-1/2 -translate-x-1/2 text-red-600">{error}</p>}
      <div className="grid grid-rows-8 gap-0 size-[min(100vw,90vh)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 absolute">
        {game && game.status !== "active" &&
          game.status !== "check" && (
            <GameOverlay game={game} restart={restart} />
          )}
        {game && (
          <Board
            squares={squares}
            themeIndex={themeIndex}
            handleSquareClick={handleSquareClick}
            selectedPiece={selectedPiece}
            legalMoves={legalMoves}
            pieceTheme={pieceTheme}
          />
        )}
      </div>
    </>
  );
}

export default Game;

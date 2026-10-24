import { useEffect, useState } from "react";
import type { GameView, Cell, Color, GameStatus, MoveData, Position } from "./types";
import Board from "./components/Board";
import Overlay from "./components/Overlay";
import Selection from "./components/Selection";

const API_URL = "http://localhost:3000/api";



async function createGame(): Promise<GameView> {
  const res = await fetch(`${API_URL}/game`, { method: "POST" });
  const data: { gameId: string; boardState: { squares: Cell[][] }; currentTurn: Color } = await res.json();
  return { gameId: data.gameId, squares: data.boardState.squares, currentTurn: data.currentTurn, status: "active" };
}

async function fetchStatus(gameId: string): Promise<GameStatus> {
  const res = await fetch(`${API_URL}/game?gameId=${gameId}`);
  const data: { status: GameStatus } = await res.json();
  return data.status;
}

function App() {
  const [themeIndex, setThemeIndex] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [legalMoves, setLegalMoves] = useState<Position[]>([]);
  const [pieceTheme, setPieceTheme] = useState("staunty");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setGame(await createGame());
      } catch {
        setError("Could not reach the server");
      }
    };
    load();
  }, []);

  const squares = game?.squares ?? [];

  const restart = async () => {
    try {
      setGame(await createGame());
      setSelectedPiece(null);
      setLegalMoves([]);
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
        const res = await fetch(`${API_URL}/game/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: game.gameId, moveData, color }),
        });
        if (!res.ok) {
          setError(await res.text());
          return;
        }
        const data: { boardState: { squares: Cell[][] }; currentTurn: Color } = await res.json();
        const status = await fetchStatus(game.gameId);
        setGame({ ...game, squares: data.boardState.squares, currentTurn: data.currentTurn, status });
        setSelectedPiece(null);
        setLegalMoves([]);
        return;
      }

      const piece = game.squares[row][col];
      if (!piece || piece.color !== game.currentTurn) {
        setSelectedPiece(null);
        setLegalMoves([]);
        return;
      }
      setError(null);
      setSelectedPiece(clicked);
      const res = await fetch(`${API_URL}/game/legal-moves?gameId=${game.gameId}&row=${row}&col=${col}`);
      const data: { legalMoves: Position[] } = await res.json();
      setLegalMoves(data.legalMoves);
    } catch {
      setError("Could not reach the server");
    }
  };
  return (
    <>
      {game && (
        <Selection
          currentTurn={game.currentTurn}
          themeIndex={themeIndex}
          setThemeIndex={setThemeIndex}
          pieceTheme={pieceTheme}
          setPieceTheme={setPieceTheme}
        />
      )}
      {error && <p className="absolute top-2 left-1/2 -translate-x-1/2 text-red-600">{error}</p>}
      <div className="grid grid-rows-8 gap-0 aspect-square h-[90%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 absolute">
        {game && game.status !== "active" &&
          game.status !== "check" && (
            <Overlay game={game} restart={restart} />
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

export default App;

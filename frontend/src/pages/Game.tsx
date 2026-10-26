import { useEffect, useRef, useState } from "react";
import type { GameView, Cell, Color, ClockState, GameStatus, MoveData, Position, PromotionPiece } from "../types";
import { useTheme } from "../context/ThemeContext";
import Board from "../components/Game/Board";
import GameOverlay from "../components/Game/GameOverlay";
import Clock from "../components/Game/Clock";
import Promotion from "../components/Game/Promotion";
import TimeControlPicker from "../components/Game/TimeControlPicker";
import { authorizedFetch } from "../lib/authorization";
import { DEFAULT_TIME_CONTROL, type TimeControlId } from "../constants/timeControls";

const API_URL = "http://localhost:3000/api";

type ServerClock = { whiteRemainingMs: number; blackRemainingMs: number };

async function createGame(timeControl: TimeControlId): Promise<{ game: GameView; clock: ClockState }> {
  const res = await authorizedFetch(`${API_URL}/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeControl }),
  });
  if (!res.ok) throw new Error("Could not start game");
  const data: { gameId: string; boardState: { squares: Cell[][] }; currentTurn: Color; clock: ServerClock } = await res.json();
  return {
    game: { gameId: data.gameId, squares: data.boardState.squares, currentTurn: data.currentTurn, status: "active" },
    clock: { ...data.clock, syncedAt: Date.now() },
  };
}

const pieceKey = (position: Position) => `${position.row}-${position.col}`;

type LastMove = { from: Position; to: Position; id: number };

// What the board looked like before an optimistic move, so it can be restored if the server rejects the move.
type BoardSnapshot = {
  game: GameView;
  clock: ClockState | null;
  movesByPiece: Record<string, Position[]>;
  lastMove: LastMove | null;
};

// Castling, en passant and promotion change more than the two squares, so they wait for the server.
const isSimpleMove = (squares: Cell[][], from: Position, to: Position): boolean => {
  const piece = squares[from.row][from.col];
  if (!piece) return false;
  if (piece.pieceType === "king" && Math.abs(to.col - from.col) === 2) return false;
  if (piece.pieceType === "pawn") {
    const isDiagonal = from.col !== to.col;
    const isCapture = squares[to.row][to.col] !== null;
    if (isDiagonal && !isCapture) return false;
    if (to.row === 0 || to.row === 7) return false;
  }
  return true;
};

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
  const [timeControl, setTimeControl] = useState<TimeControlId>(DEFAULT_TIME_CONTROL);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position; id: number } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Position; to: Position } | null>(null);

  const legalMoves = selectedPiece ? movesByPiece[pieceKey(selectedPiece)] ?? [] : [];
  const serverOver = game ? Boolean(game.winner) || (game.status !== "active" && game.status !== "check") : false;
  const timeoutRequested = useRef(false);
  const moveInFlight = useRef(false);

  const remainingFor = (color: Color): number => {
    if (!clock) return 0;
    const base = color === "white" ? clock.whiteRemainingMs : clock.blackRemainingMs;
    const running = !serverOver && game?.currentTurn === color;
    return running ? Math.max(0, base - Math.max(0, now - clock.syncedAt)) : base;
  };

  // The side to move has run out of time locally; the server is told so the result is recorded.
  const timedOut = game !== null && clock !== null && !serverOver && remainingFor(game.currentTurn) === 0;
  const isOver = serverOver || timedOut;
  const resolvedWinner: Color | undefined =
    game?.winner ?? (timedOut && game ? (game.currentTurn === "white" ? "black" : "white") : undefined);
  const gameId = game?.gameId;

  // Re-render every 100ms so the side to move's clock counts down between server updates.
  useEffect(() => {
    if (!game || isOver) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [game, isOver]);

  useEffect(() => {
    if (!timedOut || !gameId || timeoutRequested.current) return;
    timeoutRequested.current = true;

    const reportTimeout = async () => {
      try {
        const res = await authorizedFetch(`${API_URL}/game/timeout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
        if (!res.ok) {
          setError(await res.text());
          return;
        }
        const data: { winner: Color; clock: ServerClock } = await res.json();
        setGame((prev) => (prev ? { ...prev, winner: data.winner } : prev));
        setClock({ ...data.clock, syncedAt: Date.now() });
      } catch {
        setError("Could not reach the server");
      } finally {
        timeoutRequested.current = false;
      }
    };
    void reportTimeout();
  }, [gameId, timedOut]);

  const squares = game?.squares ?? [];

  const startGame = async () => {
    try {
      const { game: newGame, clock: newClock } = await createGame(timeControl);
      setGame(newGame);
      setClock(newClock);
      setNow(Date.now());
      setLastMove(null);
      setSelectedPiece(null);
      setError(null);
      setMovesByPiece(await fetchAllLegalMoves(newGame.gameId));
    } catch {
      setError("Could not reach the server");
    }
  };

  const restoreSnapshot = (snapshot: BoardSnapshot) => {
    setGame(snapshot.game);
    setClock(snapshot.clock);
    setMovesByPiece(snapshot.movesByPiece);
    setLastMove(snapshot.lastMove);
  };

  // Plays the move on the local board right away; the server's answer replaces it when it arrives.
  const applyMoveLocally = (from: Position, to: Position) => {
    setGame((prev) => {
      if (!prev) return prev;
      const squares = prev.squares.map((r) => [...r]);
      squares[to.row][to.col] = squares[from.row][from.col];
      squares[from.row][from.col] = null;
      return { ...prev, squares, currentTurn: prev.currentTurn === "white" ? "black" : "white" };
    });
    setClock({ whiteRemainingMs: remainingFor("white"), blackRemainingMs: remainingFor("black"), syncedAt: Date.now() });
    setMovesByPiece({});
    setSelectedPiece(null);
    setLastMove({ from, to, id: Date.now() });
  };

  const sendMove = async (snapshot: BoardSnapshot, moveData: MoveData, color: Color, appliedLocally: boolean) => {
    moveInFlight.current = true;
    try {
      const res = await authorizedFetch(`${API_URL}/game/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: snapshot.game.gameId, moveData, color }),
      });
      if (!res.ok) {
        const text = await res.text();
        restoreSnapshot(snapshot);
        // A timeout comes back as JSON with the winner and final clocks; other errors are plain text.
        try {
          const body = JSON.parse(text) as { winner?: Color; clock?: ServerClock };
          if (body.winner && body.clock) {
            setGame({ ...snapshot.game, winner: body.winner });
            setClock({ ...body.clock, syncedAt: Date.now() });
            return;
          }
        } catch {
          // not JSON, show the message below
        }
        setError(text);
        return;
      }
      const data: {
        boardState: { squares: Cell[][] };
        currentTurn: Color;
        status: GameStatus;
        legalMoves: PieceMoves[];
        clock: ServerClock;
      } = await res.json();
      setGame((prev) => (prev ? { ...prev, squares: data.boardState.squares, currentTurn: data.currentTurn, status: data.status } : prev));
      setClock({ ...data.clock, syncedAt: Date.now() });
      setMovesByPiece(toMovesByPiece(data.legalMoves));
      // Moves played locally already animated; special moves animate once the server confirms them.
      if (!appliedLocally) setLastMove({ from: moveData.from, to: moveData.to, id: Date.now() });
    } catch {
      restoreSnapshot(snapshot);
      setError("Could not reach the server");
    } finally {
      moveInFlight.current = false;
    }
  };

  const choosePromotion = async (piece: PromotionPiece) => {
    if (!pendingPromotion || !game || moveInFlight.current) return;
    const { from, to } = pendingPromotion;
    const color = game.squares[from.row][from.col]?.color;
    setPendingPromotion(null);
    setSelectedPiece(null);
    if (!color) return;
    const snapshot: BoardSnapshot = { game, clock, movesByPiece, lastMove };
    await sendMove(snapshot, { from, to, promotion: piece }, color, false);
  };

  const handleSquareClick = async (row: number, col: number) => {
    if (!game || isOver || moveInFlight.current) return;
    const clicked: Position = { row, col };

    if (pendingPromotion) {
      setPendingPromotion(null);
      setSelectedPiece(null);
      return;
    }

    try {
      if (selectedPiece && legalMoves.some((m) => m.row === row && m.col === col)) {
        const color = game.squares[selectedPiece.row][selectedPiece.col]?.color;
        if (!color) return;
        if (game.squares[selectedPiece.row][selectedPiece.col]?.pieceType === "pawn" && (row === 0 || row === 7)) {
          setPendingPromotion({ from: selectedPiece, to: clicked });
          return;
        }
        const snapshot: BoardSnapshot = { game, clock, movesByPiece, lastMove };
        const simple = isSimpleMove(game.squares, selectedPiece, clicked);
        if (simple) applyMoveLocally(selectedPiece, clicked);
        await sendMove(snapshot, { from: selectedPiece, to: clicked }, color, simple);
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
      {game && clock ? (
        <div className="flex flex-col items-center gap-2 w-[min(100vw,calc(90vh-7rem))] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 absolute">
          <Clock color="black" remainingMs={remainingFor("black")} active={!isOver && game.currentTurn === "black"} />
          <div className="grid grid-rows-8 gap-0 w-full aspect-square relative">
            {isOver && (
              <GameOverlay game={{ ...game, winner: resolvedWinner }} restart={startGame} />
            )}
            <Board
              squares={squares}
              themeIndex={themeIndex}
              handleSquareClick={handleSquareClick}
              selectedPiece={selectedPiece}
              legalMoves={legalMoves}
              pieceTheme={pieceTheme}
              lastMove={lastMove}
            />
            {pendingPromotion && (
              <Promotion
                color={game.currentTurn}
                theme={pieceTheme}
                column={pendingPromotion.to.col}
                onSelect={choosePromotion}
              />
            )}
          </div>
          <Clock color="white" remainingMs={remainingFor("white")} active={!isOver && game.currentTurn === "white"} />
        </div>
      ) : (
        <TimeControlPicker value={timeControl} onChange={setTimeControl} onStart={startGame} />
      )}
    </>
  );
}

export default Game;

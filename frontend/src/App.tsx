import { useState } from "react";
import { boardThemes } from "./constants/boardThems";
import PieceThemes from "./constants/pieceThems";
import type { MoveData, Position } from "../../backend/src/types/chess";
import { ChessGame } from "../../backend/src/game/ChessGame";
import Piece from "./components/Piece";

function App() {
  const [themeIndex, setThemeIndex] = useState(0);
  const initialGame = new ChessGame();
  const [game, setGame] = useState(initialGame);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [legalMoves, setLegalMoves] = useState<{ row: number; col: number }[]>(
    [],
  );
  const [pieceTheme, setPieceTheme] = useState("staunty");
  return (
    <>
      <div className="p-4 flex flex-col gap-4 max-w-60">
        <p>Current turn: {game.getCurrentTurn()}</p>
        <label htmlFor="board-theme">Board theme:</label>

        <select
          id="board-theme"
          value={themeIndex}
          onChange={(event) => setThemeIndex(Number(event.target.value))}
        >
          {boardThemes.map((theme, index) => (
            <option key={theme.name} value={index}>
              {theme.name}
            </option>
          ))}
        </select>
        <label htmlFor="piece-theme">Piece theme:</label>
        <select
          id="piece-theme"
          value={pieceTheme}
          onChange={(event) => setPieceTheme(event.target.value)}
        >
          {PieceThemes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
        {boardThemes.map((theme, index) => (
          <option key={theme.name} value={index}>
            {theme.name}
          </option>
        ))}
      </div>
      <div className="grid grid-rows-8 gap-0 aspect-square h-[90%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 absolute">
        {game.getGameStatus() !== "active" &&
          game.getGameStatus() !== "check" && (
            <>
              <div className="w-full h-full absolute bg-black z-200 opacity-40"></div>
              <div className="absolute flex flex-col rounded-lg items-center justify-center text-white text-2xl z-300 w-[40%] h-[30%] bg-black top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <p>
                  {game.getGameStatus() === "draw"
                    ? "Draw!"
                    : game.getGameStatus() === "checkmate"
                      ? (game.getCurrentTurn() === "white"
                          ? "Black"
                          : "White") + " wins."
                      : "Stalemate!"}
                </p>
                <button
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
                  onClick={() => setGame(new ChessGame())}
                >
                  Restart
                </button>
              </div>
            </>
          )}
        {game.getBoardState().squares.map((row, rowIndex) => (
          <div key={rowIndex} className="w-full flex">
            {row.map((cell, colIndex) => {
              const isBlack = (rowIndex + colIndex) % 2 === 1;
              return (
                <button
                  key={colIndex}
                  id={`${rowIndex}-${colIndex}`}
                  onClick={() => {
                    if (selectedPiece) {
                      const move: Position = { row: rowIndex, col: colIndex };
                      if (
                        legalMoves.some(
                          (m) => m.row === move.row && m.col === move.col,
                        )
                      ) {
                        const moveData: MoveData = {
                          from: selectedPiece,
                          to: move,
                        };
                        const color = game
                          .getBoardState()
                          .getPiece(selectedPiece)?.color;
                        if (!color) return;
                        game.makeMove(moveData, color);
                        setGame(game);
                        setSelectedPiece(null);
                        setLegalMoves([]);
                      } else {
                        setSelectedPiece({ row: rowIndex, col: colIndex });
                        setLegalMoves(
                          game.getLegalMoves({ row: rowIndex, col: colIndex }),
                        );
                      }
                    } else {
                      setSelectedPiece({ row: rowIndex, col: colIndex });
                      setLegalMoves(
                        game.getLegalMoves({ row: rowIndex, col: colIndex }),
                      );
                    }
                  }}
                  className={`aspect-square h-full relative ${
                    isBlack
                      ? boardThemes[themeIndex].dark
                      : boardThemes[themeIndex].light
                  }`}
                >
                  <div
                    className={`absolute inset-0 opacity-40 z-0 ${selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex ? "bg-yellow-500" : ""} 
                   ${legalMoves.some((move) => move.row === rowIndex && move.col === colIndex) ? "bg-blue-300" : ""}`}
                  ></div>
                  {cell && (
                    <Piece
                      pieceType={cell.pieceType}
                      color={cell.color}
                      theme={pieceTheme}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

export default App;

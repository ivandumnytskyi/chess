
import { boardThemes } from "../../constants/boardThems";
import Piece from "./Piece";
import type { Cell, Position } from "../../types"; 

type BoardProps = {
  squares: Cell[][];
  themeIndex: number;
  handleSquareClick: (row: number, col: number) => void;
  selectedPiece: { row: number; col: number } | null;
  legalMoves: { row: number; col: number }[];
  pieceTheme: string;
  lastMove: { from: Position; to: Position; id: number } | null;
};
const Board = ({ squares, themeIndex, handleSquareClick, selectedPiece, legalMoves, pieceTheme, lastMove }: BoardProps) => {
  return (
    <div className="contents">
    {squares.map((row, rowIndex) => (
          <div key={rowIndex} className="w-full flex">
            {row.map((cell, colIndex) => {
              const isBlack = (rowIndex + colIndex) % 2 === 1;
              const isMoveTarget = lastMove?.to.row === rowIndex && lastMove?.to.col === colIndex;
              return (
                <button
                  key={colIndex}
                  id={`${rowIndex}-${colIndex}`}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
                  className={`aspect-square h-full relative min-h-0 min-w-0 overflow-hidden ${
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
                      key={isMoveTarget && lastMove ? `move-${lastMove.id}` : "static"}
                      pieceType={cell.pieceType}
                      color={cell.color}
                      theme={pieceTheme}
                      offset={
                        isMoveTarget && lastMove
                          ? {
                              x: (lastMove.from.col - lastMove.to.col) * 100,
                              y: (lastMove.from.row - lastMove.to.row) * 100,
                            }
                          : undefined
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
    </div>
  );
};

export default Board;
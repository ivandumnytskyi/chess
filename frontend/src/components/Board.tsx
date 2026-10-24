
import { boardThemes } from "../constants/boardThems";
import Piece from "./Piece";
import type { Cell } from "../types"; 

type BoardProps = {
  squares: Cell[][];
  themeIndex: number;
  handleSquareClick: (row: number, col: number) => void;
  selectedPiece: { row: number; col: number } | null;
  legalMoves: { row: number; col: number }[];
  pieceTheme: string;
};
const Board = ({ squares, themeIndex, handleSquareClick, selectedPiece, legalMoves, pieceTheme }: BoardProps) => {
  return (
    <div className="contents">
    {squares.map((row, rowIndex) => (
          <div key={rowIndex} className="w-full flex">
            {row.map((cell, colIndex) => {
              const isBlack = (rowIndex + colIndex) % 2 === 1;
              return (
                <button
                  key={colIndex}
                  id={`${rowIndex}-${colIndex}`}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
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
  );
};

export default Board;
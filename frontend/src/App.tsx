import { useState } from "react";
import { boardThemes } from "./constants/boardThems";

function App() {
  const [themeIndex, setThemeIndex] = useState(0);
  const board = Array.from({ length: 8 }, () => Array<null>(8).fill(null));
  return (
    <>
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
      <div className="grid grid-rows-8 gap-0 aspect-square h-[90%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 absolute">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="w-full">
            {row.map((cell, colIndex) => {
              const isBlack = (rowIndex + colIndex) % 2 === 1;
              return (
                <span
                  key={colIndex}
                  className={`inline-block aspect-square h-full  ${
                    isBlack
                      ? boardThemes[themeIndex].dark
                      : boardThemes[themeIndex].light
                  }`}
                >
                  {cell}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

export default App;

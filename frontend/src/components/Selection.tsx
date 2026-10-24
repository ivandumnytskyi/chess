import { boardThemes } from "../constants/boardThems";
import PieceThemes from "../constants/pieceThems";

type SelectionProps = {
  currentTurn: string;
  themeIndex: number;
  setThemeIndex: (index: number) => void;
  pieceTheme: string;
  setPieceTheme: (theme: string) => void;
};

const Selection = ({ currentTurn, themeIndex, setThemeIndex, pieceTheme, setPieceTheme }: SelectionProps) => {
  return (
    <div className="p-4 flex flex-col gap-4 max-w-60">
        <p>Current turn: {currentTurn}</p>
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
      </div>
  );
};

export default Selection;
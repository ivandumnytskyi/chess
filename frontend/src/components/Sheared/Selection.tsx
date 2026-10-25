import { boardThemes } from "../../constants/boardThems";
import PieceThemes from "../../constants/pieceThems";
import { useTheme } from "../../context/ThemeContext";

const Selection = () => {
  const { themeIndex, setThemeIndex, pieceTheme, setPieceTheme } = useTheme();
  return (
    <div className="p-4 flex flex-col gap-4">
      <fieldset className="flex justify-around gap-4 w-full">
        <legend className="col-span-2 pb-2">Board theme:</legend>
        {boardThemes.map((theme, index) => (
          <label
            key={theme.name}
            className={`flex items-center gap-2 border-2 px-2 py-2 rounded-lg w-max ${
              themeIndex === index ? "border-blue-500" : "border-white"
            }`}
          >
            <input
              type="radio"
              name="board-theme"
              value={index}
              checked={themeIndex === index}
              onChange={() => setThemeIndex(index)}
              className="sr-only"
            />
            <div className="grid grid-cols-2">
              <div className={`w-6 h-6 ${theme.light}`}></div>
              <div className={`w-6 h-6 ${theme.dark}`}></div>
              <div className={`w-6 h-6 ${theme.dark}`}></div>
              <div className={`w-6 h-6 ${theme.light}`}></div>
            </div>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col justify-center items-center sm:grid sm:grid-cols-2 gap-2 w-full ">
        <legend className="col-span-2 pb-2 w-full text-center">Piece theme:</legend>
        {PieceThemes.map((theme) => (
          <label
            key={theme}
            className={`flex items-center gap-2 border-2  px-2 py-2 rounded-lg w-max ${
              pieceTheme === theme ? "border-blue-500" : "border-white"
            }`}
          >
            <input
              type="radio"
              name="piece-theme"
              value={theme}
              checked={pieceTheme === theme}
              onChange={() => setPieceTheme(theme)}
              className="sr-only"
            />
            <img
              src={`/pieceThems/${theme}/bK.svg`}
              alt={theme}
              className="w-8 h-8"
            />
            <img
              src={`/pieceThems/${theme}/wQ.svg`}
              alt={theme}
              className="w-8 h-8"
            />
            <img
              src={`/pieceThems/${theme}/bB.svg`}
              alt={theme}
              className="w-8 h-8"
            />
            <img
              src={`/pieceThems/${theme}/wN.svg`}
              alt={theme}
              className="w-8 h-8"
            />
          </label>
        ))}
      </fieldset>

     
    </div>
  );
};

export default Selection;

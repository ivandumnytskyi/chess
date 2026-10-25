import type { GameView } from "../../types";

const Overlay = ({ game, restart }: { game: GameView; restart: () => void }) => {
  if (game.status === "active") return null;

  const message =
    game.status === "draw"
      ? "Draw!"
      : game.status === "checkmate"
      ? (game.currentTurn === "white" ? "Black" : "White") + " wins."
      : "Stalemate!";

  return (
    <>
      <div className="w-full h-full absolute bg-black z-200 opacity-40"></div>
      <div className="absolute flex flex-col rounded-lg items-center justify-center text-white text-2xl z-300 w-[40%] h-[30%] bg-black top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <p>{message}</p>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={restart}
        >
          Restart
        </button>
      </div>
    </>
  );
};

export default Overlay;
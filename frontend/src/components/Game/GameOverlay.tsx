import type { GameView } from "../../types";

const REASON_TEXT: Record<string, string> = {
  checkmate: "by checkmate",
  resignation: "by resignation",
  timeout: "on time",
};

const getEndMessage = (game: GameView, endReason: string | null): string => {
  if (game.winner) {
    const winnerName = game.winner === "white" ? "White" : "Black";
    const reason = endReason ? REASON_TEXT[endReason] : undefined;
    return reason ? `${winnerName} wins ${reason}.` : `${winnerName} wins.`;
  }
  if (game.status === "draw") return "Draw!";
  if (game.status === "checkmate") {
    return `${game.currentTurn === "white" ? "Black" : "White"} wins by checkmate.`;
  }
  return "Stalemate!";
};

const GameOverlay = ({
  game,
  endReason,
  restart,
}: {
  game: GameView;
  endReason: string | null;
  restart?: () => void;
}) => {
  if (game.status === "active" && !game.winner) return null;

  const message = getEndMessage(game, endReason);

  return (
    <>
      <div className="fixed inset-0 z-200 bg-black/70 backdrop-blur-sm" />
      <div className="absolute flex flex-col rounded-lg items-center justify-center text-white text-2xl z-300 w-[40%] h-[30%] bg-black top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <p>{message}</p>
         <a
          href="/"
          className="mt-4 px-4 py-2 bg-ruby text-white rounded"
        >
          Home
        </a>
        {restart && (
          <button
            className="mt-4 px-4 py-2 bg-ruby text-white rounded"
            onClick={restart}
          >
            Restart
          </button>
        )}
      </div>
    </>
  );
};

export default GameOverlay;
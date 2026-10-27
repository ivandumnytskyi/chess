import { TIME_CONTROL_OPTIONS } from "../../constants/timeControls";
import type { GameOutcome, GameSummary } from "../../lib/history";

type GameHistoryProps = {
  games: GameSummary[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
};

const OUTCOME_STYLES: Record<GameOutcome, { label: string; className: string }> = {
  win: { label: "Win", className: "bg-green-700" },
  loss: { label: "Loss", className: "bg-red-700" },
  draw: { label: "Draw", className: "bg-gray-500" },
};

const timeControlLabel = (id: string) => TIME_CONTROL_OPTIONS.find((option) => option.id === id)?.label ?? id;

const GameRow = ({ game }: { game: GameSummary }) => {
  const outcome = game.outcome ? OUTCOME_STYLES[game.outcome] : { label: "In progress", className: "bg-blue-500" };

  return (
    <li className={`flex items-center justify-between gap-4 rounded-xl px-5 py-4 ${outcome.className}`}>
      <div className="flex items-center gap-4">
        <div>
          <p className="font-medium">{game.opponentUsername === 'guest' ? "vs guest" : game.opponentUsername ? "vs " + game.opponentUsername : "Solo"}</p>
          <p className="text-sm text-gray-400">
            {timeControlLabel(game.timeControlId)} · playing {game.color}
          </p>
        </div>
      </div>
      <time className="text-sm text-gray-400" dateTime={game.createdAt}>
        {new Date(game.createdAt).toLocaleDateString()}
      </time>
    </li>
  );
};

const GameHistory = ({ games, loading, loadingMore, error, hasMore, onLoadMore }: GameHistoryProps) => {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Game history</h2>

      {loading ? (
        <p className="text-gray-400">Loading games...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : games.length === 0 ? (
        <p className="text-gray-400">No games yet. Start one above!</p>
      ) : (
        <ul className="space-y-3">
          {games.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="rounded-lg bg-gray-700 px-4 py-2 hover:bg-gray-600 disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </section>
  );
};

export default GameHistory;

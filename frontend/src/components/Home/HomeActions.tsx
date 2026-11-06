import { Link } from "react-router";

type HomeActionsProps = {
  canInviteFriend: boolean;
};

const cardClass =
  "flex flex-col items-start gap-1 rounded-2xl border-2 border-white/20 bg-black p-6 text-left shadow-lg transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-black";

const HomeActions = ({ canInviteFriend }: HomeActionsProps) => {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <button
        type="button"
        disabled={!canInviteFriend}
        title={canInviteFriend ? undefined : "Log in and choose a username to invite friends"}
        className={cardClass}
      >
        <span className="text-lg font-semibold">Play with friend</span>
        <span className="text-sm text-cream">Invite a logged-in player</span>
      </button>

      <button type="button" className={cardClass}>
        <span className="text-lg font-semibold">Play with bot</span>
        <span className="text-sm text-cream">Practice against the computer</span>
      </button>

      <Link to="/game" className={cardClass}>
        <span className="text-lg font-semibold">Play alone</span>
        <span className="text-sm text-cream">Play both sides on one board</span>
      </Link>
    </section>
  );
};

export default HomeActions;

import { useState } from "react";
import Header from "../components/Sheared/Header";
import Settings from "../components/Sheared/Settings";
import Profile from "../components/Home/Profile";
import HomeActions from "../components/Home/HomeActions";
import GameHistory from "../components/Home/GameHistory";
import { useAccount } from "../lib/account";
import { useGames } from "../lib/history";
import InviteBox from "../components/Home/inviteBox";
import InviteForm from "../components/Home/inviteForm";
import BotChoicer from "../components/Home/botChoicer";
import PlayAloneForm from "../components/Home/PlayAloneForm";
import ActionModal from "../components/Home/ActionModal";

const HISTORY_PAGE_SIZE = 10;

type OpenAction = "friend" | "bot" | "alone" | null;

const Home = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openAction, setOpenAction] = useState<OpenAction>(null);
  const { account, loading } = useAccount();
  const history = useGames(HISTORY_PAGE_SIZE);
  const canInviteFriend = Boolean(account?.username);

  return (
    <div className="min-h-screen bg-gray text-white">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      <main className="mx-auto max-w-3xl space-y-10 px-6 pb-12 pt-28">
        <section className="flex flex-col md:flex-row gap-4">
          {loading ? (
            <p className="text-cream">Loading...</p>
          ) : account ? (
            <Profile username={account.username} email={account.email} />
          ) : (
            <p className="text-cream">Playing as guest. Log in to save games and invite friends.</p>
          )}

          {canInviteFriend && <InviteBox />}
        </section>

        <HomeActions
          canInviteFriend={canInviteFriend}
          onFriendClick={() => setOpenAction("friend")}
          onBotClick={() => setOpenAction("bot")}
          onAloneClick={() => setOpenAction("alone")}
        />

        {!loading && account && !canInviteFriend && (
          <p className="text-sm text-cream">Choose a username in Settings to invite friends.</p>
        )}

        {!loading && account && (
          <GameHistory
            games={history.games}
            loading={history.loading}
            loadingMore={history.loadingMore}
            error={history.error}
            hasMore={history.hasMore}
            onLoadMore={history.loadMore}
          />
        )}
      </main>

      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}

      {openAction === "friend" && (
        <ActionModal title="Play with friend" onClose={() => setOpenAction(null)}>
          <InviteForm onClose={() => setOpenAction(null)} />
        </ActionModal>
      )}

      {openAction === "bot" && (
        <ActionModal title="Play with bot" onClose={() => setOpenAction(null)}>
          <BotChoicer />
        </ActionModal>
      )}

      {openAction === "alone" && (
        <ActionModal title="Play alone" onClose={() => setOpenAction(null)}>
          <PlayAloneForm />
        </ActionModal>
      )}
    </div>
  );
};

export default Home;

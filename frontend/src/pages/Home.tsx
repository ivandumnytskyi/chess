import { useState } from "react";
import Header from "../components/Sheared/Header";
import Settings from "../components/Sheared/Settings";
import Profile from "../components/Home/Profile";
import HomeActions from "../components/Home/HomeActions";
import GameHistory from "../components/Home/GameHistory";
import { useAccount } from "../lib/account";
import { useGames } from "../lib/history";

const HISTORY_PAGE_SIZE = 10;

const Home = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { account, loading } = useAccount();
  const history = useGames(HISTORY_PAGE_SIZE);
  const canInviteFriend = Boolean(account?.username);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      <main className="mx-auto max-w-3xl space-y-10 px-6 pb-12 pt-28">
        <section>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : account ? (
            <Profile username={account.username} email={account.email} />
          ) : (
            <p className="text-gray-400">Playing as guest. Log in to save games and invite friends.</p>
          )}
        </section>

        <HomeActions canInviteFriend={canInviteFriend} />

        {!loading && account && !canInviteFriend && (
          <p className="text-sm text-gray-400">Choose a username in Settings to invite friends.</p>
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
    </div>
  );
};

export default Home;

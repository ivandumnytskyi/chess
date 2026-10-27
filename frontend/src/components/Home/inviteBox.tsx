import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useInvites } from "../../lib/invite";

const playLinkClass = "bg-indigo-500 text-white px-4 py-2 rounded";

const InviteBox = () => {
  const navigate = useNavigate();
  const {loading, refresh, accept, decline, incoming, outgoing} = useInvites()
  const [error, setError] = useState<string | null>(null);
  // Accepted outgoing invites that were already there when the page opened. Only invites accepted later move the sender into the game.
  const acceptedBeforeOpen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (loading) return;
    const accepted = outgoing.filter((invite) => invite.status === "accepted" && invite.gameId);
    if (acceptedBeforeOpen.current === null) {
      acceptedBeforeOpen.current = new Set(accepted.map((invite) => invite.id));
      return;
    }
    const justAccepted = accepted.find((invite) => !acceptedBeforeOpen.current?.has(invite.id));
    if (justAccepted?.gameId) navigate(`/game/${justAccepted.gameId}`);
  }, [outgoing, loading, navigate]);

  // The accepting player goes straight to the game the invite created.
  const handleAccept = async (inviteId: string) => {
    try {
      const game = await accept(inviteId);
      navigate(`/game/${game.gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      await decline(inviteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline invite");
    }
  };

  return (
    <>
    {loading ? (
      <p>Loading...</p>
    ) : (
      <>
        <button onClick={() => refresh()} className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer">Refresh Invites</button>
        {error && <p className="text-red-500">{error}</p>}
        <div>
         { incoming.length === 0 && outgoing.length === 0 ? (
           <p>No invites</p>
         ) : null}
         {incoming.map((invite) => (
           <div key={invite.id} className="border p-4 mb-4 flex gap-2">
             <p>From: {invite.from}</p>
             <p>Time Control: {invite.timeControlId}</p>
             <p>Color: {invite.color}</p>
             {invite.status === "accepted" && invite.gameId ? (
               <Link to={`/game/${invite.gameId}`} className={playLinkClass}>Play</Link>
             ) : (
               <>
                 <button onClick={() => handleAccept(invite.id)} className="bg-green-500 text-white px-4 py-2 rounded cursor-pointer">Accept</button>
                 <button onClick={() => handleDecline(invite.id)} className="bg-red-500 text-white px-4 py-2 rounded cursor-pointer">Decline</button>
               </>
             )}
           </div>
         ))}
         {outgoing.map((invite) => (
           <div key={invite.id} className="border p-4 mb-4 flex gap-2">
             <p>To: {invite.to}</p>
             <p>Time Control: {invite.timeControlId}</p>
             {invite.status === "accepted" && invite.gameId ? (
               <Link to={`/game/${invite.gameId}`} className={playLinkClass}>Play</Link>
             ) : (
               <p>Waiting for response...</p>
             )}
           </div>
         ))}
        </div>
      </>
    )}
    </>
    
  );
};

export default InviteBox;
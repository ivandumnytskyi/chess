import { useCallback, useEffect, useState } from "react";
import { API_URL, authorizedFetch } from "./authorization";
import type { TimeControlId } from "../constants/timeControls";

export type InviteColor = "white" | "black" | "random";

export type Invite = {
  id: string;
  from: string | null;
  to: string | null;
  timeControlId: string;
  // The color the sender asked for, so the recipient sees it before accepting.
  color: InviteColor;
  // "accepted" invites stay listed while their game is running and carry the game id.
  status: "pending" | "accepted";
  gameId: string | null;
  createdAt: string;
  expiresAt: string;
};

export type InviteLists = {
  incoming: Invite[];
  outgoing: Invite[];
};

export type SendInviteInput = {
  username: string;
  timeControl?: TimeControlId;
  color?: InviteColor;
};

export type AcceptedInvite = {
  gameId: string;
  // The accepting player's own color.
  color: "white" | "black";
  timeControl: string;
};

async function readError(res: Response, fallback: string): Promise<Error> {
  const data: { error?: string } = await res.json().catch(() => ({}));
  return new Error(data.error ?? fallback);
}

async function postInvite(path: string, body?: unknown): Promise<Response> {
  return authorizedFetch(`${API_URL}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function getInvites(): Promise<InviteLists> {
  const res = await authorizedFetch(`${API_URL}/invites`);
  if (!res.ok) throw await readError(res, "Could not load invites");
  return res.json();
}

export async function sendInvite(input: SendInviteInput): Promise<Invite> {
  const res = await postInvite("/invites", input);
  if (!res.ok) throw await readError(res, "Could not send invite");

  const data: { invite: Invite } = await res.json();
  return data.invite;
}

export async function acceptInvite(inviteId: string): Promise<AcceptedInvite> {
  const res = await postInvite(`/invites/${inviteId}/accept`);
  if (!res.ok) throw await readError(res, "Could not accept invite");
  return res.json();
}

export async function declineInvite(inviteId: string): Promise<void> {
  const res = await postInvite(`/invites/${inviteId}/decline`);
  if (!res.ok) throw await readError(res, "Could not decline invite");
}

export async function cancelInvite(inviteId: string): Promise<void> {
  const res = await postInvite(`/invites/${inviteId}/cancel`);
  if (!res.ok) throw await readError(res, "Could not cancel invite");
}

const DEFAULT_POLL_MS = 5_000;

// Keeps the invite lists fresh by polling while the tab is visible. The actions rethrow API errors so
// the caller can show them next to the form or button, and reload the lists once they succeed.
export function useInvites(pollMs = DEFAULT_POLL_MS) {
  const [invites, setInvites] = useState<InviteLists>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      getInvites()
        .then((data) => {
          if (!active) return;
          setInvites(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "Could not load invites");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, pollMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pollMs, reloads]);

  const refresh = useCallback(() => setReloads((count) => count + 1), []);

  const send = useCallback(
    async (input: SendInviteInput) => {
      const invite = await sendInvite(input);
      refresh();
      return invite;
    },
    [refresh],
  );

  const accept = useCallback(
    async (inviteId: string) => {
      const accepted = await acceptInvite(inviteId);
      refresh();
      return accepted;
    },
    [refresh],
  );

  const decline = useCallback(
    async (inviteId: string) => {
      await declineInvite(inviteId);
      refresh();
    },
    [refresh],
  );

  const cancel = useCallback(
    async (inviteId: string) => {
      await cancelInvite(inviteId);
      refresh();
    },
    [refresh],
  );

  return { ...invites, loading, error, refresh, send, accept, decline, cancel };
}

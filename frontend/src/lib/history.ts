import { useCallback, useEffect, useState } from "react";
import { API_URL, authorizedFetch } from "./authorization";

export type GameOutcome = "win" | "loss" | "draw";

export type GameSummary = {
  id: string;
  color: "white" | "black";
  opponentUsername: string | null;
  timeControlId: string;
  status: string;
  result: string | null;
  endReason: string | null;
  outcome: GameOutcome | null;
  createdAt: string;
  finishedAt: string | null;
};

export type GamesPage = {
  games: GameSummary[];
  nextCursor: string | null;
};

export async function getGames(cursor?: string, limit = 20): Promise<GamesPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await authorizedFetch(`${API_URL}/games?${params.toString()}`);
  if (!res.ok) throw new Error("Could not load game history");

  return res.json();
}

export function useGames(limit = 20) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getGames(undefined, limit)
      .then((page) => {
        if (!active) return;
        setGames(page.games);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load game history");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getGames(nextCursor, limit);
      setGames((current) => [...current, ...page.games]);
      setNextCursor(page.nextCursor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load game history");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, limit]);

  return { games, loading, loadingMore, error, hasMore: nextCursor !== null, loadMore };
}

import { supabase } from './supabase';
import type { Database } from './database.types';

type GameRow = Database['public']['Tables']['Game']['Row'];
type MoveRow = Database['public']['Tables']['Move']['Row'];

import { API_URL, authorizedFetch } from './authorization';

let authReady: Promise<void> | null = null;

// Gives the Realtime socket the user's token so the row policies apply to this user.
export const authorizeRealtime = () => {
  if (!authReady) {
    authReady = authorizedFetch(`${API_URL}/auth/realtime-token`)
      .then((res) => (res.ok ? (res.json() as Promise<{ accessToken: string }>) : Promise.reject(new Error('Not signed in'))))
      .then(({ accessToken }) => supabase.realtime.setAuth(accessToken))
      .catch((err: unknown) => {
        authReady = null;
        throw err;
      });
  }
  return authReady;
};

export const subscribeToGame = async (
  gameId: string,
  handlers: { onGame: (row: GameRow) => void; onMove: (row: MoveRow) => void; onSubscribed?: () => void },
) => {
  await authorizeRealtime();
  const channel = supabase
    .channel(`game:${gameId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'Game' },
      (payload) => {
        const row = payload.new as MoveRow;
        if (!row.gameId || row.gameId === gameId) handlers.onMove(row);
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'Move' },
      (payload) => {
        const row = payload.new as MoveRow;
        if (row.gameId === gameId) handlers.onMove(row);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') handlers.onSubscribed?.();
    });

  return () => {
    supabase.removeChannel(channel);
  };
};
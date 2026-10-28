import { supabase } from './supabase';
import type { Database } from './database.types';

type GameRow = Database['public']['Tables']['Game']['Row'];
type MoveRow = Database['public']['Tables']['Move']['Row'];

export const subscribeToGame = (
  gameId: string,
  handlers: { onGame: (row: GameRow) => void; onMove: (row: MoveRow) => void },
) => {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'Game', filter: `id=eq.${gameId}` },
      (payload) => handlers.onGame(payload.new as GameRow),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'Move', filter: `gameId=eq.${gameId}` },
      (payload) => handlers.onMove(payload.new as MoveRow),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
import { supabase } from './supabase';
import type { Database } from './database.types';
import type { MoveData, Position, PromotionPiece } from '../types';

type GameRow = Database['public']['Tables']['Game']['Row'];
type MoveRow = Database['public']['Tables']['Move']['Row'];
type GameMoveEvent = { ply: number; move: MoveData };

import { API_URL, authorizedFetch } from './authorization';

let authReady: Promise<void> | null = null;
const isPosition = (value: unknown): value is Position =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as Position).row) &&
  Number.isInteger((value as Position).col) &&
  (value as Position).row >= 0 &&
  (value as Position).row < 8 &&
  (value as Position).col >= 0 &&
  (value as Position).col < 8;

const isPromotionPiece = (value: unknown): value is PromotionPiece =>
  value === 'queen' || value === 'rook' || value === 'bishop' || value === 'knight';

const parseMoveEvent = (ply: unknown, move: unknown): GameMoveEvent | null => {
  if (
    typeof ply !== 'number' ||
    !Number.isInteger(ply) ||
    ply < 1 ||
    typeof move !== 'object' ||
    move === null
  ) {
    return null;
  }
  const candidate = move as Partial<MoveData>;
  if (
    !isPosition(candidate.from) ||
    !isPosition(candidate.to) ||
    (candidate.promotion !== undefined && !isPromotionPiece(candidate.promotion))
  ) {
    return null;
  }
  return {
    ply,
    move: {
      from: candidate.from,
      to: candidate.to,
      ...(candidate.promotion ? { promotion: candidate.promotion } : {}),
    },
  };
};

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
  handlers: { onGame: (row: GameRow) => void; onMove: (event: GameMoveEvent) => void; onSubscribed?: () => void },
) => {
  await authorizeRealtime();
  const channel = supabase
    .channel(`game:${gameId}`, { config: { private: true } })
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      if (typeof payload !== 'object' || payload === null) return;
      const event = parseMoveEvent(payload.ply, payload.move);
      if (event) handlers.onMove(event);
    })
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'Game', filter: `id=eq.${gameId}` },
      (payload) => {
        handlers.onGame(payload.new as GameRow);
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'Move', filter: `gameId=eq.${gameId}` },
      (payload) => {
        const row = payload.new as MoveRow;
        const event = parseMoveEvent(row.ply, row.move);
        if (event) handlers.onMove(event);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        handlers.onSubscribed?.();
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};
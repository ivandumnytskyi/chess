import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";
import type { MoveData } from "../src/types/chess";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in backend/.env");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const broadcastGameMove = async (
  accessToken: string,
  gameId: string,
  ply: number,
  move: MoveData,
): Promise<void> => {
  const startedAt = performance.now();
  const realtime = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const channel = realtime.channel(`game:${gameId}`, {
    config: { private: true },
  });

  let phase = "set_auth";
  let setAuthMs = 0;
  let subscribeMs = 0;
  let sendMs = 0;
  try {
    let phaseStartedAt = performance.now();
    await realtime.realtime.setAuth(accessToken);
    setAuthMs = performance.now() - phaseStartedAt;

    phase = "subscribe";
    phaseStartedAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          reject(error ?? new Error(`Realtime channel ${status.toLowerCase()}`));
        }
      });
    });
    subscribeMs = performance.now() - phaseStartedAt;

    phase = "send";
    phaseStartedAt = performance.now();
    const status = await channel.send({
      type: "broadcast",
      event: "move",
      payload: { ply, move },
    });
    if (status !== "ok") {
      throw new Error(`Realtime move broadcast failed: ${status}`);
    }
    sendMs = performance.now() - phaseStartedAt;
    console.info(JSON.stringify({
      event: "game_move_broadcast_timing",
      gameId,
      ply,
      setAuthMs: Math.round(setAuthMs),
      subscribeMs: Math.round(subscribeMs),
      sendMs: Math.round(sendMs),
      totalMs: Math.round(performance.now() - startedAt),
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "game_move_broadcast_failed",
      gameId,
      ply,
      phase,
      totalMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  } finally {
    await realtime.removeChannel(channel);
  }
};
import { createClient } from "@supabase/supabase-js";
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
  const realtime = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const channel = realtime.channel(`game:${gameId}`, {
    config: { private: true },
  });

  let phase = "set_auth";
  try {
    await realtime.realtime.setAuth(accessToken);

    phase = "subscribe";
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

    phase = "send";
    const status = await channel.send({
      type: "broadcast",
      event: "move",
      payload: { ply, move },
    });
    if (status !== "ok") {
      throw new Error(`Realtime move broadcast failed: ${status}`);
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "game_move_broadcast_failed",
      gameId,
      ply,
      phase,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  } finally {
    await realtime.removeChannel(channel);
    // Each broadcast uses its own client, so close its socket or it stays open after every move.
    realtime.realtime.disconnect();
  }
};
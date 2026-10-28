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
  await realtime.realtime.setAuth(accessToken);

  const channel = realtime.channel(`game:${gameId}`, {
    config: { private: true },
  });

  try {
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

    const status = await channel.send({
      type: "broadcast",
      event: "move",
      payload: { ply, move },
    });
    if (status !== "ok") {
      throw new Error(`Realtime move broadcast failed: ${status}`);
    }
  } finally {
    await realtime.removeChannel(channel);
  }
};
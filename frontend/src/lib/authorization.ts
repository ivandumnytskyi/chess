import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function redirectToLogin(): void {
  window.location.href = "/login";
}

// Sends the signed-in user's access token. Redirects to /login when there is no valid session.
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    redirectToLogin();
    throw new Error("Not signed in");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Session expired");
  }
  return res;
}

// Returns null while the session is still being restored, otherwise whether a user is signed in.
export function useIsAuthenticated(): boolean | null {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  return session !== null;
}

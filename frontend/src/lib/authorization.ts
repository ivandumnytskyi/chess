import { useEffect, useState } from "react";

export const API_URL = "/api";;

const AUTH_CHANGED_EVENT = "auth-changed";

// Tells mounted components (such as the header) that the session changed.
export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

// Sends the HttpOnly session cookies. Redirects to /login when the session is missing or expired.
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: "include" });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return res;
}

async function checkAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth`, { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

// Returns null while the session is still being checked, otherwise whether a user is signed in.
export function useIsAuthenticated(): boolean | null {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const result = await checkAuthenticated();
      if (active) setIsAuthenticated(result);
    };

    check();
    window.addEventListener(AUTH_CHANGED_EVENT, check);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, check);
    };
  }, []);

  return isAuthenticated;
}

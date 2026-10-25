import { useEffect, useState } from "react";
import { API_URL, notifyAuthChanged } from "../lib/authorization";

// Receives the Google OAuth tokens from the URL hash, hands them to the backend, then leaves the URL.
const AuthCallback = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in")) || undefined;

    const exchange = async () => {
      if (!accessToken || !refreshToken) {
        setError("Sign in failed");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
        });
        if (!res.ok) {
          setError("Sign in failed");
          return;
        }
        notifyAuthChanged();
        window.location.replace("/");
      } catch {
        setError("Could not reach the server");
      }
    };

    exchange();
  }, []);

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      {error ? <p className="text-red-600">{error}</p> : <p>Signing you in…</p>}
    </div>
  );
};

export default AuthCallback;

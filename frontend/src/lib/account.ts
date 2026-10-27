import { useEffect, useState } from "react";
import { API_URL, authorizedFetch } from "./authorization";
import { getUsername } from "./profile";

export type Account = {
  id: string;
  email: string | null;
  username: string | null;
};

export async function getAccount(): Promise<Account> {
  const [authRes, username] = await Promise.all([authorizedFetch(`${API_URL}/auth`), getUsername()]);
  if (!authRes.ok) throw new Error("Could not load account");

  const data: { id: string; email?: string } = await authRes.json();
  return { id: data.id, email: data.email ?? null, username };
}

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAccount()
      .then((data) => {
        if (active) setAccount(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load account");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { account, loading, error };
}

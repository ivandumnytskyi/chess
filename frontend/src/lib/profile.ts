import { API_URL, authorizedFetch } from "./authorization";

export async function getUsername(): Promise<string | null> {
  const res = await authorizedFetch(`${API_URL}/profile`);
  if (!res.ok) throw new Error("Could not load username");

  const data: { username: string | null } = await res.json();
  return data.username;
}

export async function changeUsername(username: string): Promise<string> {
  const res = await authorizedFetch(`${API_URL}/profile/username`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  const data: { username?: string; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !data.username) throw new Error(data.error ?? "Could not change username");
  return data.username;
}

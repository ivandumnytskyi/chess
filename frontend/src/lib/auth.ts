import { supabase } from "./supabase";
import { API_URL, notifyAuthChanged } from "./authorization";

async function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readError(res: Response, fallback: string): Promise<Error> {
  const data: { error?: string } = await res.json().catch(() => ({}));
  return new Error(data.error ?? fallback);
}

export async function signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }> {
  const res = await postJson("/auth/signup", { email, password });
  if (res.status === 202) return { confirmationRequired: true };
  if (!res.ok) throw await readError(res, "Sign up failed");

  notifyAuthChanged();
  return { confirmationRequired: false };
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await postJson("/auth/login", { email, password });
  if (!res.ok) throw await readError(res, "Sign in failed");

  notifyAuthChanged();
}

export async function signOut(): Promise<void> {
  await postJson("/auth/logout");
  notifyAuthChanged();
}
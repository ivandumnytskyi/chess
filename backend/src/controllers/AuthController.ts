import type { Request, Response } from "express";
import { supabase } from "../../lib/supabase";
import { prisma } from "../../lib/prisma";
import { clearSessionCookies, setSessionCookies } from "../../lib/sessionCookies";
import { normalizeUsername } from "../../lib/username";

const readCredentials = (body: unknown): { email: string; password: string } | null => {
  if (typeof body !== "object" || body === null) return null;
  const { email, password } = body as Record<string, unknown>;
  return typeof email === "string" && typeof password === "string" ? { email, password } : null;
};

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = readCredentials(req.body);
  if (!credentials) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.session || !data.user) {
    res.status(401).json({ error: error?.message ?? "Sign in failed" });
    return;
  }

  setSessionCookies(res, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  });
  res.json({ id: data.user.id, email: data.user.email });
}

export async function signup(req: Request, res: Response): Promise<void> {
  const credentials = readCredentials(req.body);
  if (!credentials) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const username = normalizeUsername((req.body as Record<string, unknown>).username);
  if (!username) {
    res.status(400).json({ error: "Username must be 3-20 letters, numbers or underscores" });
    return;
  }

  const taken = await prisma.profile.findUnique({ where: { username }, select: { id: true } });
  if (taken) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  // The profile is created on the first authenticated request, so the name is kept in user metadata until then.
  const { data, error } = await supabase.auth.signUp({ ...credentials, options: { data: { username } } });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // With email confirmation enabled, Supabase returns no session until the address is confirmed.
  if (!data.session || !data.user) {
    res.status(202).json({ confirmationRequired: true });
    return;
  }

  setSessionCookies(res, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  });
  res.status(201).json({ id: data.user.id, email: data.user.email });
}

export function logout(_req: Request, res: Response): void {
  clearSessionCookies(res);
  res.status(204).end();
}

// Accepts the tokens returned by Google OAuth (implicit flow) and stores them in HttpOnly cookies.
export async function exchangeSession(req: Request, res: Response): Promise<void> {
  const { accessToken, refreshToken, expiresIn } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    res.status(400).json({ error: "accessToken and refreshToken are required" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  setSessionCookies(res, {
    accessToken,
    refreshToken,
    expiresIn: typeof expiresIn === "number" ? expiresIn : undefined,
  });
  res.json({ id: data.user.id, email: data.user.email });
}

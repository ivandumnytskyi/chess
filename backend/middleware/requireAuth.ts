import type { Request, Response, NextFunction } from "express";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from "../lib/sessionCookies";

// Profiles are never deleted, so once one exists for a user it is skipped on later requests.
const knownProfiles = new Set<string>();

// A verified access token skips the Supabase call for this long. Revoked tokens stay valid until then.
const VERIFIED_TTL_MS = 30_000;
const verifiedUsers = new Map<string, { user: User; expiresAt: number }>();

const rememberVerifiedUser = (accessToken: string, user: User) => {
  const now = Date.now();
  for (const [token, entry] of verifiedUsers) {
    if (entry.expiresAt <= now) verifiedUsers.delete(token);
  }
  verifiedUsers.set(accessToken, { user, expiresAt: now + VERIFIED_TTL_MS });
};

// Reads the session from HttpOnly cookies. Refreshes the access token when it has expired.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const accessToken: unknown = req.cookies?.[ACCESS_COOKIE];
  const refreshToken: unknown = req.cookies?.[REFRESH_COOKIE];

  if (typeof accessToken !== "string" && typeof refreshToken !== "string") {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let user: User | null = null;

  if (typeof accessToken === "string") {
    const cached = verifiedUsers.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) {
      user = cached.user;
    } else {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!error && data.user) {
        user = data.user;
        rememberVerifiedUser(accessToken, data.user);
      }
    }
  }

  if (!user && typeof refreshToken === "string") {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.session && data.user) {
      setSessionCookies(res, {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      });
      user = data.user;
    }
  }

  if (!user) {
    clearSessionCookies(res);
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  if (!knownProfiles.has(user.id)) {
    try {
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: { id: user.id },
      });
    } catch {
      res.status(500).json({ error: "Could not load account" });
      return;
    }
    knownProfiles.add(user.id);
  }

  res.locals.user = user;

  next();
}
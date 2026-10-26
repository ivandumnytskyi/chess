import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from "../lib/sessionCookies";

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

  let user = null;

  if (typeof accessToken === "string") {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) user = data.user;
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

  res.locals.user = user;

  next();
}
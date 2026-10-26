import type { Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation, normalizeUsername } from "../../lib/username";

export async function getProfile(_req: Request, res: Response): Promise<void> {
  const user: User = res.locals.user;

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { username: true } });
  res.json({ username: profile?.username ?? null });
}

export async function changeUsername(req: Request, res: Response): Promise<void> {
  const user: User = res.locals.user;
  const username = normalizeUsername((req.body as Record<string, unknown> | undefined)?.username);
  if (!username) {
    res.status(400).json({ error: "Username must be 3-20 letters, numbers or underscores" });
    return;
  }

  try {
    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: { username },
      select: { username: true },
    });
    res.json({ username: profile.username });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    res.status(409).json({ error: "Username is already taken" });
  }
}

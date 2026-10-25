import type { Response, CookieOptions } from "express";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const REFRESH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

export function setSessionCookies(res: Response, { accessToken, refreshToken, expiresIn }: SessionTokens): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions, maxAge: (expiresIn ?? 3600) * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions, maxAge: REFRESH_MAX_AGE_MS });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions);
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set(["admin", "bot", "stockfish", "support", "system"]);

// Usernames are stored lowercase, so uniqueness does not depend on letter case.
export function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const username = input.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username) || RESERVED_USERNAMES.has(username)) return null;
  return username;
}

// Prisma reports unique constraint failures with code P2002.
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

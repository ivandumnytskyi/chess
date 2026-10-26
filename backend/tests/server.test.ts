import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import router from "../src/routs/route";

const {
  mockGetUser,
  mockRefreshSession,
  mockSignIn,
  mockSignUp,
  mockProfileUpsert,
  mockGameCreate,
  mockGameFindFirst,
  mockGameUpdate,
  mockMoveCreate,
  mockTransaction,
  fakeGames,
} = vi.hoisted(() => {
  // In-memory stand-in for the games table, so the controller runs against real logic.
  type FakeMove = { gameId: string; ply: number; color: string; move: unknown; playedAt: Date };
  type FakeGame = Record<string, unknown> & { id: string; moves: FakeMove[] };
  const fakeGames = new Map<string, FakeGame>();

  const mockGameCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row: FakeGame = {
      id: crypto.randomUUID(),
      whitePlayerId: null,
      blackPlayerId: null,
      status: "active",
      result: null,
      endReason: null,
      currentTurn: "white",
      createdAt: new Date(),
      finishedAt: null,
      lastMoveAt: null,
      moves: [],
      ...data,
    };
    fakeGames.set(row.id, row);
    return row;
  });
  const mockGameFindFirst = vi.fn(async ({ where }: { where: { id: string; OR: Record<string, unknown>[] } }) => {
    const row = fakeGames.get(where.id);
    if (!row || !where.OR.some((clause) => Object.entries(clause).every(([key, value]) => row[key] === value))) {
      return null;
    }
    return { ...row, moves: [...row.moves].sort((a, b) => a.ply - b.ply) };
  });
  const mockGameUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const row = fakeGames.get(where.id);
    if (!row) throw new Error("Record not found");
    Object.assign(row, data);
    return row;
  });
  const mockMoveCreate = vi.fn(async ({ data }: { data: Omit<FakeMove, "playedAt"> }) => {
    const row = fakeGames.get(data.gameId);
    if (!row) throw new Error("Record not found");
    const move = { ...data, playedAt: new Date() };
    row.moves.push(move);
    return move;
  });
  const mockTransaction = vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations));

  return {
    mockGetUser: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockSignIn: vi.fn(),
    mockSignUp: vi.fn(),
    mockProfileUpsert: vi.fn(),
    mockGameCreate,
    mockGameFindFirst,
    mockGameUpdate,
    mockMoveCreate,
    mockTransaction,
    fakeGames,
  };
});
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      refreshSession: mockRefreshSession,
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
    },
  },
}));
vi.mock("../lib/prisma", () => ({
  prisma: {
    profile: { upsert: mockProfileUpsert },
    game: { create: mockGameCreate, findFirst: mockGameFindFirst, update: mockGameUpdate },
    move: { create: mockMoveCreate },
    $transaction: mockTransaction,
  },
}));

const USERS: Record<string, { id: string; email: string }> = {
  "token-a": { id: "user-a", email: "a@example.com" },
  "token-b": { id: "user-b", email: "b@example.com" },
  "token-c": { id: "user-c", email: "c@example.com" },
  "token-d": { id: "user-d", email: "d@example.com" },
  "token-cache-reuse": { id: "user-cache-reuse", email: "reuse@example.com" },
  "token-cache-expiry": { id: "user-cache-expiry", email: "expiry@example.com" },
};

beforeEach(() => {
  mockGetUser.mockImplementation(async (token: string) => {
    const user = USERS[token];
    return user
      ? { data: { user }, error: null }
      : { data: { user: null }, error: { message: "invalid token" } };
  });
  mockRefreshSession.mockResolvedValue({ data: { user: null, session: null }, error: { message: "invalid refresh token" } });
  mockProfileUpsert.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
  fakeGames.clear();
});

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api", router);

interface TestResponse {
  status: number;
  headers: Record<string, unknown>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

// Dispatches through the Express app in-memory, so no network socket is needed.
function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = path;
    req.headers = payload
      ? { ...headers, "content-type": "application/json", "content-length": String(Buffer.byteLength(payload)) }
      : { ...headers };
    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    res.write = ((chunk: string | Buffer) => {
      chunks.push(Buffer.from(chunk));
      return true;
    }) as typeof res.write;
    res.end = ((chunk?: string | Buffer) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString();
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        text: async () => text,
        json: async () => JSON.parse(text) as unknown,
      });
      return res;
    }) as typeof res.end;
    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
    if (payload) req.push(payload);
    req.push(null);
  });
}

const baseUrl = "/api";
const sessionCookie = (token: string) => ({ cookie: `access_token=${token}` });

const fetch = (
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<TestResponse> =>
  request(
    init?.method ?? "GET",
    url,
    init?.body === undefined ? undefined : JSON.parse(init.body),
    init?.headers ?? sessionCookie("token-a"),
  );

interface GameResponse {
  gameId: string;
  boardState: unknown;
  currentTurn: string;
}

async function createGame(token = "token-a"): Promise<GameResponse> {
  const res = await fetch(`${baseUrl}/game`, { method: "POST", headers: sessionCookie(token) });
  return (await res.json()) as GameResponse;
}

function postMove(body: unknown, token = "token-a"): Promise<TestResponse> {
  return fetch(`${baseUrl}/game/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionCookie(token) },
    body: JSON.stringify(body),
  });
}

const e2e4 = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } };

describe("GET /api/health", () => {
  it("returns OK", async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});

describe("POST /api/game", () => {
  it("creates a game with white to move", async () => {
    const res = await fetch(`${baseUrl}/game`, { method: "POST" });
    const body = (await res.json()) as GameResponse;

    expect(res.status).toBe(200);
    expect(body.gameId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.currentTurn).toBe("white");
    expect(body.boardState).toBeDefined();
  });

  it("creates distinct games", async () => {
    const a = await createGame();
    const b = await createGame();

    expect(a.gameId).not.toBe(b.gameId);
  });
});

describe("POST /api/game/move", () => {
  it("applies a legal move and switches turn", async () => {
    const { gameId } = await createGame();

    const res = await postMove({ gameId, moveData: e2e4, color: "white" });
    const body = (await res.json()) as { currentTurn: string };

    expect(res.status).toBe(200);
    expect(body.currentTurn).toBe("black");
  });

  it("returns the new status and legal moves for the side to move", async () => {
    const { gameId } = await createGame();

    const res = await postMove({ gameId, moveData: e2e4, color: "white" });
    const body = (await res.json()) as { status: string; legalMoves: { from: unknown; moves: unknown[] }[] };

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.legalMoves.length).toBeGreaterThan(0);
    expect(body.legalMoves.every((entry) => entry.moves.length > 0)).toBe(true);
  });

  it("rejects a move made out of turn", async () => {
    const { gameId } = await createGame();

    const res = await postMove({ gameId, moveData: e2e4, color: "black" });

    expect(res.status).toBe(400);
  });

  it("rejects an illegal move", async () => {
    const { gameId } = await createGame();
    const illegal = { from: { row: 6, col: 4 }, to: { row: 3, col: 4 } };

    const res = await postMove({ gameId, moveData: illegal, color: "white" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown game", async () => {
    const res = await postMove({ gameId: "missing", moveData: e2e4, color: "white" });

    expect(res.status).toBe(404);
  });

  it.each([
    ["missing gameId", { moveData: e2e4, color: "white" }],
    ["invalid color", { gameId: "x", moveData: e2e4, color: "red" }],
    ["missing moveData", { gameId: "x", color: "white" }],
    ["out-of-range square", { gameId: "x", color: "white", moveData: { from: { row: 8, col: 0 }, to: { row: 0, col: 0 } } }],
    ["non-integer square", { gameId: "x", color: "white", moveData: { from: { row: 1.5, col: 0 }, to: { row: 0, col: 0 } } }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await postMove(body);

    expect(res.status).toBe(400);
  });
});

type MoveResponse = { currentTurn: string; boardState: { squares: ({ pieceType: string; color: string } | null)[][] } };

const sq = (row: number, col: number) => ({ row, col });

// White's a-pawn walks to a6, takes on b7, and then takes the rook on a8 to promote.
const PATH_TO_PROMOTION = [
  { color: "white", from: sq(6, 0), to: sq(4, 0) },
  { color: "black", from: sq(1, 7), to: sq(3, 7) },
  { color: "white", from: sq(4, 0), to: sq(3, 0) },
  { color: "black", from: sq(3, 7), to: sq(4, 7) },
  { color: "white", from: sq(3, 0), to: sq(2, 0) },
  { color: "black", from: sq(4, 7), to: sq(5, 7) },
  { color: "white", from: sq(2, 0), to: sq(1, 1) },
  { color: "black", from: sq(1, 6), to: sq(3, 6) },
] as const;

const promotionMove = { from: sq(1, 1), to: sq(0, 0) };

async function gameReadyForPromotion(): Promise<string> {
  const { gameId } = await createGame();
  for (const step of PATH_TO_PROMOTION) {
    const res = await postMove({ gameId, moveData: { from: step.from, to: step.to }, color: step.color });
    expect(res.status).toBe(200);
  }
  return gameId;
}

describe("pawn promotion", () => {
  it.each(["queen", "rook", "bishop", "knight"])("promotes to a %s when chosen", async (promotion) => {
    const gameId = await gameReadyForPromotion();

    const res = await postMove({ gameId, moveData: { ...promotionMove, promotion }, color: "white" });
    const body = (await res.json()) as MoveResponse;

    expect(res.status).toBe(200);
    expect(body.boardState.squares[0][0]).toMatchObject({ pieceType: promotion, color: "white" });
  });

  it("stores the chosen piece with the move", async () => {
    const gameId = await gameReadyForPromotion();

    await postMove({ gameId, moveData: { ...promotionMove, promotion: "queen" }, color: "white" });

    expect(fakeGames.get(gameId)?.moves.at(-1)?.move).toEqual({ ...promotionMove, promotion: "queen" });
  });

  it("replays the promotion when the game is loaded again", async () => {
    const gameId = await gameReadyForPromotion();
    await postMove({ gameId, moveData: { ...promotionMove, promotion: "knight" }, color: "white" });

    const res = await postMove({ gameId, moveData: { from: sq(3, 6), to: sq(4, 6) }, color: "black" });
    const body = (await res.json()) as MoveResponse;

    expect(res.status).toBe(200);
    expect(body.boardState.squares[0][0]).toMatchObject({ pieceType: "knight", color: "white" });
  });

  it("rejects a promoting move without a piece", async () => {
    const gameId = await gameReadyForPromotion();

    const res = await postMove({ gameId, moveData: promotionMove, color: "white" });

    expect(res.status).toBe(400);
  });

  it("rejects a piece on a move that does not promote", async () => {
    const { gameId } = await createGame();

    const res = await postMove({ gameId, moveData: { ...e2e4, promotion: "queen" }, color: "white" });

    expect(res.status).toBe(400);
  });

  it("rejects a promotion piece that is not a valid choice", async () => {
    const gameId = await gameReadyForPromotion();

    const res = await postMove({ gameId, moveData: { ...promotionMove, promotion: "king" }, color: "white" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/game/all-legal-moves", () => {
  it("returns moves for every white piece that can move at the start", async () => {
    const { gameId } = await createGame();

    const res = await fetch(`${baseUrl}/game/all-legal-moves?gameId=${gameId}`);
    const body = (await res.json()) as { legalMoves: { from: { row: number; col: number }; moves: unknown[] }[] };

    expect(res.status).toBe(200);
    expect(body.legalMoves).toHaveLength(10);
    const pawnE2 = body.legalMoves.find((entry) => entry.from.row === 6 && entry.from.col === 4);
    expect(pawnE2?.moves).toHaveLength(2);
  });

  it("returns 404 for an unknown game", async () => {
    const res = await fetch(`${baseUrl}/game/all-legal-moves?gameId=missing`);

    expect(res.status).toBe(404);
  });
});

describe("authentication", () => {
  it.each([
    ["GET /api/game/all-legal-moves", () => fetch(`${baseUrl}/game/all-legal-moves?gameId=x`, { headers: {} })],
    ["POST /api/game", () => fetch(`${baseUrl}/game`, { method: "POST", headers: {} })],
    ["POST /api/game/move", () => postMove({ gameId: "x", moveData: e2e4, color: "white" }, "")],
  ])("returns 401 without a session cookie: %s", async (_name, call) => {
    const res = await call();

    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const res = await fetch(`${baseUrl}/game`, { method: "POST", headers: sessionCookie("forged") });

    expect(res.status).toBe(401);
  });

  it("returns the authenticated user from /api/auth", async () => {
    const res = await fetch(`${baseUrl}/auth`, { headers: sessionCookie("token-b") });

    expect(await res.json()).toEqual({ id: "user-b", email: "b@example.com" });
  });
});

describe("verified user cache", () => {
  const START = new Date("2030-01-01T00:00:00Z").getTime();

  const getUserCallsFor = (token: string) =>
    mockGetUser.mock.calls.filter(([calledWith]) => calledWith === token).length;

  beforeEach(() => {
    mockGetUser.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies a token once for repeated requests within 30 seconds", async () => {
    await fetch(`${baseUrl}/auth`, { headers: sessionCookie("token-cache-reuse") });
    vi.setSystemTime(START + 29_000);
    const res = await fetch(`${baseUrl}/auth`, { headers: sessionCookie("token-cache-reuse") });

    expect(res.status).toBe(200);
    expect(getUserCallsFor("token-cache-reuse")).toBe(1);
  });

  it("verifies the token again once 30 seconds have passed", async () => {
    await fetch(`${baseUrl}/auth`, { headers: sessionCookie("token-cache-expiry") });
    vi.setSystemTime(START + 30_001);
    await fetch(`${baseUrl}/auth`, { headers: sessionCookie("token-cache-expiry") });

    expect(getUserCallsFor("token-cache-expiry")).toBe(2);
  });

  it("does not cache a token that fails verification", async () => {
    await fetch(`${baseUrl}/auth`, { headers: sessionCookie("forged") });
    const res = await fetch(`${baseUrl}/auth`, { headers: sessionCookie("forged") });

    expect(res.status).toBe(401);
    expect(getUserCallsFor("forged")).toBe(2);
  });
});

const SESSION_A = { access_token: "token-a", refresh_token: "refresh-a", expires_in: 3600 };

const setCookies = (res: TestResponse): string[] => (res.headers["set-cookie"] ?? []) as string[];

describe("session cookies", () => {
  it("sets HttpOnly session cookies on login without returning tokens in the body", async () => {
    mockSignIn.mockResolvedValue({ data: { user: USERS["token-a"], session: SESSION_A }, error: null });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com", password: "secret" }),
      headers: {},
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "user-a", email: "a@example.com" });
    expect(setCookies(res)).toEqual([
      expect.stringContaining("access_token=token-a"),
      expect.stringContaining("refresh_token=refresh-a"),
    ]);
    setCookies(res).forEach((cookie) => {
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    });
  });

  it("returns 401 and sets no cookies for wrong credentials", async () => {
    mockSignIn.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com", password: "wrong" }),
      headers: {},
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid login credentials" });
    expect(setCookies(res)).toEqual([]);
  });

  it.each([
    ["missing password", { email: "a@example.com" }],
    ["missing email", { password: "secret" }],
    ["non-string email", { email: 1, password: "secret" }],
  ])("returns 400 for a login with %s", async (_name, body) => {
    const res = await fetch(`${baseUrl}/auth/login`, { method: "POST", body: JSON.stringify(body), headers: {} });

    expect(res.status).toBe(400);
  });

  it("returns 202 when sign-up needs email confirmation", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "user-c" }, session: null }, error: null });

    const res = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ email: "c@example.com", password: "secret" }),
      headers: {},
    });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ confirmationRequired: true });
    expect(setCookies(res)).toEqual([]);
  });

  it("refreshes an expired access token with the refresh cookie", async () => {
    mockRefreshSession.mockResolvedValue({
      data: {
        user: USERS["token-a"],
        session: { access_token: "token-a2", refresh_token: "refresh-a2", expires_in: 3600 },
      },
      error: null,
    });

    const res = await fetch(`${baseUrl}/auth`, {
      headers: { cookie: "access_token=expired; refresh_token=refresh-a" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "user-a", email: "a@example.com" });
    expect(mockRefreshSession).toHaveBeenCalledWith({ refresh_token: "refresh-a" });
    expect(setCookies(res)).toEqual([
      expect.stringContaining("access_token=token-a2"),
      expect.stringContaining("refresh_token=refresh-a2"),
    ]);
  });

  it("creates the profile for an authenticated user on first request", async () => {
    mockProfileUpsert.mockClear();

    const res = await request("GET", "/api/auth", undefined, { cookie: "access_token=token-c" });

    expect(res.status).toBe(200);
    expect(mockProfileUpsert).toHaveBeenCalledWith({
      where: { id: "user-c" },
      update: {},
      create: { id: "user-c" },
    });
  });

  it("skips the profile upsert on later requests from the same user", async () => {
    mockProfileUpsert.mockClear();
    await request("GET", "/api/auth", undefined, { cookie: "access_token=token-d" });

    const res = await request("GET", "/api/auth", undefined, { cookie: "access_token=token-d" });

    expect(res.status).toBe(200);
    expect(mockProfileUpsert).toHaveBeenCalledTimes(1);
  });

  it("clears the cookies and returns 401 when the session cannot be refreshed", async () => {
    const res = await fetch(`${baseUrl}/auth`, {
      headers: { cookie: "access_token=expired; refresh_token=revoked" },
    });

    expect(res.status).toBe(401);
    expect(setCookies(res)).toEqual([
      expect.stringMatching(/^access_token=;/),
      expect.stringMatching(/^refresh_token=;/),
    ]);
  });

  it("clears both session cookies on logout", async () => {
    const res = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: {} });

    expect(res.status).toBe(204);
    expect(setCookies(res)).toEqual([
      expect.stringMatching(/^access_token=;/),
      expect.stringMatching(/^refresh_token=;/),
    ]);
  });
});

describe("game ownership", () => {
  it("lets the owner read, move and query their game", async () => {
    const { gameId } = await createGame("token-a");

    const legal = await fetch(`${baseUrl}/game/all-legal-moves?gameId=${gameId}`);
    const move = await postMove({ gameId, moveData: e2e4, color: "white" }, "token-a");

    expect(legal.status).toBe(200);
    expect(move.status).toBe(200);
  });

  it("hides another user's game as not found", async () => {
    const { gameId } = await createGame("token-a");

    const legal = await fetch(`${baseUrl}/game/all-legal-moves?gameId=${gameId}`, { headers: sessionCookie("token-b") });
    const move = await postMove({ gameId, moveData: e2e4, color: "white" }, "token-b");

    expect(legal.status).toBe(404);
    expect(move.status).toBe(404);
  });

  it("does not let another user change the owner's game", async () => {
    const { gameId } = await createGame("token-a");

    await postMove({ gameId, moveData: e2e4, color: "white" }, "token-b");
    const legal = await fetch(`${baseUrl}/game/all-legal-moves?gameId=${gameId}`);
    const body = (await legal.json()) as { legalMoves: { from: { row: number } }[] };

    expect(body.legalMoves.every((entry) => entry.from.row === 6 || entry.from.row === 7)).toBe(true);
    expect(body.legalMoves).toHaveLength(10);
  });
});


import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import router from "../src/routs/route";

const { mockGetUser, mockRefreshSession, mockSignIn, mockSignUp } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
}));
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

const USERS: Record<string, { id: string; email: string }> = {
  "token-a": { id: "user-a", email: "a@example.com" },
  "token-b": { id: "user-b", email: "b@example.com" },
};

beforeEach(() => {
  mockGetUser.mockImplementation(async (token: string) => {
    const user = USERS[token];
    return user
      ? { data: { user }, error: null }
      : { data: { user: null }, error: { message: "invalid token" } };
  });
  mockRefreshSession.mockResolvedValue({ data: { user: null, session: null }, error: { message: "invalid refresh token" } });
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


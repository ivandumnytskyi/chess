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
  mockProfileFindUnique,
  mockProfileFindUniqueImpl,
  mockProfileUpdate,
  mockGameCreate,
  mockGameFindFirst,
  mockGameFindMany,
  mockGameUpdate,
  mockGameUpdateMany,
  mockMoveCreate,
  mockInviteCreate,
  mockInviteFindFirst,
  mockInviteFindMany,
  mockInviteUpdateMany,
  mockInviteUpdate,
  mockTransaction,
  txClient,
  fakeGames,
  fakeProfiles,
  fakeInvites,
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
      drawOfferedBy: null,
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
    const usernameOf = (id: unknown) => (typeof id === "string" ? { username: fakeProfiles.get(id) ?? null } : null);
    return {
      ...row,
      moves: [...row.moves].sort((a, b) => a.ply - b.ply),
      whitePlayer: usernameOf(row.whitePlayerId),
      blackPlayer: usernameOf(row.blackPlayerId),
    };
  });
  const mockGameUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const row = fakeGames.get(where.id);
    if (!row) throw new Error("Record not found");
    Object.assign(row, data);
    return row;
  });
  const mockGameUpdateMany = vi.fn(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const rows = [...fakeGames.values()].filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    },
  );
  const mockMoveCreate = vi.fn(async ({ data }: { data: Omit<FakeMove, "playedAt"> }) => {
    const row = fakeGames.get(data.gameId);
    if (!row) throw new Error("Record not found");
    const move = { ...data, playedAt: new Date() };
    row.moves.push(move);
    return move;
  });
  const mockTransaction = vi.fn(async (operations: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
    Array.isArray(operations) ? Promise.all(operations) : operations(txClient.current),
  );
  // Interactive transactions run against the same in-memory client; the prisma mock factory fills this in.
  const txClient: { current: unknown } = { current: null };

  // In-memory stand-in for profiles and invites, with just enough query matching for the invite controller.
  const fakeProfiles = new Map<string, string | null>();
  type FakeInvite = Record<string, unknown> & { id: string };
  const fakeInvites = new Map<string, FakeInvite>();

  const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, condition]) => {
      if (key === "OR") return (condition as Record<string, unknown>[]).some((clause) => matches(row, clause));
      if (typeof condition === "object" && condition !== null && "gt" in condition) {
        return (row[key] as Date) > (condition as { gt: Date }).gt;
      }
      if (typeof condition === "object" && condition !== null && "lte" in condition) {
        return (row[key] as Date) <= (condition as { lte: Date }).lte;
      }
      return row[key] === condition;
    });

  const withUsernames = (invite: FakeInvite) => ({
    ...invite,
    sender: { username: fakeProfiles.get(invite.senderId as string) ?? null },
    recipient: { username: fakeProfiles.get(invite.recipientId as string) ?? null },
  });

  const mockProfileFindUniqueImpl = async ({ where }: { where: { id?: string; username?: string } }) => {
    if (where.id !== undefined) {
      return fakeProfiles.has(where.id) ? { id: where.id, username: fakeProfiles.get(where.id) ?? null } : null;
    }
    const entry = [...fakeProfiles].find(([, username]) => username === where.username);
    return entry ? { id: entry[0], username: entry[1] } : null;
  };
  const mockInviteCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    // Mirrors the unique pair key, which only one pending invite per pair can hold.
    if (data.pairKey && [...fakeInvites.values()].some((row) => row.pairKey === data.pairKey)) {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }
    const invite: FakeInvite = {
      id: crypto.randomUUID(),
      status: "pending",
      gameId: null,
      createdAt: new Date(),
      respondedAt: null,
      ...data,
    };
    fakeInvites.set(invite.id, invite);
    return withUsernames(invite);
  });
  const mockInviteFindFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const invite = [...fakeInvites.values()].find((row) => matches(row, where));
    return invite ? withUsernames(invite) : null;
  });
  const mockInviteFindMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    [...fakeInvites.values()]
      .filter((row) => matches(row, where))
      .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime())
      .map(withUsernames),
  );
  const mockInviteUpdateMany = vi.fn(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const rows = [...fakeInvites.values()].filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    },
  );
  const mockInviteUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const invite = fakeInvites.get(where.id);
    if (!invite) throw new Error("Record not found");
    return Object.assign(invite, data);
  });

  return {
    mockGetUser: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockSignIn: vi.fn(),
    mockSignUp: vi.fn(),
    mockProfileUpsert: vi.fn(),
    mockProfileFindUnique: vi.fn(),
    mockProfileFindUniqueImpl,
    mockProfileUpdate: vi.fn(),
    mockGameCreate,
    mockGameFindFirst,
    mockGameFindMany: vi.fn(),
    mockGameUpdate,
    mockGameUpdateMany,
    mockMoveCreate,
    mockInviteCreate,
    mockInviteFindFirst,
    mockInviteFindMany,
    mockInviteUpdateMany,
    mockInviteUpdate,
    mockTransaction,
    txClient,
    fakeGames,
    fakeProfiles,
    fakeInvites,
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
vi.mock("../lib/prisma", () => {
  const prisma = {
    profile: { upsert: mockProfileUpsert, findUnique: mockProfileFindUnique, update: mockProfileUpdate },
    game: {
      create: mockGameCreate,
      findFirst: mockGameFindFirst,
      findMany: mockGameFindMany,
      update: mockGameUpdate,
      updateMany: mockGameUpdateMany,
    },
    move: { create: mockMoveCreate },
    gameInvite: {
      create: mockInviteCreate,
      findFirst: mockInviteFindFirst,
      findMany: mockInviteFindMany,
      updateMany: mockInviteUpdateMany,
      update: mockInviteUpdate,
    },
    $transaction: mockTransaction,
  };
  txClient.current = prisma;
  return { prisma };
});

const USERS: Record<string, { id: string; email: string }> = {
  "token-a": { id: "user-a", email: "a@example.com" },
  "token-b": { id: "user-b", email: "b@example.com" },
  "token-c": { id: "user-c", email: "c@example.com" },
  "token-d": { id: "user-d", email: "d@example.com" },
  "token-dave": { id: "user-dave", email: "dave@example.com" },
  "token-nameless": { id: "user-nameless", email: "nameless@example.com" },
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
  fakeProfiles.clear();
  fakeInvites.clear();
  mockProfileFindUnique.mockImplementation(mockProfileFindUniqueImpl);
  mockGameFindMany.mockResolvedValue([]);
  mockProfileUpdate.mockImplementation(async ({ data }: { data: { username: string } }) => ({ username: data.username }));
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

describe("GET /api/games", () => {
  const USER_ID = "user-b";
  const OPPONENT_ID = "user-opponent";

  const gameRow = (id: string, color: "white" | "black", result: string | null) => ({
    id,
    whitePlayerId: color === "white" ? USER_ID : OPPONENT_ID,
    timeControlId: "blitz-5-3",
    status: result ? "finished" : "active",
    result,
    endReason: result ? "checkmate" : null,
    createdAt: new Date("2030-01-01T00:00:00Z"),
    finishedAt: result ? new Date("2030-01-01T00:10:00Z") : null,
    whitePlayer: { username: color === "white" ? "bee" : "opp" },
    blackPlayer: { username: color === "white" ? "opp" : "bee" },
  });

  const ID_1 = "11111111-1111-4111-8111-111111111111";
  const ID_2 = "22222222-2222-4222-8222-222222222222";
  const ID_3 = "33333333-3333-4333-8333-333333333333";

  const listGames = (query = "") =>
    fetch(`${baseUrl}/games${query}`, { headers: sessionCookie("token-b") });

  it.each([
    ["white", "white_wins", "win"],
    ["white", "black_wins", "loss"],
    ["black", "black_wins", "win"],
    ["black", "white_wins", "loss"],
    ["white", "draw", "draw"],
    ["black", "draw", "draw"],
    ["white", null, null],
  ] as const)("maps %s player with result %s to outcome %s", async (color, result, outcome) => {
    mockGameFindMany.mockResolvedValue([gameRow(ID_1, color, result)]);

    const res = await listGames();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.games[0].outcome).toBe(outcome);
    expect(body.games[0].color).toBe(color);
  });

  it("returns the opponent username and game fields", async () => {
    mockGameFindMany.mockResolvedValue([gameRow(ID_1, "white", "white_wins")]);

    const body = await (await listGames()).json();

    expect(body.games[0]).toMatchObject({
      id: ID_1,
      color: "white",
      opponentUsername: "opp",
      timeControlId: "blitz-5-3",
      status: "finished",
      result: "white_wins",
      endReason: "checkmate",
      outcome: "win",
    });
    expect(body).toHaveProperty("nextCursor", null);
  });

  it("queries only the user's finished games newest first with one extra row", async () => {
    await listGames();

    expect(mockGameFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "finished", OR: [{ whitePlayerId: USER_ID }, { blackPlayerId: USER_ID }] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
      }),
    );
  });

  it("returns a nextCursor when another page exists", async () => {
    mockGameFindMany.mockResolvedValue([
      gameRow(ID_1, "white", "white_wins"),
      gameRow(ID_2, "white", "draw"),
      gameRow(ID_3, "black", "draw"),
    ]);

    const body = await (await listGames("?limit=2")).json();

    expect(body.games.map((game: { id: string }) => game.id)).toEqual([ID_1, ID_2]);
    expect(body.nextCursor).toBe(ID_2);
  });

  it("returns a null nextCursor on the last page", async () => {
    mockGameFindMany.mockResolvedValue([gameRow(ID_1, "white", "white_wins")]);

    const body = await (await listGames("?limit=2")).json();

    expect(body.nextCursor).toBeNull();
  });

  it("continues from the cursor by skipping the cursor row", async () => {
    await listGames(`?limit=5&cursor=${ID_2}`);

    expect(mockGameFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: ID_2 }, skip: 1, take: 6 }),
    );
  });

  it.each(["0", "51", "abc", "-1", "2.5"])("returns 400 for limit %s", async (limit) => {
    const res = await listGames(`?limit=${limit}`);

    expect(res.status).toBe(400);
    expect(mockGameFindMany).not.toHaveBeenCalled();
  });

  it("returns 400 for a cursor that is not a game id", async () => {
    const res = await listGames("?cursor=not-a-uuid");

    expect(res.status).toBe(400);
    expect(mockGameFindMany).not.toHaveBeenCalled();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await fetch(`${baseUrl}/games`, { headers: {} });

    expect(res.status).toBe(401);
  });
});

describe("game invites", () => {
  interface InviteView {
    id: string;
    from: string | null;
    to: string | null;
    timeControlId: string;
    color: "white" | "black" | "random";
    createdAt: string;
    expiresAt: string;
  }

  const post = (token: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sessionCookie(token) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const sendInvite = (token: string, body: unknown) => post(token, "/invites", body);

  const listInvites = async (token: string) =>
    (await (await fetch(`${baseUrl}/invites`, { headers: sessionCookie(token) })).json()) as {
      incoming: InviteView[];
      outgoing: InviteView[];
    };

  // alice (user-a) invites bob (user-b) unless told otherwise.
  const createInvite = async (token = "token-a", username = "bob"): Promise<string> => {
    const res = await sendInvite(token, { username });
    return ((await res.json()) as { invite: InviteView }).invite.id;
  };

  const inviteRow = (id: string) => fakeInvites.get(id);

  // alice is white and bob is black, so alice moves first.
  const startGame = async (): Promise<string> => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const id = await createInvite();
    const res = await post("token-b", `/invites/${id}/accept`);
    return ((await res.json()) as { gameId: string }).gameId;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fakeProfiles.set("user-a", "alice");
    fakeProfiles.set("user-b", "bob");
    fakeProfiles.set("user-nameless", null);
    fakeProfiles.set("user-dave", "dave");
  });

  describe("sending", () => {
    it("creates a pending invite with the default time control that expires in 30 minutes", async () => {
      const res = await sendInvite("token-a", { username: "bob" });
      const { invite } = (await res.json()) as { invite: InviteView };

      expect(res.status).toBe(201);
      expect(invite).toMatchObject({ from: "alice", to: "bob", timeControlId: "10+0" });
      expect(new Date(invite.expiresAt).getTime() - new Date(invite.createdAt).getTime()).toBe(30 * 60 * 1000);
      expect(inviteRow(invite.id)).toMatchObject({ senderId: "user-a", recipientId: "user-b", status: "pending" });
    });

    it("uses the chosen time control", async () => {
      const res = await sendInvite("token-a", { username: "bob", timeControl: "2+1" });
      const { invite } = (await res.json()) as { invite: InviteView };

      expect(invite.timeControlId).toBe("2+1");
    });

    it("finds the recipient regardless of letter case and spaces", async () => {
      const res = await sendInvite("token-a", { username: "  BoB " });

      expect(res.status).toBe(201);
    });

    it.each([
      ["no color given", undefined, "random", null],
      ["random", "random", "random", null],
      ["white", "white", "white", "white"],
      ["black", "black", "black", "black"],
    ] as const)("stores the sender's color choice: %s", async (_name, color, shownColor, storedColor) => {
      const res = await sendInvite("token-a", { username: "bob", color });
      const { invite } = (await res.json()) as { invite: InviteView };

      expect(res.status).toBe(201);
      expect(invite.color).toBe(shownColor);
      expect(inviteRow(invite.id)?.senderColor).toBe(storedColor);
    });

    it.each(["red", "WHITE", 1, null])("returns 400 for the invalid color %j", async (color) => {
      const res = await sendInvite("token-a", { username: "bob", color });

      expect(res.status).toBe(400);
      expect(fakeInvites.size).toBe(0);
    });

    it.each([
      ["missing", undefined],
      ["not a string", 42],
      ["too short", "ab"],
      ["has a space", "bo b"],
    ])("returns 400 when the username is %s", async (_name, username) => {
      const res = await sendInvite("token-a", { username });

      expect(res.status).toBe(400);
      expect(fakeInvites.size).toBe(0);
    });

    it("returns 400 for an unknown time control", async () => {
      const res = await sendInvite("token-a", { username: "bob", timeControl: "99+9" });

      expect(res.status).toBe(400);
      expect(fakeInvites.size).toBe(0);
    });

    it("returns 403 when the sender has not chosen a username", async () => {
      const res = await sendInvite("token-nameless", { username: "bob" });

      expect(res.status).toBe(403);
      expect(fakeInvites.size).toBe(0);
    });

    it("returns 404 when nobody has that username", async () => {
      const res = await sendInvite("token-a", { username: "nobody" });

      expect(res.status).toBe(404);
    });

    it("returns 400 when inviting yourself", async () => {
      const res = await sendInvite("token-a", { username: "alice" });

      expect(res.status).toBe(400);
      expect(fakeInvites.size).toBe(0);
    });

    it.each([
      ["the same direction", "token-a", "bob"],
      ["the opposite direction", "token-b", "alice"],
    ])("returns 409 when a pending invite already exists in %s", async (_name, token, username) => {
      await createInvite("token-a", "bob");

      const res = await sendInvite(token, { username });

      expect(res.status).toBe(409);
      expect(fakeInvites.size).toBe(1);
    });

    it("allows only one of two invites sent at the same time, whichever direction they go", async () => {
      const [first, second] = await Promise.all([
        sendInvite("token-a", { username: "bob" }),
        sendInvite("token-b", { username: "alice" }),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      expect(fakeInvites.size).toBe(1);
    });

    it("allows a new invite once the earlier one was accepted", async () => {
      const id = await createInvite();
      await post("token-b", `/invites/${id}/accept`);

      const res = await sendInvite("token-a", { username: "bob" });

      expect(res.status).toBe(201);
    });

    it("allows a new invite once the earlier one was cancelled", async () => {
      const id = await createInvite();
      await post("token-a", `/invites/${id}/cancel`);

      const res = await sendInvite("token-a", { username: "bob" });

      expect(res.status).toBe(201);
    });

    it("returns 401 without a session cookie", async () => {
      const res = await fetch(`${baseUrl}/invites`, { method: "POST", headers: {}, body: JSON.stringify({ username: "bob" }) });

      expect(res.status).toBe(401);
    });
  });

  describe("listing", () => {
    it("shows an invite as incoming for the recipient and outgoing for the sender", async () => {
      const id = await createInvite();

      const recipient = await listInvites("token-b");
      const sender = await listInvites("token-a");

      expect(recipient.incoming.map((invite) => invite.id)).toEqual([id]);
      expect(recipient.outgoing).toEqual([]);
      expect(sender.outgoing.map((invite) => invite.id)).toEqual([id]);
      expect(sender.incoming).toEqual([]);
    });

    it("does not show invites to other users", async () => {
      await createInvite();

      const other = await listInvites("token-dave");

      expect(other).toEqual({ incoming: [], outgoing: [] });
    });

    it.each(["accept", "decline"] as const)("drops an invite after it was answered with %s", async (action) => {
      const id = await createInvite();
      await post("token-b", `/invites/${id}/${action}`);

      const recipient = await listInvites("token-b");

      expect(recipient.incoming).toEqual([]);
    });

    describe("after the invite has expired", () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it("no longer lists it", async () => {
        await createInvite();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 31 * 60 * 1000);

        const recipient = await listInvites("token-b");

        expect(recipient.incoming).toEqual([]);
      });

      it("lets the sender invite the same person again and marks the old invite expired", async () => {
        const oldId = await createInvite();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 31 * 60 * 1000);

        const res = await sendInvite("token-a", { username: "bob" });

        expect(res.status).toBe(201);
        expect(inviteRow(oldId)).toMatchObject({ status: "expired", pairKey: null });
      });
    });
  });

  describe("accepting", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each([
      [0.1, "white", "black"],
      [0.9, "black", "white"],
    ] as const)(
      "with random %s the sender plays %s and the recipient plays %s",
      async (random, senderColor, recipientColor) => {
        vi.spyOn(Math, "random").mockReturnValue(random);
        const id = await createInvite();

        const res = await post("token-b", `/invites/${id}/accept`);
        const body = (await res.json()) as { gameId: string; color: string; timeControl: string };
        const game = fakeGames.get(body.gameId);

        expect(res.status).toBe(201);
        expect(body.color).toBe(recipientColor);
        expect(body.timeControl).toBe("10+0");
        expect(game?.[senderColor === "white" ? "whitePlayerId" : "blackPlayerId"]).toBe("user-a");
        expect(game?.[senderColor === "white" ? "blackPlayerId" : "whitePlayerId"]).toBe("user-b");
      },
    );

    it.each([
      ["white", 0.9, "white", "black"],
      ["black", 0.1, "black", "white"],
      ["random", 0.1, "white", "black"],
      ["random", 0.9, "black", "white"],
    ] as const)(
      "with the sender asking for %s and random %s the sender plays %s and the recipient plays %s",
      async (requested, random, senderColor, recipientColor) => {
        vi.spyOn(Math, "random").mockReturnValue(random);
        const sent = await sendInvite("token-a", { username: "bob", color: requested });
        const { invite } = (await sent.json()) as { invite: InviteView };

        const res = await post("token-b", `/invites/${invite.id}/accept`);
        const body = (await res.json()) as { gameId: string; color: string };
        const game = fakeGames.get(body.gameId);

        expect(body.color).toBe(recipientColor);
        expect(game?.[senderColor === "white" ? "whitePlayerId" : "blackPlayerId"]).toBe("user-a");
        expect(game?.[senderColor === "white" ? "blackPlayerId" : "whitePlayerId"]).toBe("user-b");
      },
    );

    it("creates the game with the invite's time control and a full clock", async () => {
      const id = await sendInvite("token-a", { username: "bob", timeControl: "2+1" })
        .then((res) => res.json())
        .then((body) => (body as { invite: InviteView }).invite.id);

      const res = await post("token-b", `/invites/${id}/accept`);
      const { gameId } = (await res.json()) as { gameId: string };

      expect(fakeGames.get(gameId)).toMatchObject({
        timeControlId: "2+1",
        timeInitialMs: 120_000,
        timeIncrementMs: 1_000,
        whiteRemainingMs: 120_000,
        blackRemainingMs: 120_000,
      });
    });

    it("marks the invite accepted and links it to the game", async () => {
      const id = await createInvite();

      const res = await post("token-b", `/invites/${id}/accept`);
      const { gameId } = (await res.json()) as { gameId: string };

      expect(inviteRow(id)).toMatchObject({ status: "accepted", gameId });
      expect(inviteRow(id)?.respondedAt).toBeInstanceOf(Date);
    });

    it("returns 409 and creates no second game when accepted twice", async () => {
      const id = await createInvite();
      await post("token-b", `/invites/${id}/accept`);

      const res = await post("token-b", `/invites/${id}/accept`);

      expect(res.status).toBe(409);
      expect(fakeGames.size).toBe(1);
    });

    it.each([
      ["the sender", "token-a"],
      ["someone else", "token-dave"],
    ])("returns 404 when %s tries to accept", async (_name, token) => {
      const id = await createInvite();

      const res = await post(token, `/invites/${id}/accept`);

      expect(res.status).toBe(404);
      expect(fakeGames.size).toBe(0);
      expect(inviteRow(id)?.status).toBe("pending");
    });

    it.each(["decline", "cancel"] as const)("returns 409 when the invite was already closed with %s", async (action) => {
      const id = await createInvite();
      await post(action === "decline" ? "token-b" : "token-a", `/invites/${id}/${action}`);

      const res = await post("token-b", `/invites/${id}/accept`);

      expect(res.status).toBe(409);
      expect(fakeGames.size).toBe(0);
    });

    it("returns 404 for an id that is not a uuid", async () => {
      const res = await post("token-b", "/invites/not-a-uuid/accept");

      expect(res.status).toBe(404);
    });

    it("returns 404 for an unknown invite", async () => {
      const res = await post("token-b", `/invites/${crypto.randomUUID()}/accept`);

      expect(res.status).toBe(404);
    });

    describe("after the invite has expired", () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it("returns 409 and creates no game", async () => {
        const id = await createInvite();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 31 * 60 * 1000);

        const res = await post("token-b", `/invites/${id}/accept`);

        expect(res.status).toBe(409);
        expect(fakeGames.size).toBe(0);
      });
    });
  });

  describe("declining and cancelling", () => {
    it("lets the recipient decline", async () => {
      const id = await createInvite();

      const res = await post("token-b", `/invites/${id}/decline`);

      expect(res.status).toBe(200);
      expect(inviteRow(id)).toMatchObject({ status: "declined" });
    });

    it("lets the sender cancel", async () => {
      const id = await createInvite();

      const res = await post("token-a", `/invites/${id}/cancel`);

      expect(res.status).toBe(200);
      expect(inviteRow(id)).toMatchObject({ status: "cancelled" });
    });

    it.each([
      ["the sender declining", "token-a", "decline"],
      ["the recipient cancelling", "token-b", "cancel"],
      ["someone else declining", "token-dave", "decline"],
      ["someone else cancelling", "token-dave", "cancel"],
    ])("returns 404 for %s", async (_name, token, action) => {
      const id = await createInvite();

      const res = await post(token, `/invites/${id}/${action}`);

      expect(res.status).toBe(404);
      expect(inviteRow(id)?.status).toBe("pending");
    });

    it("returns 409 when the invite was already answered", async () => {
      const id = await createInvite();
      await post("token-b", `/invites/${id}/decline`);

      const res = await post("token-b", `/invites/${id}/decline`);

      expect(res.status).toBe(409);
    });
  });

  describe("playing the accepted game", () => {
    const e7e5 = { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } };

    it("lets each player move their own color in turn", async () => {
      const gameId = await startGame();

      const white = await postMove({ gameId, moveData: e2e4, color: "white" }, "token-a");
      const black = await postMove({ gameId, moveData: e7e5, color: "black" }, "token-b");

      expect(white.status).toBe(200);
      expect(black.status).toBe(200);
    });

    it.each([
      ["the white player moving black", "token-a", "black"],
      ["the black player moving white", "token-b", "white"],
    ] as const)("returns 403 for %s", async (_name, token, color) => {
      const gameId = await startGame();

      const res = await postMove({ gameId, moveData: e2e4, color }, token);

      expect(res.status).toBe(403);
      expect(fakeGames.get(gameId)?.moves).toEqual([]);
    });

    it("lets both players read the legal moves", async () => {
      const gameId = await startGame();

      const white = await fetch(`${baseUrl}/game/all-legal-moves?gameId=${gameId}`, { headers: sessionCookie("token-a") });
      const black = await fetch(`${baseUrl}/game/all-legal-moves?gameId=${gameId}`, { headers: sessionCookie("token-b") });

      expect(white.status).toBe(200);
      expect(black.status).toBe(200);
    });

    it("hides the game from other users", async () => {
      const gameId = await startGame();

      const res = await postMove({ gameId, moveData: e2e4, color: "white" }, "token-dave");

      expect(res.status).toBe(404);
    });
  });

  describe("loading a game", () => {
    interface GameState {
      gameId: string;
      yourColor: "white" | "black" | null;
      timeControl: string;
      currentTurn: "white" | "black";
      status: string;
      finished: boolean;
      result: string | null;
      winner: "white" | "black" | null;
      endReason: string | null;
      legalMoves: unknown[];
      moveCount: number;
      lastMove: { from: unknown; to: unknown } | null;
      drawOfferedBy: "white" | "black" | null;
      players: { white: string | null; black: string | null };
      clock: { whiteRemainingMs: number; blackRemainingMs: number };
    }

    const loadGame = (token: string, id: string) =>
      fetch(`${baseUrl}/game/${id}`, { headers: sessionCookie(token) });

    const stateOf = async (token: string, id: string) => (await (await loadGame(token, id)).json()) as GameState;

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns the board, turn, players and the caller's color", async () => {
      const gameId = await startGame();

      const res = await loadGame("token-a", gameId);
      const state = (await res.json()) as GameState;

      expect(res.status).toBe(200);
      expect(state).toMatchObject({
        gameId,
        yourColor: "white",
        timeControl: "10+0",
        currentTurn: "white",
        finished: false,
        result: null,
        winner: null,
        endReason: null,
        moveCount: 0,
        lastMove: null,
        drawOfferedBy: null,
        players: { white: "alice", black: "bob" },
      });
      expect(state.legalMoves.length).toBeGreaterThan(0);
      expect(state.clock.blackRemainingMs).toBe(600_000);
    });

    it("shows the opponent's move to the other player", async () => {
      const gameId = await startGame();
      await postMove({ gameId, moveData: e2e4, color: "white" }, "token-a");

      const state = await stateOf("token-b", gameId);

      expect(state).toMatchObject({ yourColor: "black", currentTurn: "black", moveCount: 1, lastMove: e2e4 });
    });

    it("has no fixed color in a solo game", async () => {
      const { gameId } = await createGame("token-a");

      const state = await stateOf("token-a", gameId);

      expect(state).toMatchObject({ yourColor: null, players: { white: "alice", black: null } });
    });

    it.each([
      ["a player outside the game", "token-dave", true],
      ["an id that is not a uuid", "token-a", false],
    ])("returns 404 for %s", async (_name, token, realGame) => {
      const gameId = await startGame();

      const res = await loadGame(token, realGame ? gameId : "not-a-uuid");

      expect(res.status).toBe(404);
    });

    it("returns 404 for an unknown game", async () => {
      const res = await loadGame("token-a", crypto.randomUUID());

      expect(res.status).toBe(404);
    });

    it("returns 401 without a session cookie", async () => {
      const gameId = await startGame();

      const res = await fetch(`${baseUrl}/game/${gameId}`, { headers: {} });

      expect(res.status).toBe(401);
    });

    it("charges the side to move for the time since the last move", async () => {
      const gameId = await startGame();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime((fakeGames.get(gameId)?.lastMoveAt as Date).getTime() + 5_000);

      const { clock } = await stateOf("token-b", gameId);

      expect(clock).toEqual({ whiteRemainingMs: 595_000, blackRemainingMs: 600_000 });
    });

    it.each([
      ["white", "token-a", "black"],
      ["black", "token-b", "black"],
    ] as const)("ends the game on time when %s polls after the side to move ran out", async (_name, token, winner) => {
      const gameId = await startGame();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime((fakeGames.get(gameId)?.lastMoveAt as Date).getTime() + 600_001);

      const state = await stateOf(token, gameId);

      expect(state).toMatchObject({
        finished: true,
        winner,
        result: "black_wins",
        endReason: "timeout",
        legalMoves: [],
        clock: { whiteRemainingMs: 0, blackRemainingMs: 600_000 },
      });
      expect(fakeGames.get(gameId)).toMatchObject({ status: "finished", result: "black_wins", endReason: "timeout" });
    });
  });

  describe("resigning", () => {
    it.each([
      ["white", "token-a", "black_wins", "black"],
      ["black", "token-b", "white_wins", "white"],
    ] as const)("ends the game with a win for the opponent when %s resigns", async (_name, token, result, winner) => {
      const gameId = await startGame();

      const res = await post(token, "/game/resign", { gameId });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ winner });
      expect(fakeGames.get(gameId)).toMatchObject({ status: "finished", result, endReason: "resignation" });
      expect(fakeGames.get(gameId)?.finishedAt).toBeInstanceOf(Date);
    });

    it("stops further moves", async () => {
      const gameId = await startGame();
      await post("token-b", "/game/resign", { gameId });

      const res = await postMove({ gameId, moveData: e2e4, color: "white" }, "token-a");

      expect(res.status).toBe(409);
    });

    it("returns 409 when the game is already over", async () => {
      const gameId = await startGame();
      await post("token-a", "/game/resign", { gameId });

      const res = await post("token-b", "/game/resign", { gameId });

      expect(res.status).toBe(409);
      expect(fakeGames.get(gameId)?.result).toBe("black_wins");
    });

    it("returns 404 for a player outside the game", async () => {
      const gameId = await startGame();

      const res = await post("token-dave", "/game/resign", { gameId });

      expect(res.status).toBe(404);
      expect(fakeGames.get(gameId)?.status).toBe("active");
    });

    it("returns 400 in a solo game", async () => {
      const { gameId } = await createGame("token-a");

      const res = await post("token-a", "/game/resign", { gameId });

      expect(res.status).toBe(400);
    });

    it("returns 400 without a game id", async () => {
      const res = await post("token-a", "/game/resign", {});

      expect(res.status).toBe(400);
    });

    describe("after the clock ran out", () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it("returns 409 and records the timeout instead", async () => {
        const gameId = await startGame();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime((fakeGames.get(gameId)?.lastMoveAt as Date).getTime() + 600_001);

        const res = await post("token-a", "/game/resign", { gameId });

        expect(res.status).toBe(409);
        expect(fakeGames.get(gameId)).toMatchObject({ result: "black_wins", endReason: "timeout" });
      });
    });
  });

  describe("draw offers", () => {
    const stateOf = async (token: string, id: string) =>
      (await (await fetch(`${baseUrl}/game/${id}`, { headers: sessionCookie(token) })).json()) as {
        drawOfferedBy: string | null;
      };

    const offer = (token: string, gameId: string) => post(token, "/game/draw/offer", { gameId });
    const accept = (token: string, gameId: string) => post(token, "/game/draw/accept", { gameId });
    const decline = (token: string, gameId: string) => post(token, "/game/draw/decline", { gameId });
    const e7e5 = { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } };

    it("records the offer and shows it to the opponent", async () => {
      const gameId = await startGame();

      const res = await offer("token-a", gameId);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ drawOfferedBy: "white" });
      expect((await stateOf("token-b", gameId)).drawOfferedBy).toBe("white");
    });

    it.each([
      ["the same player offers again", "token-a"],
      ["the opponent offers too", "token-b"],
    ])("returns 409 when %s while an offer is pending", async (_name, token) => {
      const gameId = await startGame();
      await offer("token-a", gameId);

      const res = await offer(token, gameId);

      expect(res.status).toBe(409);
      expect(fakeGames.get(gameId)?.drawOfferedBy).toBe("white");
    });

    it("ends the game in a draw when the opponent accepts", async () => {
      const gameId = await startGame();
      await offer("token-a", gameId);

      const res = await accept("token-b", gameId);

      expect(res.status).toBe(200);
      expect(fakeGames.get(gameId)).toMatchObject({
        status: "finished",
        result: "draw",
        endReason: "agreement",
        drawOfferedBy: null,
      });
      expect(fakeGames.get(gameId)?.finishedAt).toBeInstanceOf(Date);
    });

    it("does not let the offering player accept their own offer", async () => {
      const gameId = await startGame();
      await offer("token-a", gameId);

      const res = await accept("token-a", gameId);

      expect(res.status).toBe(409);
      expect(fakeGames.get(gameId)?.status).toBe("active");
    });

    it.each([
      ["accept", accept],
      ["decline", decline],
    ])("returns 409 on %s when nobody offered a draw", async (_name, answer) => {
      const gameId = await startGame();

      const res = await answer("token-b", gameId);

      expect(res.status).toBe(409);
    });

    it("clears the offer when the opponent declines, and allows a new one", async () => {
      const gameId = await startGame();
      await offer("token-a", gameId);

      const res = await decline("token-b", gameId);
      const again = await offer("token-b", gameId);

      expect(res.status).toBe(200);
      expect(again.status).toBe(200);
      expect(fakeGames.get(gameId)?.drawOfferedBy).toBe("black");
    });

    it("keeps the offer when the offering player moves", async () => {
      const gameId = await startGame();
      await offer("token-a", gameId);
      await postMove({ gameId, moveData: e2e4, color: "white" }, "token-a");

      expect((await stateOf("token-b", gameId)).drawOfferedBy).toBe("white");
    });

    it("drops the offer when the opponent plays a move instead of answering", async () => {
      const gameId = await startGame();
      await postMove({ gameId, moveData: e2e4, color: "white" }, "token-a");
      await offer("token-a", gameId);
      await postMove({ gameId, moveData: e7e5, color: "black" }, "token-b");

      expect((await stateOf("token-a", gameId)).drawOfferedBy).toBeNull();
    });

    it("returns 409 for offers after the game is over", async () => {
      const gameId = await startGame();
      await post("token-a", "/game/resign", { gameId });

      const res = await offer("token-b", gameId);

      expect(res.status).toBe(409);
    });

    it("returns 404 for a player outside the game", async () => {
      const gameId = await startGame();

      const res = await offer("token-dave", gameId);

      expect(res.status).toBe(404);
    });

    it("returns 400 in a solo game", async () => {
      const { gameId } = await createGame("token-a");

      const res = await offer("token-a", gameId);

      expect(res.status).toBe(400);
    });
  });
});

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("username", () => {
  const signupWith = (username: unknown) =>
    fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ email: "n@example.com", password: "secret", username }),
      headers: {},
    });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(21)],
    ["contains a space", "has space"],
    ["contains a dash", "dash-name"],
    ["reserved", "admin"],
    ["missing", undefined],
  ])("rejects a signup with a %s username", async (_name, username) => {
    mockSignUp.mockClear();

    const res = await signupWith(username);

    expect(res.status).toBe(400);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("returns 409 when the signup username is already taken", async () => {
    mockProfileFindUnique.mockResolvedValueOnce({ id: "user-x" });
    mockSignUp.mockClear();

    const res = await signupWith("taken_name");

    expect(res.status).toBe(409);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("stores the normalized username in signup metadata", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "user-new" }, session: null }, error: null });

    await signupWith("  NewUser ");

    expect(mockSignUp).toHaveBeenLastCalledWith({
      email: "n@example.com",
      password: "secret",
      options: { data: { username: "newuser" } },
    });
  });

  it("creates the profile with the signup username on the first request", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-meta", email: "m@example.com", user_metadata: { username: "meta_user" } } },
      error: null,
    });

    const res = await fetch(`${baseUrl}/profile`, { headers: sessionCookie("token-meta-create") });

    expect(res.status).toBe(200);
    expect(mockProfileUpsert).toHaveBeenLastCalledWith({
      where: { id: "user-meta" },
      update: {},
      create: { id: "user-meta", username: "meta_user" },
    });
  });

  it("creates the profile without a username when the signup name was taken meanwhile", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-fallback", email: "f@example.com", user_metadata: { username: "fallback_name" } } },
      error: null,
    });
    mockProfileUpsert.mockRejectedValueOnce(uniqueViolation());

    const res = await fetch(`${baseUrl}/profile`, { headers: sessionCookie("token-meta-fallback") });

    expect(res.status).toBe(200);
    expect(mockProfileUpsert).toHaveBeenLastCalledWith({
      where: { id: "user-fallback" },
      update: {},
      create: { id: "user-fallback" },
    });
  });

  it("returns the saved username from GET /api/profile", async () => {
    mockProfileFindUnique.mockResolvedValueOnce({ username: "saved_name" });

    const res = await fetch(`${baseUrl}/profile`, { headers: sessionCookie("token-b") });

    expect(await res.json()).toEqual({ username: "saved_name" });
  });

  it("changes the username to its normalized form", async () => {
    const res = await fetch(`${baseUrl}/profile/username`, {
      method: "PATCH",
      body: JSON.stringify({ username: " NewName " }),
      headers: sessionCookie("token-a"),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: "newname" });
    expect(mockProfileUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: "user-a" }, data: { username: "newname" } }),
    );
  });

  it("returns 409 when the new username belongs to someone else", async () => {
    mockProfileUpdate.mockRejectedValueOnce(uniqueViolation());

    const res = await fetch(`${baseUrl}/profile/username`, {
      method: "PATCH",
      body: JSON.stringify({ username: "taken_name" }),
      headers: sessionCookie("token-a"),
    });

    expect(res.status).toBe(409);
  });

  it.each([
    ["too short", "ab"],
    ["reserved", "bot"],
    ["missing", undefined],
  ])("rejects a username change with a %s name", async (_name, username) => {
    mockProfileUpdate.mockClear();

    const res = await fetch(`${baseUrl}/profile/username`, {
      method: "PATCH",
      body: JSON.stringify({ username }),
      headers: sessionCookie("token-a"),
    });

    expect(res.status).toBe(400);
    expect(mockProfileUpdate).not.toHaveBeenCalled();
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
      body: JSON.stringify({ email: "c@example.com", password: "secret", username: "user_c" }),
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
      create: { id: "user-c", username: null },
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


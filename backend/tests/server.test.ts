import { describe, expect, it } from "vitest";
import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import router from "../src/routs/route";

const app = express();
app.use(express.json());
app.use("/api", router);

interface TestResponse {
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

// Dispatches through the Express app in-memory, so no network socket is needed.
function request(method: string, path: string, body?: unknown): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = path;
    req.headers = payload
      ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(payload)) }
      : {};
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
const fetch = (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<TestResponse> =>
  request(init?.method ?? "GET", url, init?.body === undefined ? undefined : JSON.parse(init.body));

interface GameResponse {
  gameId: string;
  boardState: unknown;
  currentTurn: string;
}

async function createGame(): Promise<GameResponse> {
  const res = await fetch(`${baseUrl}/game`, { method: "POST" });
  return (await res.json()) as GameResponse;
}

function postMove(body: unknown): Promise<TestResponse> {
  return fetch(`${baseUrl}/game/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

describe("GET /api/game", () => {
  it("returns status for an existing game", async () => {
    const { gameId } = await createGame();

    const res = await fetch(`${baseUrl}/game?gameId=${gameId}`);
    const body = (await res.json()) as { status: unknown; currentTurn: string };

    expect(res.status).toBe(200);
    expect(body.status).toBeDefined();
    expect(body.currentTurn).toBe("white");
  });

  it("returns 404 for an unknown game", async () => {
    const res = await fetch(`${baseUrl}/game?gameId=missing`);

    expect(res.status).toBe(404);
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

describe("GET /api/game/legal-moves", () => {
  it("returns two moves for a starting pawn", async () => {
    const { gameId } = await createGame();

    const res = await fetch(`${baseUrl}/game/legal-moves?gameId=${gameId}&row=6&col=4`);
    const body = (await res.json()) as { legalMoves: unknown[] };

    expect(res.status).toBe(200);
    expect(body.legalMoves).toHaveLength(2);
  });

  it("returns no moves for a blocked piece", async () => {
    const { gameId } = await createGame();

    const res = await fetch(`${baseUrl}/game/legal-moves?gameId=${gameId}&row=7&col=0`);
    const body = (await res.json()) as { legalMoves: unknown[] };

    expect(body.legalMoves).toHaveLength(0);
  });

  it.each([
    ["row=8&col=0"],
    ["row=-1&col=0"],
    ["row=a&col=0"],
    ["row=1"],
  ])("returns 400 for invalid coordinates (%s)", async (query) => {
    const { gameId } = await createGame();

    const res = await fetch(`${baseUrl}/game/legal-moves?gameId=${gameId}&${query}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown game", async () => {
    const res = await fetch(`${baseUrl}/game/legal-moves?gameId=missing&row=6&col=4`);

    expect(res.status).toBe(404);
  });
});

# Chess

A full-stack chess app. Play against friends in real time, against a Stockfish bot at several difficulty levels, or alone on a shared board. Games are timed or untimed, and every finished game is stored with its full move list and appears in your game history.

## Features

- **Play with a friend**: send an invite by username, choose the time control and your color, and the game starts when they accept. Moves sync in real time through Supabase Realtime.
- **Play with the bot**: pick a difficulty and a color. The bot answers each move using Stockfish. Restarting after a game ends keeps the same settings.
- **Play alone**: a local board for analysing both sides, with timed or untimed clocks.
- **Full rules**: castling, en passant, promotion, check and checkmate, stalemate, insufficient material, and threefold repetition.
- **Clocks**: server-authoritative time controls. Flagging ends the game on time.
- **Resignation**: either player can resign a game.
- **Board flipping**: a player seated as black sees the board from their side.
- **Game history**: finished games with the result, end reason, opponent, and time control.
- **Accounts**: sign up and log in with Supabase Auth. Each user can change their username.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Auth and realtime | Supabase (Auth and Realtime) |
| Chess engine | Custom rules engine (`backend/src/game`), Stockfish for bot moves |
| Testing | Vitest |

## Project structure

```
chess/
├── backend/
│   ├── prisma/            # Prisma schema and migrations
│   ├── src/
│   │   ├── bot/           # Stockfish worker and difficulty levels
│   │   ├── controllers/   # Game, invite, auth, profile and history handlers
│   │   ├── game/          # Board, rules, clocks and time controls
│   │   ├── pieces/        # Piece move generation
│   │   ├── routs/         # API routes
│   │   └── server.ts      # Express entry point
│   ├── lib/               # Prisma, Supabase, session cookie and username helpers
│   ├── middleware/        # Auth middleware
│   └── tests/             # Vitest test files
└── frontend/
    ├── public/            # Static assets and piece themes
    └── src/
        ├── components/    # Board, game overlay, home modals, shared UI
        ├── constants/     # Time controls and color options
        ├── lib/           # API helpers, Supabase clients, realtime subscriptions
        └── pages/         # Home, Game, Login, Signup, AuthCallback
```

## Getting started

### Prerequisites

- Node.js 20 or newer
- A PostgreSQL database
- A Supabase project (for authentication and realtime)

### 1. Install dependencies

```bash
# backend and shared tooling (from the repository root)
npm install

# frontend
cd frontend
npm install
cd ..
```

### 2. Configure environment variables

Create `backend/.env` with:

| Variable | Purpose |
| --- | --- |
| `PORT` | Port for the API server (defaults to `3000`) |
| `DATABASE_URL` | PostgreSQL connection string used by the app |
| `DIRECT_URL` | Direct PostgreSQL connection string used for migrations |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `SUPABASE_PASSWORD` | Database password for your Supabase project |

Create `frontend/.env.local` with:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |

Keep these files out of version control. `.env` is already listed in `.gitignore`.

### 3. Set up the database

```bash
cd backend
npx prisma migrate deploy
```

### 4. Run the app

Start the backend from the repository root:

```bash
npm run dev
```

In a second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). During development, Vite proxies `/api` requests to the backend on port `3000`.

## Scripts

| Command | Location | What it does |
| --- | --- | --- |
| `npm run dev` | repository root | Starts the Express API with `backend/.env` |
| `npm test` | repository root | Runs the Vitest suite in `backend/tests` |
| `npm run dev` | `frontend/` | Starts the Vite dev server |
| `npm run build` | `frontend/` | Type-checks and builds the frontend for production |
| `npm run lint` | `frontend/` | Runs ESLint on the frontend |

## How it works

- **Authoritative server**: the backend validates every move with the rules engine and owns the clocks. The client only shows the board the server returns.
- **Realtime updates**: after a move, the server broadcasts it on the game's Supabase Realtime channel. The opponent's client applies the move without reloading.
- **Bot games**: the server picks the bot's reply before saving anything, so an engine failure leaves the game unchanged.
- **Game storage**: each game and its moves are saved in PostgreSQL through Prisma. Replaying the saved moves rebuilds the board on every load.

## Deployment

The frontend is set up for Vercel (`frontend/vercel.json`). It rewrites `/api/*` to the hosted backend and sends all other routes to `index.html` so client-side routing works. The backend runs as a Node.js service and needs the variables listed above.

## Tests

```bash
npm test
```

The suite covers the rules engine, time controls, the Stockfish engine wrapper, and the API server.

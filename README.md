# GameVerse — Multiplayer Gaming Platform

A production-grade, real-time multiplayer gaming platform built with **Next.js**, **NestJS**, **Socket.IO**, **PostgreSQL**, and **Redis**. Bingo is the first game; the architecture is designed to support many future games.

---

## Architecture

```
┌────────────────────┐      ┌────────────────────┐
│   Next.js 14       │◄────►│   NestJS 10        │
│   (App Router)     │ WS   │   (REST + WS)      │
│   Port 3000        │      │   Port 3001         │
└────────────────────┘      └──────┬───────┬──────┘
                                   │       │
                             ┌─────┘       └─────┐
                             ▼                   ▼
                      ┌────────────┐      ┌────────────┐
                      │  PostgreSQL│      │   Redis    │
                      │  Port 5432 │      │  Port 6379 │
                      └────────────┘      └────────────┘
```

- **Server-authoritative**: All game state lives on the server; clients receive only their own view.
- **WebRTC voice chat**: Peer-to-peer mesh topology (≤ 8 players), signaling through Socket.IO.
- **Extensible game engine**: Implement `IGameEngine<TState, TMove, TPlayerView, TWinResult>` and register it.

---

## Prerequisites

| Tool    | Version |
|---------|---------|
| Node.js | 20+     |
| npm     | 10+     |
| Docker  | 24+     |

---

## Quick Start (Docker)

```bash
# 1. Clone & enter the project
cd multiplayer-games

# 2. Copy env file and adjust if needed
cp .env.example .env

# 3. Start everything
docker compose up -d

# Frontend → http://localhost:3000
# Backend  → http://localhost:3001
```

---

## Local Development

```bash
# 1. Install dependencies (from project root)
npm install

# 2. Start infrastructure (Postgres + Redis)
docker compose up -d postgres redis

# 3. Copy env file
cp .env.example .env

# 4. Start all apps in dev mode (hot reload)
npm run dev
```

| App      | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:3000    |
| Backend  | http://localhost:3001    |

### Individual app commands

```bash
# Backend only
npm run dev --workspace=apps/backend

# Frontend only
npm run dev --workspace=apps/frontend

# Build all
npm run build

# Lint all
npm run lint
```

---

## Environment Variables

Copy `.env.example` to `.env` at the project root. Key variables:

| Variable              | Default               | Description                   |
|-----------------------|-----------------------|-------------------------------|
| `DB_HOST`             | `localhost`           | PostgreSQL host               |
| `DB_PORT`             | `5432`                | PostgreSQL port               |
| `DB_USERNAME`         | `gameverse`           | PostgreSQL user               |
| `DB_PASSWORD`         | `gameverse_secret`    | PostgreSQL password            |
| `DB_DATABASE`         | `gameverse`           | PostgreSQL database name      |
| `REDIS_HOST`          | `localhost`           | Redis host                    |
| `REDIS_PORT`          | `6379`                | Redis port                    |
| `JWT_SECRET`          | *(change in prod)*    | JWT signing secret            |
| `JWT_EXPIRATION`      | `24h`                 | Token lifetime                |
| `BINGO_DRAW_INTERVAL` | `4000`                | ms between number draws       |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`| Backend URL for the frontend |
| `NEXT_PUBLIC_WS_URL`  | `http://localhost:3001`| WebSocket URL for the frontend|

---

## Project Structure

```
multiplayer-games/
├── apps/
│   ├── backend/              # NestJS server
│   │   └── src/
│   │       ├── auth/         # JWT guest auth
│   │       ├── user/         # User entity + service
│   │       ├── lobby/        # Lobby REST + WebSocket gateway
│   │       ├── game/         # Game orchestration + engines
│   │       │   └── engines/
│   │       │       └── bingo/  # Bingo engine + utils + tests
│   │       ├── voice/        # WebRTC signaling gateway
│   │       └── redis/        # Redis provider module
│   └── frontend/             # Next.js 14 (App Router)
│       └── src/
│           ├── app/          # Pages (home, games, lobby, play)
│           ├── components/   # UI, bingo, lobby, voice components
│           ├── stores/       # Zustand stores (auth, lobby, game, voice)
│           ├── hooks/        # useSocket, useVoiceChat
│           └── lib/          # Socket.IO client, API helpers
├── packages/
│   └── shared/               # Types, events, constants
│       └── src/
│           ├── types/        # User, Lobby, Game, Bingo interfaces
│           ├── events/       # Socket.IO event name constants
│           └── constants.ts  # Game constants, avatars
├── docker-compose.yml
├── turbo.json
└── .env.example
```

---

## How to Add a New Game

1. **Define types** in `packages/shared/src/types/your-game.ts` and add to the `GameType` enum.

2. **Implement the engine** — create `apps/backend/src/game/engines/your-game/` with a class implementing:
   ```ts
   IGameEngine<YourGameState, YourMove, YourPlayerView, YourWinResult>
   ```

3. **Register it** in `apps/backend/src/game/game-registry.ts`:
   ```ts
   this.engines.set(GameType.YOUR_GAME, new YourGameEngine());
   ```

4. **Add orchestration** in `GameService` for game-specific lifecycle (timers, turns, etc.).

5. **Build the frontend** — create pages under `apps/frontend/src/app/games/your-game/` and game-specific components.

6. **Add the card** to the game selection page at `apps/frontend/src/app/games/page.tsx`.

---

## Running Tests

```bash
# All tests
npm test

# Backend unit tests
npm test --workspace=apps/backend

# Watch mode
npm test --workspace=apps/backend -- --watch
```

---

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | Next.js 14, React 18, TypeScript, TailwindCSS, Zustand, Framer Motion |
| Backend    | NestJS 10, TypeORM, Socket.IO, ioredis           |
| Database   | PostgreSQL 16, Redis 7                           |
| Voice      | WebRTC (mesh), Socket.IO signaling               |
| Build      | Turborepo, Docker Compose                        |
| Security   | Helmet, CORS, JWT, rate limiting, input validation|

---

## License

MIT

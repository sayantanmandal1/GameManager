# GameVerse — Multiplayer Gaming Platform

A real-time multiplayer gaming platform built with **Next.js**, **NestJS**, **Socket.IO**, **PostgreSQL**, and an **Expo/React Native** Android client.

---

## Supported Games

| Game | Players | Notes |
|------|---------|-------|
| Bingo | 2–8 | Custom 5×5 boards with server-authoritative turns and win detection. |
| Ludo | 2–4 | Standard 15×15 board, safe squares, blocks, capture, exact finish, and offline bots. |
| Chess | 2 | `chess.js` rules, optional clocks, spectators, resign, and draw offers. |
| Photobooth | 2 | Synchronized camera session and shared photo strip. |
| UNO | 2–4 | Classic, custom, No Mercy, and Flip modes with per-player private state. |
| Tic Tac Toe | 2 | Classic and three-piece movement modes; online play and local minimax bot. |
| Connect Four | 2 | Server-authoritative gravity and wins; online play and local alpha-beta bot. |
| Sudoku | 1 | Resumable local puzzles with notes, hints, mistakes, timer, and four difficulties. |

---

## Architecture

```
┌────────────────────┐       ┌────────────────────┐
│ Next.js 16 Web     │◄─────►│ NestJS 10 API      │
│ App Router         │ WS    │ REST + Socket.IO   │
└─────────▲──────────┘       └──────────┬─────────┘
      │                             │
┌─────────┴──────────┐                  ▼
│ Expo 57 Mobile     │           ┌───────────────┐
│ Native shell +     │           │ PostgreSQL 16 │
│ same-origin games  │           └───────────────┘
└────────────────────┘
```

- **Server-authoritative**: All game state lives on the server; clients receive only their own view.
- **WebRTC voice chat**: Peer-to-peer mesh topology (≤ 8 players), signaling through Socket.IO.
- **Crossplay**: Android and browser users share the same authentication, lobby, game, and Socket.IO contracts.
- **Secure mobile session**: Guest credentials are stored with the platform keystore via `expo-secure-store`.
- **Extensible game engine**: Implement `IGameEngine<TState, TMove, TPlayerView, TWinResult>` and register it.

---

## Prerequisites

| Tool    | Version |
|---------|---------|
| Node.js | 22.13+  |
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
# Backend  → http://localhost:8000
```

---

## Local Development

```bash
# 1. Install dependencies (from project root)
npm install

# 2. Start infrastructure (Postgres)
docker compose up -d postgres

# 3. Copy env file
cp .env.example .env

# 4. Start all apps in dev mode (hot reload)
npm run dev
```

| App      | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:3000    |
| Backend  | http://localhost:8000    |

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
| `JWT_SECRET`          | *(change in prod)*    | JWT signing secret            |
| `JWT_EXPIRATION`      | `24h`                 | Token lifetime                |
| `BINGO_DRAW_INTERVAL` | `4000`                | ms between number draws       |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`| Backend URL for the frontend |
| `NEXT_PUBLIC_WS_URL`  | `http://localhost:8000`| WebSocket URL for the frontend|
| `NEXT_PUBLIC_TURN_URLS` | *(optional)* | Comma-separated TURN/TURNS relay URLs for reliable voice across restrictive networks |
| `NEXT_PUBLIC_TURN_USERNAME` | *(optional)* | Short-lived browser TURN username |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | *(optional)* | Short-lived browser TURN credential; do not use a long-lived infrastructure secret |

---

## Project Structure

```
GameManager/
├── backend/                  # NestJS API, gateways, engines, migrations
├── frontend/                 # Next.js 16 web application
├── mobileapp/                # Expo 57 native shell + committed Android project
├── .github/workflows/        # Web/backend CI and per-commit APK publishing
└── docker-compose.yml
```

---

## How to Add a New Game

1. **Define mirrored types** in `backend/src/shared/types/` and `frontend/src/shared/types/`, then add the game to `GameType`.

2. **Implement the engine** in `backend/src/game/engines/your-game/` with server-side validation and focused tests.
   ```ts
   IGameEngine<YourGameState, YourMove, YourPlayerView, YourWinResult>
   ```

3. **Register it** in `backend/src/game/game-registry.ts`:
   ```ts
   this.engines.set(GameType.YOUR_GAME, new YourGameEngine());
   ```

4. **Add orchestration** in `GameService` for game-specific lifecycle (timers, turns, etc.).

5. **Build the frontend** under `frontend/src/app/games/your-game/` and game-specific components.

6. **Add the card** to the game selection page at `apps/frontend/src/app/games/page.tsx`.

---

## Running Tests

```bash
# Backend
cd backend
npm test
npm run build

# Frontend
cd ../frontend
npm test
npm run build

# Mobile
cd ../mobileapp
npm run typecheck
npx expo export --platform android
```

## Android APK Releases

`.github/workflows/mobile-apk.yml` runs for every push and pull request. Every pushed commit publishes an installable APK to a prerelease tagged `mobile-<full commit SHA>` and uploads the same APK as a workflow artifact.

For stable production signing, configure the four repository secrets documented in `mobileapp/README.md`. Without them, CI generates a short-lived signer for an installable commit APK.

## Production Checklist

Before directing users to a release:

1. Deploy the current backend image with `npm run start:prod` (the Docker image already does this). Startup applies the advisory-locked migrations before Nest begins accepting traffic.
2. Set `NODE_ENV=production`, a strong `JWT_SECRET`, the PostgreSQL connection values, and `DATABASE_SSL_CA` for verified database TLS.
3. Set `CORS_ORIGIN` to the exact comma-separated browser origins, for example `https://game-manager-two.vercel.app`. Never use `*` with credentials.
4. Build the web app with production `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` values. Confirm `/health` returns `{"status":"ok"}` after deployment.
5. Configure `NEXT_PUBLIC_TURN_URLS`, `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_CREDENTIAL` from a managed TURN provider. STUN-only voice cannot be guaranteed across carrier-grade or symmetric NAT.
6. Configure the four stable Android signing secrets from `mobileapp/README.md`. Ephemeral-signed CI APKs are installable but cannot upgrade one another.
7. Confirm both GitHub Actions workflows pass. `CI` runs all unit/build jobs plus the Dockerized REST/Socket.IO runtime E2E suite; `Mobile APK` builds and attaches the commit APK to a prerelease.

The currently hosted Vercel/Render instances must be redeployed before they represent this worktree; inspecting the live URLs alone only verifies the previous release.

---

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | Next.js 16, React 19, TypeScript, TailwindCSS, Zustand, Framer Motion |
| Backend    | NestJS 10, TypeORM, Socket.IO                    |
| Mobile     | Expo 57, React Native 0.86, SecureStore, WebView |
| Database   | PostgreSQL 16                                    |
| Voice      | WebRTC (mesh), Socket.IO signaling               |
| Build      | Docker Compose, GitHub Actions, Gradle 9.3       |
| Security   | Helmet, CORS, JWT, rate limiting, input validation|

---

## License

MIT

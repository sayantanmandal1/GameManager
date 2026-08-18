# GameVerse — Multiplayer Gaming Platform

A real-time multiplayer gaming platform built with **Next.js**, **NestJS**, **Socket.IO**, **PostgreSQL**, and an **Expo/React Native** Android client.

---

## Supported Games

GameVerse ships **100 multiplayer titles** plus the existing solo Sudoku. The authoritative catalog is served from `GET /games/catalog`; web and mobile consume the same response, so names, routes, player limits, search categories, and presets cannot drift.

| Family | Multiplayer titles | Players | Mechanics |
|--------|-------------------:|---------|-----------|
| Established engines | 20 | 2–8 | Bingo, timed Chess presets, UNO modes, Ludo tables, Photobooth, Tic Tac Toe, and Connect Four. |
| Alignment | 25 | 2 | Configurable boards, target lines, gravity, misère wins, Gomoku sizes, and limited-piece movement. |
| Take-away | 20 | 2 | Nim heaps and single/multi-pile subtraction games with normal or misère endings. |
| Dice race | 20 | 2–4 | Server-generated dice, configurable tracks, exact finishes, and deterministic shortcuts/setbacks. |
| Memory | 15 | 2–4 | Server-hidden decks, verified pair matching, scoring, and turn handoff. |
| Sudoku | 1 solo title | 1 | Resumable local puzzles with notes, hints, mistakes, timer, and four difficulties. |

The game library supports full-text search, category filters, and a global six-digit room join. Every multiplayer completion screen offers unanimous in-room rematch without repeating lobby ready/start steps.

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
- **Catalog-driven**: 100 multiplayer title definitions map to eleven engine families through allow-listed server presets.
- **Private projections**: Hidden Memory tiles and UNO hands are redacted per player; dice are generated server-side.
- **WebRTC voice chat**: Peer-to-peer mesh topology (≤ 8 players), signaling through Socket.IO.
- **Crossplay**: Android and browser users share the same catalog, authentication, lobby, game UI, rematch, and Socket.IO contracts.
- **Secure mobile session**: Guest credentials are stored with the platform keystore via `expo-secure-store`.
- **Self-healing guest sessions**: Expired JWTs or cleaned-up guest rows renew once with the existing username; transient outages do not silently replace identity.

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

# 2. Configure required secrets in your shell or a root .env file
# DATABASE_PASSWORD=<REPLACE_ME>
# JWT_SECRET=<REPLACE_ME>

# 3. Start everything
docker compose up -d

# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
```

---

## Local Development

```bash
# 1. Install dependencies
cd backend && npm ci
cd ../frontend && npm ci
cd ../mobileapp && npm ci
cd ..

# 2. Start infrastructure (Postgres)
docker compose up -d postgres

# 3. Start backend and frontend in separate terminals
cd backend && npm run dev
cd frontend && npm run dev
```

| App      | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:3000    |
| Backend  | http://localhost:8000    |

### Individual app commands

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Build backend and frontend
cd backend && npm run build
cd frontend && npm run build

# Lint backend and frontend
cd backend && npm run lint
cd frontend && npm run lint
```

---

## Environment Variables

Copy `.env.example` to `.env` at the project root. Key variables:

| Variable              | Default               | Description                   |
|-----------------------|-----------------------|-------------------------------|
| `DATABASE_HOST`       | `localhost`           | PostgreSQL host               |
| `DATABASE_PORT`       | `5432`                | PostgreSQL port               |
| `DATABASE_USER`       | `postgres`            | PostgreSQL user               |
| `DATABASE_PASSWORD`   | *(required)*          | PostgreSQL password           |
| `DATABASE_NAME`       | `multiplayer_games`   | PostgreSQL database name      |
| `DATABASE_URL`        | *(optional)*          | Full PostgreSQL connection URL |
| `DATABASE_SSL_CA`     | *(production required)* | Trusted PostgreSQL CA certificate |
| `JWT_SECRET`          | *(change in prod)*    | JWT signing secret            |
| `JWT_EXPIRATION`      | `7d`                  | Token lifetime                |
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

1. Prefer adding a validated preset to `backend/src/shared/game-catalog.ts` when an existing family already supports the mechanics. The backend catalog test enforces stable unique keys/routes and valid player limits.
2. For a new family, implement its authoritative engine under `backend/src/game/engines/`, including untrusted-action validation, per-player projection, terminal result, and focused rule tests.
3. Register only the family engine in `backend/src/game/game-registry.ts`; do not add one gateway namespace or state map per title.
4. Add mirrored transport types and one family renderer/store in the frontend. Mobile consumes the same catalog and shared web game route automatically.
5. Extend `frontend/scripts/runtime-e2e.js` with a real lobby/start/action/result flow for the family.

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

# Production-like REST and Socket.IO flow (100-title catalog, all families,
# rematch, reconnect, existing games, and voice signaling)
cd ../frontend
npm run test:e2e:runtime
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

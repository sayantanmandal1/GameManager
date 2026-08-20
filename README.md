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
| Reversi | 2 | Standard 8x8 bracketing, eight-direction flips, automatic passes, and count scoring. |
| Checkers | 2 | English draughts with mandatory captures, multi-jumps, kings, and blocked-player wins. |
| Mancala | 2 | Kalah with six pits, store skipping, opposite capture, extra turns, and terminal sweep. |
| Dots and Boxes | 2 | A 4x4 box board with unique edges, double-box claims, and scoring turns. |
| Pig | 2 | Server-generated d6 rolls, busts, holds, and a race to 100 points. |
| Grid Salvo | 2 | Private 10x10 fleet placement, alternating shots, hits, sunk ships, and fleet elimination. |
| Peg Codebreaker | 2 | Private four-color code, duplicate-aware feedback, and a ten-guess limit. |
| Hangman | 2–8 | Private host phrase, rotating guessers, and a shared eight-miss limit. |
| Go Fish | 2–5 | Shuffled 52-card deck, rank requests, private hands, books, and score resolution. |
| Crazy Eights | 2–5 | Ordinary cards, suit/rank matching, suit-changing eights, and draw play. |
| Five-Dice Yacht | 2–8 | Three-roll turns and thirteen standard scorecard categories. |
| Liar's Dice | 2–6 | Private dice, ascending bids, challenges, die loss, and elimination rounds. |
| Farkle | 2–8 | Standard scoring groups, hot dice, entry threshold, and a 10,000-point final round. |
| Shut the Box | 2–4 | Per-player tiles, exact roll combinations, and lowest open-tile score. |
| Draw Dominoes | 2–4 | Double-six draw set, oriented open-end play, and blocked pip scoring. |
| Hearts | 4 | Full 52-card deal, rotating passes, broken hearts, moon shots, and lowest score at 100. |
| Spades | 4 | Fixed partnerships, individual bids, nils, bags, trump control, and a 500-point target. |
| Gin Rummy | 2 | Private hands, optimal meld/deadwood analysis, layoffs, gin, undercuts, and rounds to 100. |
| Card War | 2 | Server-driven battles, three-down wars on ties, and complete-deck elimination. |
| Old Maid | 2–8 | A 51-card deck, automatic pair removal, hidden-index draws, safe ranking, and one unmatched queen. |
| Hex | 2 | Standard 11x11 connection board with top-bottom and left-right paths. |
| Nine Men's Morris | 2 | Standard 24-node graph, sixteen mills, removals, adjacent movement, and three-stone flying. |
| Cee-lo | 2–8 | Traditional banker-versus-challenger qualifying rolls with points, triples, 4-5-6, and 1-2-3. |
| Trivia Quiz Bowl | 2–10 | Ten server-selected questions from an original 40-question bank with simultaneous private answers. |
| Memory Match | 2–4 | One 24-tile field, extra turns on matches, visible mismatch acknowledgment, and pair scoring. |
| Contract Bridge | 4 | Rubber, Duplicate, and custom Home scoring with complete auction, dummy control, trick play, session scoring, and chosen partnerships. |
| Bourré | 2–7 | Strict Louisiana obligations, dealer decisions, redraws, cinch play, split pots, and bourré matching. |
| Bluff | 2–8 | Face-down claims, forced rank sequence, challenges, pile collection, and private card identities. |
| Sevens | 3–8 | Mandatory seven-of-hearts opening, adjacent suit building, forced passes, and cumulative rounds. |
| Ninety-Nine | 2–8 | Three-card hands, standard special-rank values, token loss, elimination, and automatic redraws. |
| Euchre | 4 | Two-round trump auction, bowers, lone hands, dealer discard, selected partnerships, and play to ten. |
| Whist | 4 | Full thirteen-card deal, exposed dealer trump, selected partnerships, legal trick play, and odd-trick scoring. |
| Oh Hell | 3–7 | Complete 7–1–7 deal schedule, dealer hook, exact bids, trump tricks, and cumulative scoring. |
| President | 3–8 | Equal-group climbing, re-enterable passes, complete ranking, title exchange, and eight scored rounds. |
| Slapjack | 2–8 | Server-ordered flips and slap windows, false-slap penalties, recovery chances, and hidden stacks. |
| Spoons | 3–8 | Continuous pass pipeline, quartet-triggered spoon rush, letters, elimination, and private hands. |

The library contains **44 implemented games**: the original eight plus 36 separately registered multiplayer rules engines. Global six-digit room joining works across the library, and every multiplayer completion screen offers unanimous in-room rematch without repeating lobby ready/start steps. Bridge, Hearts, Spades, Euchre, and Whist use one responsive felt table with three hidden opponent hands and the local hand face-up. Bridge, Spades, Euchre, and Whist require players to choose balanced two-versus-two partnerships in the lobby before the host can start.

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
- **Distinct-game framework**: Thirty-six games use one lifecycle and Socket.IO namespace while retaining separate engines, strongly typed contracts, and unique ruleset IDs.
- **Private projections**: Hands, fleets, secret codes, phrases, and dice are redacted per player; all random outcomes are generated server-side.
- **Shared catalog**: `GET /games/catalog` is the source for the web and mobile 44-game shelves; lobby records persist the validated distinct-game key.
- **WebRTC voice chat**: Peer-to-peer mesh topology (≤ 8 players), signaling through Socket.IO.
- **Crossplay**: Android and browser users share the same 44-game library, authentication, lobby, game UI, rematch, and Socket.IO contracts.
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

1. Implement a dedicated authoritative rules engine under `backend/src/game/engines/`. A mode, board-size change, timer, theme, or scoring preset does not count as a new game.
2. Add focused rule-conformance tests for setup, legal/illegal actions, hidden information, terminal states, surrender, and reconnect projection.
3. Register the game in `GameRegistry`, assign a unique ruleset ID, and expose it through the distinct-game lifecycle and per-player projection path.
4. Build its dedicated web interaction surface and expose the same route through the mobile crossplay shell.
5. Add a real lobby/start/action/result flow to `frontend/scripts/runtime-e2e.js` before displaying the game in the production shelf.

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

# Production-like REST and Socket.IO flow (44-entry catalog, rematch,
# reconnect, all multiplayer games, and voice signaling)
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
5. Voice uses direct peer-to-peer WebRTC with public STUN discovery and requires microphone permission in the browser or mobile WebView.
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

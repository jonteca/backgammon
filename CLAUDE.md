# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (from project root)
npm run dev        # Vite dev server at localhost:3000
npm run build      # production build → dist/
npm run preview    # preview production build

# Backend (from server/)
cd server && npm start   # Express + WS server at localhost:3001
```

Vite proxies `/api` and `/ws` to `localhost:3001` in dev mode.

WildBG is an external backgammon engine binary (not in this repo). The server loads it via koffi FFI (`server/wildbg-ffi.js`).

## Architecture

### Local Development
Vite dev server (`:3000`) → Express + WebSocket server (`:3001`) → WildBG FFI.

### Discord Activity
When embedded in Discord, the app authenticates via OAuth2 (`src/discord.js` → `POST /api/token`) and connects via WebSocket (`/ws`) for multiplayer.

### State Management

`src/logic/store.jsx` — React Context + `useReducer` is the single source of truth. Supports dual-mode:
- **Local mode** (`mode: "local"`): AI loop driven by `useEffect` hooks, all actions dispatched locally.
- **Online mode** (`mode: "online"`): Server-authoritative via `SYNC_STATE`. AI effects disabled; actions sent over WebSocket via `wsSend()`.

Key actions: `NEW_GAME`, `ROLL`, `SELECT`, `MOVE`, `SET_AI_PLAYERS`, `SET_AI_TYPE`, `AI_ERROR`, `PASS_TURN`, `SYNC_STATE`, `SET_ONLINE`.

### Board Coordinate System

28-slot array matching WildBG's layout:
- **Index 1–24**: board points
- **Index 0**: white's bar / black's bear-off destination
- **Index 25**: black's bar / white's bear-off destination
- **Index 26**: black borne-off pile
- **Index 27**: white borne-off pile

Each slot: `{ colour: "black"|"white"|null, n: <count> }`.

Black moves 24→1 (direction -1), home board 1–6. White moves 1→24 (direction +1), home board 19–24. Defined in `src/logic/constants.js`.

### Move Generation

`src/logic/generateMoves.js` — recursive DFS enumerates all valid move sequences using all dice. Returns array of sequences, each being `[{from, to, pip}, ...]`. Handles bar entry (`entryMoves`), bearing off, and doubles (4 moves via `[d,d,d,d]`). `applyMove` mutates a cloned board.

### AI System

`src/ai/aiManager.js` — `getBestMove()` routes to WildBG (HTTP) or falls back to local expectiminimax (`src/ai/ai.js`). Local AI is depth-1 with all 21 dice rolls weighted by probability; caps at 120 sequences before falling back to greedy.

`src/ai/wildbg.js` — calls `/api/best-move` (relative URL, proxied to server). Server uses koffi FFI to call WildBG native library.

### Multiplayer

`server/rooms.js` — Room manager keyed by Discord `instanceId`. Each room has a `Game` instance, player assignments (black/white by join order), doubling cube state, and connected WebSocket clients.

`src/hooks/useMultiplayer.js` — React hook: WebSocket connection with exponential backoff reconnect. Auto-joins room using instanceId + userId.

`src/hooks/multiplayerSend.js` — Global `wsSend()` function shared between components and the WS hook.

WebSocket protocol: `join`, `roll`, `move`, `pass`, `offer_double`, `accept_double`, `decline_double`, `new_game`. Server validates sender is current player, applies to Game, broadcasts state.

### UI

`src/components/Board2D.jsx` — CSS Grid board renderer with inline styles. Responsive scaling via `ResizeObserver` + `transform: scale()`. Points layout: top `[24..19]` `[18..13]`, bottom `[1..6]` `[7..12]`.

`src/components/GameUI.jsx` — control panel (roll, AI toggles, new game). Hides AI controls in online mode. Shows "Waiting for opponent..." when solo.

`src/components/Dice.jsx` — animated dot-grid dice.

### Discord Integration

`src/discord.js` — Discord Embedded App SDK wrapper. Handles `isDiscordEmbedded()` detection, OAuth2 flow (`initDiscord()`), instance ID, participant tracking.

`src/App.jsx` — Mounts `MultiplayerBridge` component when in Discord, which connects `useMultiplayer` hook to store dispatch.

### Legacy/Unused

`src/Board.js`, `src/components/CheckerMesh.jsx`, `src/components/PointMesh.jsx`, `src/components/coords.js` — abandoned 3D React Three Fiber approach. `src/DebugBoard.jsx` — visual debug layout tool.

## Conventions

- Plain JavaScript/JSX, no TypeScript
- Vite + `@vitejs/plugin-react` (migrated from CRA)
- Inline styles throughout Board2D.jsx (no CSS classes for board layout)
- `structuredClone` for board deep-copies with `JSON.parse/JSON.stringify` fallback
- `MOVE_DELAY = 600ms` in store.jsx controls AI move pacing, auto-roll delay, and roll animation timing
- AI errors are caught and surfaced to UI via `lastError` state, never crash the app
- Environment variables: `VITE_DISCORD_CLIENT_ID` (frontend), `DISCORD_CLIENT_SECRET` (server)
- Production: `NODE_ENV=production` makes server serve `dist/` as static files

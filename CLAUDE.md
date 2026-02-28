# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (from project root)
npm start          # dev server at localhost:3000
npm run build      # production build
npm test           # tests in watch mode

# Backend proxy (from server/)
cd server && npm start   # proxy at localhost:3001 → WildBG at localhost:8080
```

Source maps are disabled in both start and build scripts (`GENERATE_SOURCEMAP=false`).

WildBG is an external backgammon engine binary (not in this repo) expected at `localhost:8080`. The Express proxy in `server/` relays requests to it.

## Architecture

Three-process local setup: React app (`:3000`) → Express proxy (`:3001`) → WildBG engine (`:8080`).

### State Management

`src/logic/store.js` — React Context + `useReducer` is the single source of truth. Exposes `GameProvider` and `useGame` hook. Two `useEffect` hooks drive the AI loop: one triggers AI move calculation when `isAiThinking`, another auto-rolls dice for AI players.

Key actions: `NEW_GAME`, `ROLL`, `SELECT`, `MOVE`, `AI_DONE`, `SET_AI_PLAYERS`, `SET_AI_TYPE`, `AI_ERROR`, `PASS_TURN`.

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

`src/ai/wildbg.js` — converts the 28-slot board to WildBG's signed 26-element array (positive=black, negative=white), validates 15 checkers per side, translates response back.

### UI

`src/components/Board2D.jsx` — CSS Grid board renderer with inline styles. Points are laid out: top `[24..19]` `[18..13]`, bottom `[1..6]` `[7..12]`.

`src/components/GameUI.jsx` — control panel (roll, AI toggles, new game). `src/components/Dice.jsx` — animated dot-grid dice.

### Legacy/Unused

`src/Board.js`, `src/components/CheckerMesh.jsx`, `src/components/PointMesh.jsx`, `src/components/coords.js` — abandoned 3D React Three Fiber approach. `src/DebugBoard.jsx` — visual debug layout tool.

## Conventions

- Plain JavaScript/JSX, no TypeScript
- Inline styles throughout Board2D.jsx (no CSS classes for board layout)
- `structuredClone` for board deep-copies with `JSON.parse/JSON.stringify` fallback
- `MOVE_DELAY = 600ms` in store.js controls AI move pacing, auto-roll delay, and roll animation timing
- AI errors are caught and surfaced to UI via `lastError` state, never crash the app

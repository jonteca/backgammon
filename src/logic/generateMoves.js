/* ------------------------------------------------------------------ */
/*  generateMoves.js – WildBG index layout                             */
/*     24…1 board points • 0/25 bars • 26/27 borne-off                 */
/* ------------------------------------------------------------------ */

import { destOpen, inHome }         from "./helpers";
import { DIRECTION, BAR, BEAR_OFF } from "./constants";

/* safest cross-browser clone -------------------------------------- */
const clone = (obj) =>
  typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

/* =========================== BAR ENTRY =========================== */
export function entryMoves(board, player, dice) {
  const bar   = BAR[player];
  const moves = [];

  (function rec(state, diceLeft, path) {
    if (state[bar].n === 0 || !diceLeft.length) {
      if (path.length) moves.push(path);
      return;
    }

    const seen = new Set();                               // skip dup die
    for (let i = 0; i < diceLeft.length; i++) {
      const pip = diceLeft[i];
      if (seen.has(pip)) continue;
      seen.add(pip);

      const to = player === "black" ? 25 - pip : pip;     // 1-24
      if (to < 1 || to > 24) continue;
      if (!destOpen(state, player, to)) continue;

      const next = clone(state);
      applyMove(next, player, bar, to);

      const rem = diceLeft.slice();
      rem.splice(i, 1);
      rec(next, rem, [...path, { from: bar, to, pip }]);  // ← no dieIdx
    }
  })(board, dice, []);

  return moves;
}

/* ---------- helpers specific to bearing-off ---------------------- */
const getPointNumber = (player, idx) =>
  player === "black" ? idx : 25 - idx;          // 1–6 within home board

const highestOccupiedHome = (player, points) =>
  points
    .filter(pt => inHome(player, pt))
    .map(pt => getPointNumber(player, pt))
    .reduce((m, v) => Math.max(m, v), 0);

/* ========================== MAIN SEARCH ========================== */
export default function generateMoves(board, player, dice) {
  const bar = BAR[player];
  if (board[bar].n) return entryMoves(board, player, dice);

  const moves = [];

  (function rec(state, diceLeft, path) {
    if (!diceLeft.length) {
      if (path.length) moves.push(path);
      return;
    }

    const pts = state
      .map((p, idx) => ({ ...p, idx }))
      .filter(p => p.n && p.colour === player && p.idx >= 1 && p.idx <= 24)
      .map(p => p.idx);

    if (!pts.length) return;

    const dir      = DIRECTION[player];
    const allHome  = pts.every(pt => inHome(player, pt));
    const seenFace = new Set();

    for (let di = 0; di < diceLeft.length; di++) {
      const pip = diceLeft[di];
      if (seenFace.has(pip)) continue;
      seenFace.add(pip);

      for (const from of pts) {
        let to      = from + dir * pip;
        let usedPip = pip;                         // actual distance recorded

        /* ---------- bearing-off rules ---------- */
        if (to < 1 || to > 24) {
          if (!allHome) continue;

          const pointNo   = getPointNumber(player, from);   // 1-6
          const highest   = highestOccupiedHome(player, pts);

          if (pip === pointNo || pip > highest) {
            to      = BEAR_OFF[player];
            usedPip = pointNo;                 // distance actually travelled
          } else {
            continue;
          }
        }

        if (to >= 1 && to <= 24 && !destOpen(state, player, to)) continue;

        const next = clone(state);
        applyMove(next, player, from, to);

        const rem = diceLeft.slice();
        rem.splice(di, 1);
        rec(next, rem, [...path, { from, to, pip: usedPip }]); // ← no dieIdx
      }
    }
  })(board, dice, []);

  return moves;
}

/* ============================ APPLY ============================== */
export function applyMove(board, player, from, to) {
  const opBar = BAR[player === "black" ? "white" : "black"];

  /* leave origin */
  board[from].n -= 1;
  if (!board[from].n) board[from].colour = null;

  /* borne-off ----------------------------------------------------- */
  if (to === BEAR_OFF[player]) {
    const offIdx = player === "black" ? 26 : 27;
    board[offIdx].colour ??= player;
    board[offIdx].n += 1;
    return;
  }

  /* hit blot ------------------------------------------------------ */
  if (board[to].n === 1 && board[to].colour !== player) {
    board[opBar].colour = board[to].colour;
    board[opBar].n += 1;
    board[to] = { colour: null, n: 0 };
  }

  /* land ---------------------------------------------------------- */
  board[to].colour = player;
  board[to].n += 1;
}

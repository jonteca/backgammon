/* ------------------------------------------------------------------ */
/*  ai.js – CJS port of src/ai/* for the CLI game server              */
/*  Combines evaluate, chooseBestMove, wildBestMove, getBestMove      */
/* ------------------------------------------------------------------ */

const fetch = require('node-fetch');
const { generateMoves, applyMove } = require('./game');

/* ======================== CONSTANTS ================================ */
const DIRECTION = { black: -1, white: 1 };
const HOME      = { black: [6, 1], white: [19, 24] };

/* ======================== HELPERS ================================== */
const clone = (obj) => JSON.parse(JSON.stringify(obj));

/* ======================== EVALUATE ================================= */
/* From src/ai/ai.js — board evaluation heuristic                     */
function evaluate(board, player) {
  const bar    = player === "black" ? 25 : 0;
  const off    = player === "black" ? 26 : 27;
  const opBar  = player === "black" ? 0  : 25;
  const opOff  = player === "black" ? 27 : 26;
  const dir    = DIRECTION[player];
  const home   = HOME[player];
  const opHome = HOME[player === "black" ? "white" : "black"];

  let s = 0;

  s += board[off].n   * 40;
  s -= board[bar].n   * 40;
  s -= board[opOff].n * 40;
  s += board[opBar].n * 40;

  const dist = idx =>
    idx >= 26 ? 0 : player === "black" ? idx : 25 - idx;

  const myPips = board.reduce(
    (acc, p, i) => p.colour === player ? acc + p.n * dist(i) : acc, 0);
  const opPips = board.reduce(
    (acc, p, i) => p.colour && p.colour !== player ? acc + p.n * dist(i) : acc, 0);

  s -= myPips * 0.2;
  s += opPips * 0.2;

  for (let i = 1; i <= 24; i++) {
    const pt = board[i];
    if (!pt.n) continue;

    if (pt.colour === player) {
      if (pt.n >= 2) {
        s += 5;
        const nxt = i + dir;
        if (nxt >= 1 && nxt <= 24 && board[nxt].colour === player && board[nxt].n >= 2)
          s += 3;
      }
      if (i >= home[0] && i <= home[1]) s += 2;
    } else {
      if (pt.n === 1) s += 3;
      if (pt.n >= 2 && i >= opHome[0] && i <= opHome[1]) s -= 2;
    }
  }
  return s;
}

/* ======================== LOCAL AI ================================= */
/* From src/ai/ai.js — expectiminimax depth-1                        */

const afterSeq = (b, pl, seq) => {
  const c = clone(b);
  seq.forEach(m => applyMove(c, pl, m.from, m.to));
  return c;
};

const rolls = [
  [1,1,1],[2,2,1],[3,3,1],[4,4,1],[5,5,1],[6,6,1],
  [1,2,2],[1,3,2],[1,4,2],[1,5,2],[1,6,2],
  [2,3,2],[2,4,2],[2,5,2],[2,6,2],
  [3,4,2],[3,5,2],[3,6,2],
  [4,5,2],[4,6,2],
  [5,6,2]
];

function chooseBestMove(board, player, myMoves) {
  if (!myMoves.length) return null;

  const MAX_BRANCHES = 120;
  if (myMoves.length > MAX_BRANCHES) {
    let best = myMoves[0], bestScore = -Infinity;
    for (const seq of myMoves) {
      const sc = evaluate(afterSeq(board, player, seq), player);
      if (sc > bestScore) { bestScore = sc; best = seq; }
    }
    return best;
  }

  const opp = player === "black" ? "white" : "black";
  let bestSeq = myMoves[0];
  let bestEV  = -Infinity;

  for (const seq of myMoves) {
    const afterMine = afterSeq(board, player, seq);
    let total = 0, wSum = 0;

    for (const [d1, d2, w] of rolls) {
      const oppDice = d1 === d2 ? [d1,d1,d1,d1] : [d1,d2];
      const oppMoves = generateMoves(afterMine, opp, oppDice);

      let worst = Infinity;
      if (!oppMoves.length) {
        worst = evaluate(afterMine, player);
      } else {
        for (const oSeq of oppMoves) {
          const afterOpp = afterSeq(afterMine, opp, oSeq);
          worst = Math.min(worst, evaluate(afterOpp, player));
        }
      }
      total += worst * w;
      wSum  += w;
    }

    const ev = total / wSum;
    if (ev > bestEV) { bestEV = ev; bestSeq = seq; }
  }
  return bestSeq;
}

/* ======================== WILDBG CLIENT ============================ */
/* From src/ai/wildbg.js — HTTP wrapper for WildBG engine             */

const BAR_X = 0;
const BAR_O = 25;
const OFF_X = 25;
const OFF_O = 0;

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function boardToParams(board) {
  const slot = (i) => board[i] ?? { n: 0 };

  board.forEach((s, i) => {
    assert(Number.isInteger(s.n) && s.n >= 0,
      `Invalid board slot #${i}: ${JSON.stringify(s)}`);
    if (s.n > 0)
      assert(s.colour === "black" || s.colour === "white",
        `Slot ${i} has checkers but colour is ${s.colour}`);
  });

  const signed = Array(26).fill(0);

  for (let i = 1; i <= 24; i++) {
    const p = slot(i);
    if (p.n) signed[i] = p.colour === "black" ? p.n : -p.n;
  }

  signed[BAR_X] += slot(25).n;
  signed[BAR_O] -= slot(0).n;
  signed[OFF_X] += slot(26).n;
  signed[OFF_O] -= slot(27).n;

  const totalX = signed.reduce((s, v) => v > 0 ? s + v : s, 0);
  const totalO = signed.reduce((s, v) => v < 0 ? s - v : s, 0);
  assert(totalX === 15 && totalO === 15,
    `Checker count mismatch (x ${totalX} / o ${totalO})`);

  const qs = new URLSearchParams();
  signed.forEach((v, i) => { if (v) qs.append(`p${i}`, v); });
  return qs;
}

function translate({ from, to }) {
  if (from === BAR_X) from = 25;
  else if (from === BAR_O) from = 0;

  if (to === BAR_X)       to = 25;
  else if (to === BAR_O)  to = 0;
  else if (to === OFF_X)  to = 26;
  else if (to === OFF_O)  to = 27;

  const pip =
    to === 26 ? from :
    to === 27 ? 25 - from :
    Math.abs(from - to);

  return { from, to, pip };
}

async function wildBestMove(
  board, diceFaces, player,
  endpoint = "http://localhost:8080/move",
  ply = 1
) {
  assert(Array.isArray(diceFaces) && diceFaces.length >= 2,
    `Dice array must have at least two faces: ${JSON.stringify(diceFaces)}`);

  const [d1, d2] = diceFaces;
  [d1, d2].forEach(d =>
    assert(Number.isInteger(d) && d >= 1 && d <= 6, `Die out of range: ${d}`));

  const doubles = d1 === d2;

  const url = new URL(endpoint);
  url.searchParams.set("die1", d1);
  url.searchParams.set("die2", doubles ? d1 : d2);
  url.searchParams.set("ply", ply);
  url.searchParams.set("player", player === "black" ? "x" : "o");
  url.search += "&" + boardToParams(board).toString();

  const r   = await fetch(url);
  const txt = await r.text();
  if (!r.ok) {
    let msg = txt;
    try { msg = JSON.parse(txt).error || txt; } catch { /* ignore */ }
    throw new Error(`WildBG ${r.status}: ${msg}`);
  }

  let data;
  try { data = JSON.parse(txt); }
  catch { throw new Error("WildBG returned non-JSON: " + txt.slice(0, 200)); }

  if (!data.moves?.length) return [];

  return data.moves[0].play.map(m => translate(m));
}

/* ======================== GET BEST MOVE ============================ */
/* From src/ai/aiManager.js — routes to WildBG or local AI            */

const AI_TYPES = { WILDBG: "wildbg", LOCAL: "local" };

function firstTwoFaces(dice) {
  if (!dice?.length) throw new Error("No dice provided");
  return dice.length === 1 ? [dice[0], dice[0]] : [dice[0], dice[1]];
}

function ensurePip(m) {
  if ("pip" in m) return m;
  const pip = m.die ?? m.distance ?? Math.abs(m.from - m.to);
  return { from: m.from ?? m.src, to: m.to ?? m.dst, pip };
}

async function getBestMove(board, dice, player, aiType = AI_TYPES.WILDBG) {
  try {
    if (aiType === AI_TYPES.WILDBG) {
      try {
        const faces = firstTwoFaces(dice);
        const seq   = await wildBestMove(board, faces, player);
        return seq.map(ensurePip);
      } catch (netErr) {
        console.error("[WildBG] failed, falling back to local AI:", netErr.message);
        aiType = AI_TYPES.LOCAL;
      }
    }

    if (aiType === AI_TYPES.LOCAL) {
      const allMoves = generateMoves(board, player, dice);
      if (!allMoves?.length) {
        console.log("[LOCAL AI] no legal moves for", player);
        return [];
      }
      const bestSeq = chooseBestMove(board, player, allMoves) || [];
      return bestSeq.map(ensurePip);
    }

    throw new Error(`Unknown AI type '${aiType}'`);

  } catch (err) {
    console.error(`AI error (${aiType}):`, err.message);
    return [];
  }
}

/* ======================== EXPORTS ================================== */
module.exports = { getBestMove, AI_TYPES };

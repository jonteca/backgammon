/* ------------------------------------------------------------------ */
/*  ai.js – CJS port of src/ai/* for the CLI game server              */
/*  Combines evaluate, chooseBestMove, wildBestMove, getBestMove      */
/* ------------------------------------------------------------------ */

const { generateMoves, applyMove } = require('./game');
const ffi = require('./wildbg-ffi');

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

/* ======================== WILDBG FFI =============================== */
/* Calls wildbg-c shared library directly via koffi FFI               */

function wildBestMove(board, diceFaces, player) {
  if (!ffi) throw new Error('WildBG FFI not available (libwildbg.dylib not loaded)');

  const [d1, d2] = diceFaces;
  return ffi.bestMove(board, d1, d2, player);
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
      } catch (ffiErr) {
        console.error("[WildBG] failed, falling back to local AI:", ffiErr.message);
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

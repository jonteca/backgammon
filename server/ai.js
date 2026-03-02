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
/* Position-weighted made-point values (from player's perspective).    */
/* Index = point number from player's view (1=ace..24=deep back).     */
/* Based on pubeval contact weights (Tesauro 1992), rescaled.         */
const MADE_PT = [
  0,   //  0 unused
  4,   //  1 ace point — decent but traps checkers
  5,   //  2
  7,   //  3
  9,   //  4 inner board — very good
  10,  //  5 golden point — best
  9,   //  6 bar point — very good
  7,   //  7
  6,   //  8
  6,   //  9
  5,   // 10
  5,   // 11
  5,   // 12
  4,   // 13
  3,   // 14
  3,   // 15
  2,   // 16
  2,   // 17
  2,   // 18
  1,   // 19
  1,   // 20 deep anchor territory
  0,   // 21
  -1,  // 22
  -2,  // 23
  -3   // 24 deepest back — trapped, negative value
];

/* Map board index to player-relative point number (1-24) */
function playerPt(player, idx) {
  return player === "black" ? idx : 25 - idx;
}

function evaluate(board, player) {
  const bar    = player === "black" ? 25 : 0;
  const off    = player === "black" ? 26 : 27;
  const opBar  = player === "black" ? 0  : 25;
  const opOff  = player === "black" ? 27 : 26;
  const dir    = DIRECTION[player];
  const opp    = player === "black" ? "white" : "black";
  const homeMin = Math.min(HOME[player][0], HOME[player][1]);
  const homeMax = Math.max(HOME[player][0], HOME[player][1]);
  const opHomeMin = Math.min(HOME[opp][0], HOME[opp][1]);
  const opHomeMax = Math.max(HOME[opp][0], HOME[opp][1]);

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
        s += MADE_PT[playerPt(player, i)];
        const nxt = i + dir;
        if (nxt >= 1 && nxt <= 24 && board[nxt].colour === player && board[nxt].n >= 2)
          s += 3;
      }
      if (i >= homeMin && i <= homeMax) s += 2;
    } else {
      if (pt.n === 1) s += 3;
      if (pt.n >= 2 && i >= opHomeMin && i <= opHomeMax) s -= 2;
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

function chooseBestMove(board, player, myMoves, opts = {}) {
  if (!myMoves.length) return null;

  const {
    maxBranches  = 120,
    noise        = 0,
    greedyOnly   = false
  } = opts;

  const greedy = () => {
    let best = myMoves[0], bestScore = -Infinity;
    for (const seq of myMoves) {
      let sc = evaluate(afterSeq(board, player, seq), player);
      if (noise > 0) sc += sc * noise * (Math.random() * 2 - 1);
      if (sc > bestScore) { bestScore = sc; best = seq; }
    }
    return best;
  };

  if (greedyOnly) return greedy();
  if (myMoves.length > maxBranches) return greedy();

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
  const ffiMoves = ffi.bestMove(board, d1, d2, player);
  if (!ffiMoves.length) return ffiMoves;

  // Match FFI result against legal sequences to get correct pip values.
  // The C API returns from/to but not which die face was consumed;
  // generateMoves knows the exact pip (die face) for each move.
  const dice  = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  const legal = generateMoves(board, player, dice);

  const match = legal.find(seq =>
    seq.length === ffiMoves.length &&
    seq.every((m, i) => m.from === ffiMoves[i].from && m.to === ffiMoves[i].to)
  );

  return match || ffiMoves;
}

/* ======================== GET BEST MOVE ============================ */
/* From src/ai/aiManager.js — routes to WildBG or local AI            */

const AI_TYPES = {
  WILDBG      : "wildbg",
  LOCAL_EASY  : "local-easy",
  LOCAL_MEDIUM: "local-medium",
  LOCAL_HARD  : "local-hard"
};

const LOCAL_OPTS = {
  [AI_TYPES.LOCAL_EASY]  : { greedyOnly: true,  noise: 0.3 },
  [AI_TYPES.LOCAL_MEDIUM]: { maxBranches: 60 },
  [AI_TYPES.LOCAL_HARD]  : { maxBranches: 120 }
};

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
        aiType = AI_TYPES.LOCAL_HARD;
      }
    }

    const localOpts = LOCAL_OPTS[aiType];
    if (localOpts) {
      const allMoves = generateMoves(board, player, dice);
      if (!allMoves?.length) {
        console.log("[LOCAL AI] no legal moves for", player);
        return [];
      }
      const bestSeq = chooseBestMove(board, player, allMoves, localOpts) || [];
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

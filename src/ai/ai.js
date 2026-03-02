/*  ai/strongerAI.js – expectiminimax depth‑1, now bounded            */
/*  Board indices: 24…1 points, 0/25 bars, 26/27 off                  */

import generateMoves, { applyMove } from "../logic/generateMoves";
import { DIRECTION, HOME }          from "../logic/constants";

/* ---------- position-weighted made-point values --------------------- */
/* Index = point number from player's view (1=ace..24=deep back).      */
/* Based on pubeval contact weights (Tesauro 1992), rescaled.          */
const MADE_PT = [
  0,   //  0 unused
  4,   //  1 ace point
  5,   //  2
  7,   //  3
  9,   //  4 inner board
  10,  //  5 golden point — best
  9,   //  6 bar point
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
  1,   // 20
  0,   // 21
  -1,  // 22
  -2,  // 23
  -3   // 24 deepest back
];

function playerPt(player, idx) {
  return player === "black" ? idx : 25 - idx;
}

/* ---------- evaluation ------------------------------------------- */
function evaluate(board, player) {
  const bar   = player === "black" ? 25 : 0;
  const off   = player === "black" ? 26 : 27;
  const opBar = player === "black" ? 0  : 25;
  const opOff = player === "black" ? 27 : 26;
  const dir   = DIRECTION[player];
  const opp   = player === "black" ? "white" : "black";
  const homeMin  = Math.min(HOME[player][0], HOME[player][1]);
  const homeMax  = Math.max(HOME[player][0], HOME[player][1]);
  const opHomeMin = Math.min(HOME[opp][0], HOME[opp][1]);
  const opHomeMax = Math.max(HOME[opp][0], HOME[opp][1]);

  let s = 0;

  /* bar / off */
  s += board[off].n   * 40;
  s -= board[bar].n   * 40;
  s -= board[opOff].n * 40;
  s += board[opBar].n * 40;

  /* pip count (borne‑off = 0) */
  const dist = idx =>
    idx >= 26 ? 0 : player === "black" ? idx : 25 - idx;

  const myPips = board.reduce(
    (acc, p, i) => p.colour === player ? acc + p.n * dist(i) : acc, 0);
  const opPips = board.reduce(
    (acc, p, i) => p.colour && p.colour !== player ? acc + p.n * dist(i) : acc, 0);

  s -= myPips * 0.2;
  s += opPips * 0.2;

  /* structure */
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

/* ---------- helpers ---------------------------------------------- */
const afterSeq = (b, pl, seq) => {
  const clone = structuredClone(b);
  seq.forEach(m => applyMove(clone, pl, m.from, m.to));
  return clone;
};

const rolls = [
  [1,1,1],[2,2,1],[3,3,1],[4,4,1],[5,5,1],[6,6,1],
  [1,2,2],[1,3,2],[1,4,2],[1,5,2],[1,6,2],
  [2,3,2],[2,4,2],[2,5,2],[2,6,2],
  [3,4,2],[3,5,2],[3,6,2],
  [4,5,2],[4,6,2],
  [5,6,2]
];

/* ---------- chooser ---------------------------------------------- */
export function chooseBestMove(board, player, myMoves, opts = {}) {
  if (!myMoves.length) return null;

  const {
    maxBranches  = 120,
    noise        = 0,
    greedyOnly   = false
  } = opts;

  /* ===== greedy path (used as fallback or for Easy level) ======= */
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
  /* =============================================================== */

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

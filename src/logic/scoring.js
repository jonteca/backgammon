/* ------------------------------------------------------------------ */
/*  scoring.js – gammon/backgammon detection & point calculation        */
/* ------------------------------------------------------------------ */

import { HOME } from "./constants";

/**
 * Check if the loser has any checkers in the winner's home board or on bar.
 * Used to distinguish backgammon from gammon.
 */
function hasCheckersInOpponentHome(board, loser, winner) {
  const [lo, hi] = HOME[winner];
  const from = Math.min(lo, hi);
  const to   = Math.max(lo, hi);
  for (let i = from; i <= to; i++) {
    if (board[i]?.colour === loser && board[i].n > 0) return true;
  }
  return false;
}

/**
 * Pip count for a player — sum of distance-to-bear-off for all checkers.
 * Lower is better (closer to winning the race).
 */
export function pipCount(board, colour) {
  let total = 0;
  const bar = colour === "black" ? 25 : 0;
  if (board[bar]?.colour === colour) total += board[bar].n * 25;
  for (let i = 1; i <= 24; i++) {
    if (board[i]?.colour === colour && board[i].n > 0) {
      const pips = colour === "black" ? i : 25 - i;
      total += board[i].n * pips;
    }
  }
  return total;
}

/**
 * Score a completed game.
 * @param {Array} board   – the 28-slot board array
 * @param {string} winner – "black" or "white"
 * @param {number} cubeValue – current doubling cube value
 * @returns {{ type: string, points: number }}
 */
export function scoreGame(board, winner, cubeValue) {
  const loser    = winner === "black" ? "white" : "black";
  const loserOff = loser === "black" ? 26 : 27;
  const loserBar = loser === "black" ? 25 : 0;

  const borneOff = board[loserOff]?.n || 0;

  if (borneOff === 0) {
    const onBar        = board[loserBar]?.n > 0;
    const inWinnerHome = hasCheckersInOpponentHome(board, loser, winner);
    if (onBar || inWinnerHome) {
      return { type: "backgammon", points: 3 * cubeValue };
    }
    return { type: "gammon", points: 2 * cubeValue };
  }

  return { type: "single", points: 1 * cubeValue };
}

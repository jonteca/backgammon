import { DIRECTION, HOME } from "./constants";

/** true if pt is inside player's home board */
export function inHome(player, pt) {
  const [start, end] = HOME[player];
  return pt >= Math.min(start, end) && pt <= Math.max(start, end);
}

/** next point index moving "pips" for player */
export const destPoint = (player, from, pips) =>
  from + DIRECTION[player] * pips;

/** test if destination is legal (open or single blot of opponent) */
export function destOpen(board, player, point) {
  // Point must be between 1 and 24 inclusive
  if (point < 1 || point > 24) return false;
  return board[point].n < 2 || board[point].colour === player;
}

/* ------------------------------------------------ game over ------------------------------ */
export function gameOver(board) {
  // Check if either player has all checkers borne off
  const blackBornOff = board[0].n === 15;  // Black bears off to 0
  const whiteBornOff = board[25].n === 15; // White bears off to 25
  return blackBornOff || whiteBornOff;
}

/* ------------------------------------------------ winner --------------------------------- */
export function winner(board) {
  if (!gameOver(board)) return null;
  return board[0].n === 15 ? "black" : "white";
}

/* ------------------------------------------------ pip count ----------------------------- */
export function pipCount(board, player) {
  let count = 0;
  for (let i = 1; i <= 24; i++) {
    if (board[i].colour === player) {
      // For black (x), count distance from 1
      // For white (o), count distance from 24
      const dist = player === "black" ? i - 1 : 24 - i;
      count += board[i].n * dist;
    }
  }
  // Add pip count for checkers on the bar
  const bar = player === "black" ? 25 : 0;
  const barDist = player === "black" ? 24 : 24;
  count += board[bar].n * barDist;
  return count;
}

/* ------------------------------------------------------------------ */
/*  game.js – headless backgammon engine for CLI / API testing (CJS)  */
/*  Self-contained port of src/logic/* with Game class + ASCII board  */
/* ------------------------------------------------------------------ */

/* ======================== CONSTANTS ================================ */
const PLAYERS = ["black", "white"];

const HOME      = { black: [6, 1],  white: [19, 24] };
const DIRECTION = { black: -1,      white: 1 };
const BAR       = { black: 25,      white: 0 };
const BEAR_OFF  = { black: 0,       white: 25 };
const BORNE_OFF = { black: 26,      white: 27 };

/* ======================== HELPERS ================================== */
const clone = (obj) => JSON.parse(JSON.stringify(obj));

function inHome(player, pt) {
  const [start, end] = HOME[player];
  return pt >= Math.min(start, end) && pt <= Math.max(start, end);
}

const destPoint = (player, from, pips) => from + DIRECTION[player] * pips;

function destOpen(board, player, point) {
  if (point < 1 || point > 24) return false;
  return board[point].n < 2 || board[point].colour === player;
}

function gameOver(board) {
  return board[BORNE_OFF.black].n === 15 || board[BORNE_OFF.white].n === 15;
}

function winner(board) {
  if (!gameOver(board)) return null;
  return board[BORNE_OFF.black].n === 15 ? "black" : "white";
}

/* ======================== INITIAL BOARD ============================ */
function initialBoard() {
  const blank = () => ({ colour: null, n: 0 });
  const board = Array.from({ length: 28 }, blank);
  const place = (pt, colour, n) => { board[pt] = { colour, n }; };

  place(24, "black", 2);
  place(13, "black", 5);
  place(8,  "black", 3);
  place(6,  "black", 5);

  place(1,  "white", 2);
  place(12, "white", 5);
  place(17, "white", 3);
  place(19, "white", 5);

  place(0,  "white", 0);
  place(25, "black", 0);
  place(26, "black", 0);
  place(27, "white", 0);

  return board;
}

/* ======================== APPLY MOVE =============================== */
function applyMove(board, player, from, to) {
  const opBar = BAR[player === "black" ? "white" : "black"];

  board[from].n -= 1;
  if (!board[from].n) board[from].colour = null;

  if (to === BEAR_OFF[player]) {
    const offIdx = BORNE_OFF[player];
    board[offIdx].colour = board[offIdx].colour || player;
    board[offIdx].n += 1;
    return;
  }

  if (board[to].n === 1 && board[to].colour !== player) {
    board[opBar].colour = board[to].colour;
    board[opBar].n += 1;
    board[to] = { colour: null, n: 0 };
  }

  board[to].colour = player;
  board[to].n += 1;
}

/* ======================== GENERATE MOVES =========================== */
const getPointNumber = (player, idx) =>
  player === "black" ? idx : 25 - idx;

const highestOccupiedHome = (player, points) =>
  points
    .filter(pt => inHome(player, pt))
    .map(pt => getPointNumber(player, pt))
    .reduce((m, v) => Math.max(m, v), 0);

function entryMoves(board, player, dice) {
  const bar   = BAR[player];
  const moves = [];

  (function rec(state, diceLeft, path) {
    if (state[bar].n === 0 || !diceLeft.length) {
      if (path.length) moves.push(path);
      return;
    }
    const seen = new Set();
    for (let i = 0; i < diceLeft.length; i++) {
      const pip = diceLeft[i];
      if (seen.has(pip)) continue;
      seen.add(pip);

      const to = player === "black" ? 25 - pip : pip;
      if (to < 1 || to > 24) continue;
      if (!destOpen(state, player, to)) continue;

      const next = clone(state);
      applyMove(next, player, bar, to);

      const rem = diceLeft.slice();
      rem.splice(i, 1);
      rec(next, rem, [...path, { from: bar, to, pip }]);
    }
  })(board, dice, []);

  return moves;
}

function generateMoves(board, player, dice) {
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
        let usedPip = pip;

        if (to < 1 || to > 24) {
          if (!allHome) continue;
          const pointNo = getPointNumber(player, from);
          const highest = highestOccupiedHome(player, pts);
          if (pip === pointNo || pip > highest) {
            to      = BEAR_OFF[player];
            usedPip = pip;
          } else {
            continue;
          }
        }

        if (to >= 1 && to <= 24 && !destOpen(state, player, to)) continue;

        const next = clone(state);
        applyMove(next, player, from, to);

        const rem = diceLeft.slice();
        rem.splice(di, 1);
        rec(next, rem, [...path, { from, to, pip: usedPip }]);
      }
    }
  })(board, dice, []);

  return moves;
}

/* ======================== GAME CLASS =============================== */
const nextPlayer = p => PLAYERS[(PLAYERS.indexOf(p) + 1) % 2];

const rollDice = () => {
  const a = 1 + (Math.random() * 6) | 0;
  const b = 1 + (Math.random() * 6) | 0;
  return a === b ? [a, a, a, a] : [a, b];
};

class Game {
  constructor() { this.newGame(); }

  newGame() {
    this.board       = initialBoard();
    this.player      = "black";
    this.dice        = [];
    this.activeMoves = [];
    this.winner      = null;
    this.turnPhase   = "roll";   // roll | move | done
    return this.getState();
  }

  roll() {
    if (this.winner)                return { error: "Game is over" };
    if (this.turnPhase !== "roll") return { error: "Not time to roll (phase: " + this.turnPhase + ")" };

    this.dice        = rollDice();
    this.activeMoves = generateMoves(this.board, this.player, this.dice);

    if (this.activeMoves.length === 0) {
      this.turnPhase = "done";   // no legal moves → must pass
    } else {
      this.turnPhase = "move";
    }
    return this.getState();
  }

  move(from, to, pip) {
    if (this.winner)                return { error: "Game is over" };
    if (this.turnPhase !== "move") return { error: "Not time to move (phase: " + this.turnPhase + ")" };

    // Validate that this move exists in some legal sequence
    const valid = this.activeMoves.some(
      seq => seq[0].from === from && seq[0].to === to && seq[0].pip === pip
    );
    if (!valid) return { error: "Illegal move", legalFirstMoves: this._uniqueFirstMoves() };

    // Apply the move
    applyMove(this.board, this.player, from, to);

    // Consume the die
    const idx = this.dice.indexOf(pip);
    if (idx !== -1) this.dice.splice(idx, 1);

    // Check for win
    this.winner = winner(this.board);
    if (this.winner) {
      this.turnPhase = "done";
      this.activeMoves = [];
      return this.getState();
    }

    // Recompute legal moves with remaining dice
    if (this.dice.length) {
      this.activeMoves = generateMoves(this.board, this.player, this.dice);
      if (this.activeMoves.length === 0) {
        // Auto-pass: no legal moves remain
        this._endTurn();
      }
      // else stay in "move" phase
    } else {
      this._endTurn();
    }

    return this.getState();
  }

  pass() {
    if (this.winner)                return { error: "Game is over" };
    if (this.turnPhase !== "done") return { error: "Cannot pass yet (phase: " + this.turnPhase + ")" };
    this._endTurn();
    return this.getState();
  }

  _endTurn() {
    this.player      = nextPlayer(this.player);
    this.dice        = [];
    this.activeMoves = [];
    this.turnPhase   = "roll";
  }

  _uniqueFirstMoves() {
    const seen = new Set();
    const result = [];
    for (const seq of this.activeMoves) {
      const m = seq[0];
      const key = `${m.from}-${m.to}-${m.pip}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }

  getState() {
    const moves = this._uniqueFirstMoves();
    const status = this.winner
      ? `Winner: ${this.winner === "black" ? "X (black)" : "O (white)"}`
      : `${this.player === "black" ? "X (black)" : "O (white)"} to ${this.turnPhase}` +
        (this.dice.length ? `  |  Dice: [${this.dice.join(", ")}]` : "") +
        (moves.length ? `  |  ${moves.length} legal move(s)` : "");

    return {
      player     : this.player,
      dice       : this.dice,
      turnPhase  : this.turnPhase,
      winner     : this.winner,
      legalMoves : moves,
      board      : this.board,
      ascii      : renderBoard(this.board) + "\n  " + status,
    };
  }
}

/* ======================== ASCII RENDERER =========================== */
function renderBoard(board) {
  // Columnar point display — shows up to 7 checkers stacked vertically
  const MAX_ROWS = 7;

  // Get checker symbol at row r for a given point
  const checkerAt = (slot, row) => {
    if (!slot || row >= slot.n) return "  ";
    // Show count on last visible row if more checkers than rows
    if (row === MAX_ROWS - 1 && slot.n > MAX_ROWS) {
      return (slot.colour === "black" ? "X" : "O") + slot.n;
    }
    return slot.colour === "black" ? " X" : " O";
  };

  const pad = (s, w) => s.length < w ? s + " ".repeat(w - s.length) : s;

  const lines = [];

  // Header — 4 chars per point, 5-char bar gap
  lines.push("  13  14  15  16  17  18       19  20  21  22  23  24");
  lines.push(" ╔════════════════════════╦═══╦════════════════════════╗");

  // Top half: points 13-18 | bar(black=25) | 19-24 — checkers grow downward
  for (let r = 0; r < MAX_ROWS; r++) {
    let row = " ║";
    for (let i = 13; i <= 18; i++) row += pad(checkerAt(board[i], r), 4);
    row += "║";
    row += pad(checkerAt(board[25], r), 3);
    row += "║";
    for (let i = 19; i <= 24; i++) row += pad(checkerAt(board[i], r), 4);
    row += "║";
    lines.push(row);
  }

  // Middle divider with off counts
  const bOff = board[26].n;
  const wOff = board[27].n;
  lines.push(` ║────────────────────────╠───╣────────────────────────║  X off: ${bOff}`);
  lines.push(` ║                        ║BAR║                        ║  O off: ${wOff}`);
  lines.push(" ║────────────────────────╠───╣────────────────────────║");

  // Bottom half: points 12-7 | bar(white=0) | 6-1 — checkers grow upward
  for (let r = MAX_ROWS - 1; r >= 0; r--) {
    let row = " ║";
    for (let i = 12; i >= 7; i--) row += pad(checkerAt(board[i], r), 4);
    row += "║";
    row += pad(checkerAt(board[0], r), 3);
    row += "║";
    for (let i = 6; i >= 1; i--) row += pad(checkerAt(board[i], r), 4);
    row += "║";
    lines.push(row);
  }

  lines.push(" ╚════════════════════════╩═══╩════════════════════════╝");
  lines.push("  12  11  10   9   8   7        6   5   4   3   2   1");

  return lines.join("\n");
}

/* ======================== EXPORTS ================================== */
module.exports = { Game, renderBoard, generateMoves, applyMove };

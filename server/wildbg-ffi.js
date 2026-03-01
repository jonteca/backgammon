/* ------------------------------------------------------------------ */
/*  wildbg-ffi.js – FFI wrapper for wildbg-c shared library           */
/*  Calls best_move() directly via koffi, no HTTP server needed       */
/* ------------------------------------------------------------------ */

const koffi = require('koffi');
const path = require('path');

/* ======================== LOAD LIBRARY ============================= */

let lib;
try {
  lib = koffi.load(path.join(__dirname, 'libwildbg.dylib'));
} catch (err) {
  console.warn('[wildbg-ffi] Could not load libwildbg.dylib:', err.message);
  module.exports = null;
  return;
}

/* ======================== TYPES ==================================== */

const Wildbg = koffi.opaque('Wildbg');

const BgConfig = koffi.struct('BgConfig', {
  x_away: 'uint',
  o_away: 'uint',
});

const CMoveDetail = koffi.struct('CMoveDetail', {
  from: 'int',
  to:   'int',
});

const CMove = koffi.struct('CMove', {
  details:      koffi.array(CMoveDetail, 4),
  detail_count: 'int',
});

/* ======================== FUNCTIONS ================================ */

const wildbg_new  = lib.func('Wildbg* wildbg_new()');
const wildbg_free = lib.func('void wildbg_free(Wildbg* ptr)');
const best_move   = lib.func('CMove best_move(const Wildbg*, const int*, uint, uint, const BgConfig*)');

/* ======================== ENGINE SINGLETON ========================= */

let engine = null;

function getEngine() {
  if (!engine) {
    console.log('[wildbg-ffi] Initializing WildBG engine...');
    engine = wildbg_new();
    if (!engine) throw new Error('wildbg_new() returned null — ONNX models not found?');
    console.log('[wildbg-ffi] Engine ready.');
  }
  return engine;
}

/* ======================== BOARD ENCODING =========================== */
/*
 * C API convention (from wildbg.h):
 *   Index 0:    opponent's bar
 *   Index 1-24: board points
 *   Index 25:   player's bar (on turn)
 *   Positive = player on turn, negative = opponent
 *   Player on turn always moves from pip 24 to pip 1.
 *
 * Our 28-slot board:
 *   0:  white bar / black bear-off dest
 *   1-24: board points
 *   25: black bar / white bear-off dest
 *   26: black borne-off pile
 *   27: white borne-off pile
 *
 * Black moves 24→1, White moves 1→24.
 */

function boardToPips(board, player) {
  const pips = new Array(26).fill(0);

  if (player === 'black') {
    // Black is "on turn" — direct mapping
    for (let i = 1; i <= 24; i++) {
      if (board[i].n) {
        pips[i] = board[i].colour === 'black' ? board[i].n : -board[i].n;
      }
    }
    pips[25] = board[25].n;   // black bar → player bar
    pips[0]  = -board[0].n;   // white bar → opponent bar
  } else {
    // White is "on turn" — mirror indices so white moves 24→1
    for (let i = 1; i <= 24; i++) {
      if (board[i].n) {
        pips[25 - i] = board[i].colour === 'white' ? board[i].n : -board[i].n;
      }
    }
    pips[25] = board[0].n;    // white bar (slot 0) → player bar
    pips[0]  = -board[25].n;  // black bar (slot 25) → opponent bar
  }

  return pips;
}

/* ======================== MOVE TRANSLATION ========================= */
/*
 * C API returns from/to in "player on turn" coords (always moves 24→1):
 *   from: 25 = bar, 1-24 = point
 *   to:   0  = bear-off, 1-24 = point
 *
 * Our coord system:
 *   Black: bar=25, bear-off=0, moves 24→1  (direct match to C API)
 *   White: bar=0,  bear-off=25, moves 1→24 (mirror C API indices)
 */

function translateMove(detail, player) {
  const pip = detail.from - detail.to;  // always correct (die value / distance)

  if (player === 'black') {
    return { from: detail.from, to: detail.to, pip };
  }

  // White: un-mirror coordinates
  const from = detail.from === 25 ? 0 : (25 - detail.from);
  const to   = detail.to   === 0 ? 25 : (25 - detail.to);
  return { from, to, pip };
}

/* ======================== EXPORTED FUNCTION ======================== */

function bestMove(board, die1, die2, player) {
  const eng = getEngine();
  const pips = boardToPips(board, player);

  const config = { x_away: 0, o_away: 0 };  // money game
  const result = best_move(eng, pips, die1, die2, config);

  if (result.detail_count === 0) return [];

  const moves = [];
  for (let i = 0; i < result.detail_count; i++) {
    const d = result.details[i];
    if (d.from === -1) continue;  // invalid/empty detail
    moves.push(translateMove(d, player));
  }
  return moves;
}

/* ======================== CLEANUP ================================= */

process.on('exit', () => {
  if (engine) {
    wildbg_free(engine);
    engine = null;
  }
});

/* ======================== EXPORTS ================================= */

module.exports = { bestMove };

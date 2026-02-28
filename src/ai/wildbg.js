/* ------------------------------------------------------------------ */
/*  ai/wildbg.js – wrapper for the WildBG HTTP service (updated)      */
/* ------------------------------------------------------------------ */
const BAR_X  = 0;   // black bar   (our idx 25)
const BAR_O  = 25;  // white bar   (our idx 0)
const OFF_X  = 25;  // black off   (our idx 26 – may be missing)
const OFF_O  = 0;   // white off   (our idx 27 – may be missing)

/* ---------- tiny assert helper ----------------------------------- */
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ---------- board → URLSearchParams ------------------------------ */
function boardToParams(board) {
  const slot = (i) => board[i] ?? { n: 0 };      // tolerate 26-slot arrays

  /* 1. validate each slot ---------------------------------------- */
  board.forEach((s, i) => {
    assert(Number.isInteger(s.n) && s.n >= 0,
      `Invalid board slot #${i}: ${JSON.stringify(s)}`);
    if (s.n > 0)
      assert(s.colour === "black" || s.colour === "white",
        `Slot ${i} has checkers but colour is ${s.colour}`);
  });

  /* 2. convert to WildBG’s signed 26-element array --------------- */
  const signed = Array(26).fill(0);

  /* points 24 … 1 (our 1 … 24) */
  for (let i = 1; i <= 24; i++) {
    const p = slot(i);
    if (p.n) signed[i] = p.colour === "black" ?  p.n : -p.n;
  }

  /* bars --------------------------------------------------------- */
  signed[BAR_X] += slot(25).n;   // black bar +
  signed[BAR_O] -= slot(0 ).n;   // white bar –

  /* off piles (may not exist in 26-slot board) ------------------- */
  signed[OFF_X] += slot(26).n;   // black off +
  signed[OFF_O] -= slot(27).n;   // white off –

  /* 3. total-checker sanity -------------------------------------- */
  const totalX = signed.reduce((s, v) => v > 0 ? s + v : s, 0);
  const totalO = signed.reduce((s, v) => v < 0 ? s - v : s, 0);
  assert(totalX === 15 && totalO === 15,
    `Checker count mismatch (x ${totalX} / o ${totalO})`);

  /* 4. serialise -------------------------------------------------- */
  const qs = new URLSearchParams();
  signed.forEach((v, i) => { if (v) qs.append(`p${i}`, v); });
  return qs;
}

/* ---------- translate WildBG indices → our indices --------------- */
function translate({ from, to }, player) {
  /* bars --------------------------------------------------------- */
  if (from === BAR_X) from = 25;
  else if (from === BAR_O) from = 0;

  /* destinations ------------------------------------------------- */
  if (to === BAR_X)       to = 25;
  else if (to === BAR_O)  to = 0;
  else if (to === OFF_X)  to = 26;
  else if (to === OFF_O)  to = 27;

  const pip =
    to === 26 ? from :             // black bearing off
    to === 27 ? 25 - from :        // white bearing off
    Math.abs(from - to);

  return { from, to, pip };
}

/* ---------- public API ------------------------------------------- */
export async function wildBestMove(
  board,              // 26 or 28 slots
  diceFaces,          // [d1,d2,…] (≥2, doubles may repeat)
  player,             // "black" | "white"
  endpoint = "http://localhost:3001/move",
  ply = 1
) {
  /* dice validation --------------------------------------------- */
  assert(Array.isArray(diceFaces) && diceFaces.length >= 2,
    `Dice array must have at least two faces: ${JSON.stringify(diceFaces)}`);

  const [d1, d2] = diceFaces;           // ignore any expansion beyond 2
  [d1, d2].forEach(d =>
    assert(Number.isInteger(d) && d >= 1 && d <= 6, `Die out of range: ${d}`));

  const doubles = d1 === d2;

  /* build URL ---------------------------------------------------- */
  const url = new URL(endpoint);
  url.searchParams.set("die1", d1);
  url.searchParams.set("die2", doubles ? d1 : d2);
  url.searchParams.set("ply" , ply);
  url.searchParams.set("player", player === "black" ? "x" : "o");
  url.search += "&" + boardToParams(board).toString();

  /* fetch -------------------------------------------------------- */
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

  return data.moves[0].play.map(m => translate(m, player));
}

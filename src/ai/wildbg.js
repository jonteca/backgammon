/* ------------------------------------------------------------------ */
/*  ai/wildbg.js – calls server-side WildBG FFI endpoint               */
/* ------------------------------------------------------------------ */

const ENDPOINT = "/api/best-move";

export async function wildBestMove(board, diceFaces, player) {
  const [d1, d2] = diceFaces;

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board, dice: [d1, d2], player }),
  });

  if (!r.ok) {
    const txt = await r.text();
    let msg = txt;
    try { msg = JSON.parse(txt).error || txt; } catch { /* ignore */ }
    throw new Error(`WildBG ${r.status}: ${msg}`);
  }

  const data = await r.json();
  return data.moves || [];
}

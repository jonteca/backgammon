/* ------------------------------------------------------------------ */
/*  ai/aiManager.js – single entry-point for WildBG & local AI        */
/* ------------------------------------------------------------------ */

import { wildBestMove }   from "./wildbg";           // HTTP service
import { chooseBestMove } from "./ai";               // local expectiminimax
import generateMoves      from "../logic/generateMoves";

/* ---------- public enum ------------------------------------------ */
export const AI_TYPES = {
  WILDBG: "wildbg",
  LOCAL : "local"
};

/* ---------- helpers ---------------------------------------------- */
function firstTwoFaces(dice) {
  if (!dice?.length) throw new Error("No dice provided");
  return dice.length === 1 ? [dice[0], dice[0]]   // single die – duplicate it
       : [dice[0], dice[1]];                      // already at least two faces
}

function ensurePip(m) {
  if ("pip" in m) return m;
  const pip = m.die ?? m.distance ?? Math.abs(m.from - m.to);
  return { from: m.from ?? m.src, to: m.to ?? m.dst, pip };
}

/* ------------------------------------------------------------------ */
/*  getBestMove – resolves to [{ from, to, pip }, …] or []            */
/* ------------------------------------------------------------------ */
export async function getBestMove(
  board,                // 26- or 28-slot array
  dice,                 // 1, 2 or 4 ints (1-6)
  player,               // "black" | "white"
  aiType = AI_TYPES.WILDBG
) {
  try {
    /* ---------- 1. WildBG (network) ------------------------------ */
    if (aiType === AI_TYPES.WILDBG) {
      try {
        const faces = firstTwoFaces(dice);               // just 2 faces for WildBG
        const seq   = await wildBestMove(board, faces, player);
        return seq.map(ensurePip);                       // already normalised
      } catch (netErr) {
        console.error("[WildBG] failed, falling back to local AI:", netErr);
        aiType = AI_TYPES.LOCAL;                         // graceful fallback
      }
    }

    /* ---------- 2. Local expectiminimax ------------------------- */
    if (aiType === AI_TYPES.LOCAL) {
      const allMoves = generateMoves(board, player, dice);
      if (!allMoves?.length) {
        console.log("[LOCAL AI] no legal moves for", player);
        return [];
      }
      const bestSeq = chooseBestMove(board, player, allMoves) || [];
      return bestSeq.map(ensurePip);
    }

    /* ---------- 3. Unknown type -------------------------------- */
    throw new Error(`Unknown AI type '${aiType}'`);

  } catch (err) {
    /* final catch-all – keep the game running */
    console.error(`AI error (${aiType}):`, {
      error : err,
      board,
      dice,
      player
    });
    return [];    // let the game continue even on failure
  }
}

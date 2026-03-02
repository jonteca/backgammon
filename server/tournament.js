#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  tournament.js – pit two AI types against each other               */
/*  Usage: node tournament.js [games] [AI1] [AI2]                     */
/*  Defaults: 100 games, local-hard vs wildbg                         */
/*  Colors alternate each game for fairness                           */
/*  Requires: server running on localhost:3001                         */
/* ------------------------------------------------------------------ */

const GAMES    = parseInt(process.argv[2], 10) || 100;
const PLAYER_A = process.argv[3] || "local-hard";
const PLAYER_B = process.argv[4] || "wildbg";
const BASE     = "http://localhost:3001";
const MAX_TURNS = 200; // safety cap per game

async function fetchRetry(url, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

async function post(path, body) {
  const res = await fetchRetry(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

async function get(path) {
  const res = await fetchRetry(`${BASE}${path}`);
  return res.json();
}

/* Play a single game. colorMap = { black: aiType, white: aiType } */
async function playGame(colorMap) {
  await post("/game/new");
  let turns = 0;
  while (turns < MAX_TURNS) {
    const state = await get("/game");
    if (state.winner) return colorMap[state.winner];
    const aiType = colorMap[state.player];
    const result = await post("/game/ai-move", { type: aiType });
    if (result.winner) return colorMap[result.winner];
    turns++;
  }
  return null; // draw / stuck
}

(async () => {
  console.log(`Tournament: ${GAMES} games — ${PLAYER_A} vs ${PLAYER_B} (alternating colors)`);
  const wins = { [PLAYER_A]: 0, [PLAYER_B]: 0 };
  let stuck = 0;
  const start = Date.now();

  for (let i = 1; i <= GAMES; i++) {
    // Alternate who plays black each game
    const colorMap = (i % 2 === 1)
      ? { black: PLAYER_A, white: PLAYER_B }
      : { black: PLAYER_B, white: PLAYER_A };

    try {
      const winner = await playGame(colorMap);
      if (winner) wins[winner]++;
      else stuck++;
    } catch (err) {
      console.error(`\n  Game ${i} error: ${err.message} — skipping`);
      stuck++;
    }
    const pct = ((wins[PLAYER_A] / i) * 100).toFixed(1);
    process.stdout.write(`\r  Game ${i}/${GAMES}: ${PLAYER_A}=${wins[PLAYER_A]}  ${PLAYER_B}=${wins[PLAYER_B]}  stuck=${stuck}  (${pct}% ${PLAYER_A})`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\nResults after ${GAMES} games (${elapsed}s):`);
  console.log(`  ${PLAYER_A}: ${wins[PLAYER_A]} wins (${((wins[PLAYER_A]/GAMES)*100).toFixed(1)}%)`);
  console.log(`  ${PLAYER_B}: ${wins[PLAYER_B]} wins (${((wins[PLAYER_B]/GAMES)*100).toFixed(1)}%)`);
  if (stuck) console.log(`  Stuck/draws: ${stuck}`);
})();

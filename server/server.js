const express = require('express');
const cors = require('cors');
const { Game, generateMoves } = require('./game');
const { getBestMove } = require('./ai');
const ffi = require('./wildbg-ffi');

const app = express();
const port = 3001; // Different from both React (3000) and WildBG (8080)

// More detailed CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000', 'http://127.0.0.1:3002'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

/* ======================== CLI GAME API ============================= */
let game = new Game();

app.post('/game/new', (req, res) => {
  game = new Game();
  res.json(game.getState());
});

app.get('/game', (req, res) => {
  res.json(game.getState());
});

app.post('/game/roll', (req, res) => {
  const result = game.roll();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/game/move', (req, res) => {
  const { from, to, pip } = req.body || {};
  if (from == null || to == null || pip == null) {
    return res.status(400).json({ error: "Required: {from, to, pip}" });
  }
  const result = game.move(Number(from), Number(to), Number(pip));
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/game/pass', (req, res) => {
  const result = game.pass();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/game/ai-move', async (req, res) => {
  try {
    const aiType = (req.body && req.body.type) || 'wildbg';

    if (game.winner) return res.status(400).json({ error: "Game is over" });

    // Roll if needed
    if (game.turnPhase === 'roll') {
      const rollResult = game.roll();
      if (rollResult.error) return res.status(400).json(rollResult);
    }

    // No legal moves after rolling → pass and return
    if (game.turnPhase === 'done') {
      return res.json(game.pass());
    }

    // Get AI's best move sequence
    let bestSeq = await getBestMove(game.board, game.dice, game.player, aiType);

    // Fallback: if AI returned nothing but legal moves exist, use first sequence
    if ((!bestSeq || !bestSeq.length) && game.activeMoves.length) {
      bestSeq = game.activeMoves[0];
    }

    // Apply each move in the sequence
    for (const m of bestSeq) {
      if (game.turnPhase !== 'move') break;
      const result = game.move(m.from, m.to, m.pip);
      if (result.error) {
        return res.status(500).json({ error: "AI move rejected", detail: result.error, move: m });
      }
    }

    // Pass if turn ended with no legal moves remaining
    if (game.turnPhase === 'done') {
      game.pass();
    }

    res.json(game.getState());
  } catch (err) {
    console.error('AI move error:', err);
    res.status(500).json({ error: 'AI move failed', details: err.message });
  }
});

// FFI-powered best-move endpoint (replaces old HTTP proxy to WildBG)
app.post('/api/best-move', (req, res) => {
  try {
    const { board, dice, player } = req.body;
    if (!board || !dice || !player) {
      return res.status(400).json({ error: 'Required: { board, dice, player }' });
    }
    if (!ffi) {
      return res.status(503).json({ error: 'WildBG FFI not available' });
    }
    const [d1, d2] = dice;
    const ffiMoves = ffi.bestMove(board, d1, d2, player);

    if (!ffiMoves.length) {
      return res.json({ moves: [] });
    }

    // Match against legal moves to get correct pip values.
    // FFI pip = distance, but bearing-off needs the actual die face
    // (e.g., bearing off from point 3 with die 5: pip must be 5, not 3).
    const fullDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    const legal = generateMoves(board, player, fullDice);
    const match = legal.find(seq =>
      seq.length === ffiMoves.length &&
      seq.every((m, i) => m.from === ffiMoves[i].from && m.to === ffiMoves[i].to)
    );

    res.json({ moves: match || ffiMoves });
  } catch (error) {
    console.error('FFI best-move error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/test', (req, res) => {
  res.json({
    status: ffi ? 'ok' : 'degraded',
    message: ffi ? 'WildBG FFI loaded' : 'WildBG FFI not available, using local AI fallback',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('WildBG FFI:', ffi ? 'loaded' : 'not available (local AI fallback)');
}); 
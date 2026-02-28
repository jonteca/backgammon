const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { Game } = require('./game');
const { getBestMove } = require('./ai');

const app = express();
const port = 3001; // Different from both React (3000) and WildBG (8080)

// More detailed CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
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

// Test endpoint that checks WildBG connectivity
app.get('/test', async (req, res) => {
  try {
    // Try to access the Swagger UI - we know this works
    const response = await fetch('http://localhost:8080/swagger-ui');
    if (response.ok) {
      res.json({ 
        status: 'ok',
        message: 'Successfully connected to WildBG engine'
      });
    } else {
      res.status(502).json({ 
        status: 'error',
        message: 'WildBG engine responded with status: ' + response.status
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'error',
      message: 'Could not connect to WildBG engine: ' + error.message
    });
  }
});

// Proxy endpoint for WildBG
app.get('/move', async (req, res) => {
  try {
    const wildBgUrl = 'http://localhost:8080/move' + req.url.substring(req.url.indexOf('?'));
    console.log('Proxying request to:', wildBgUrl);
    
    const response = await fetch(wildBgUrl, {
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      console.error('WildBG error:', response.status, response.statusText);
      throw new Error(`WildBG responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('WildBG response:', data);
    res.json(data);
  } catch (error) {
    console.error('Error proxying to WildBG:', error.message);
    res.status(500).json({ 
      error: 'Failed to get move from WildBG',
      details: error.message 
    });
  }
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
  console.log(`Proxy server running at http://localhost:${port}`);
  console.log('Configured to proxy requests to WildBG at http://localhost:8080');
}); 
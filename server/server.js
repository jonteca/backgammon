const http = require('http');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { WebSocketServer } = require('ws');
const { Game, generateMoves } = require('./game');
const { getBestMove } = require('./ai');
const ffi = require('./wildbg-ffi');
const { getOrCreateRoom, getRoom, deleteRoom, getAllRooms } = require('./rooms');

const app = express();
const port = process.env.PORT || 3001;

// CORS: allow local dev and Discord proxy origins
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, same-origin) and known patterns
    if (!origin
        || origin.startsWith('http://localhost:')
        || origin.startsWith('http://127.0.0.1:')
        || origin.endsWith('.discordsays.com')
        || origin.endsWith('.discord.com')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

/* ======================== DISCORD OAUTH2 =========================== */
app.post('/api/token', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID;
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'Discord credentials not configured' });
    }

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('Discord token exchange failed:', tokenRes.status, text);
      return res.status(tokenRes.status).json({ error: 'Token exchange failed' });
    }

    const data = await tokenRes.json();
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).json({ error: 'Token exchange error' });
  }
});

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

/* ======================== PRODUCTION STATIC SERVING ================ */
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath, { extensions: ['html'] }));
  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/game') || req.path === '/test') {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message
  });
});

/* ======================== HTTP + WEBSOCKET SERVER ==================== */
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

const AI_SOLO_TIMEOUT = 15000; // start AI after 15s with one player

wss.on('connection', (ws) => {
  let roomRef = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const { instanceId, userId, username } = msg;
      if (!instanceId || !userId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Missing instanceId or userId' }));
        return;
      }

      const room = getOrCreateRoom(instanceId);
      roomRef = room;
      const colour = room.addPlayer(userId, ws);

      // Send join confirmation
      ws.send(JSON.stringify({
        type: 'joined',
        colour,            // null if spectator
        instanceId,
        userId,
      }));

      // Broadcast current state to all
      room.broadcast(room.getState());

      // If only one player, set a timer for AI solo fallback
      if (room.playerCount() === 1) {
        if (room.aiTimer) clearTimeout(room.aiTimer);
        room.aiTimer = setTimeout(async () => {
          if (room.playerCount() < 2 && !room.game.winner) {
            // Assign AI to missing colour
            const aiColour = room.players.black ? 'white' : 'black';
            room.broadcast({ type: 'ai_opponent', colour: aiColour });
            // Start AI loop for that colour
            startAiLoop(room, aiColour);
          }
        }, AI_SOLO_TIMEOUT);
      } else if (room.playerCount() === 2) {
        // Cancel AI timer if second player joined
        if (room.aiTimer) {
          clearTimeout(room.aiTimer);
          room.aiTimer = null;
        }
      }
      return;
    }

    // All other actions require a room
    if (!roomRef) {
      ws.send(JSON.stringify({ type: 'error', error: 'Not in a room. Send join first.' }));
      return;
    }

    const userId = msg.userId;
    if (!userId) {
      ws.send(JSON.stringify({ type: 'error', error: 'Missing userId' }));
      return;
    }

    const error = await roomRef.handleAction(userId, msg);
    if (error) {
      ws.send(JSON.stringify({ type: 'error', error }));
    }
  });

  ws.on('close', () => {
    if (roomRef) {
      roomRef.removeClient(ws);
    }
  });
});

async function startAiLoop(room, aiColour) {
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  while (!room.game.winner && room.playerCount() < 2) {
    if (room.game.player !== aiColour) {
      await delay(500);
      continue;
    }
    await delay(800); // visible pause before AI acts
    await room.startAiForColour(aiColour);
    await delay(200);
  }
}

/* Room cleanup: every 5 min, delete rooms with no connections and idle >5min */
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of getAllRooms()) {
    if (!room.hasConnections() && now - room.lastActivity > 5 * 60 * 1000) {
      console.log(`[Rooms] cleaning up room ${id}`);
      deleteRoom(id);
    }
  }
}, 5 * 60 * 1000);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('WebSocket server on /ws');
  console.log('WildBG FFI:', ffi ? 'loaded' : 'not available (local AI fallback)');
}); 
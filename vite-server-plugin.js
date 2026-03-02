/* ------------------------------------------------------------------ */
/*  vite-server-plugin.js — embeds the backend into Vite's dev server  */
/*  Loads server/game.js, server/ai.js, server/wildbg-ffi.js via CJS  */
/*  so `npm run dev` is all you need for local development.            */
/* ------------------------------------------------------------------ */

import { createRequire } from 'module';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);

export default function backgammonServer() {
  return {
    name: 'backgammon-server',

    configureServer(server) {
      // Load CJS server modules
      const { generateMoves } = require('./server/game.js');
      let ffi;
      try {
        ffi = require('./server/wildbg-ffi.js');
      } catch (e) {
        console.warn('[vite-plugin] WildBG FFI not available:', e.message);
        ffi = null;
      }

      let rooms;
      try {
        rooms = require('./server/rooms.js');
      } catch (e) {
        console.warn('[vite-plugin] rooms.js not available:', e.message);
        rooms = null;
      }

      /* ---------- JSON body parser (minimal) ----------------------- */
      function parseBody(req) {
        return new Promise((resolve) => {
          let data = '';
          req.on('data', c => data += c);
          req.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve({}); }
          });
        });
      }

      function sendJson(res, status, obj) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      }

      /* ---------- HTTP middleware ----------------------------------- */
      server.middlewares.use(async (req, res, next) => {
        // POST /api/best-move
        if (req.method === 'POST' && req.url === '/api/best-move') {
          const body = await parseBody(req);
          const { board, dice, player } = body;
          if (!board || !dice || !player) {
            return sendJson(res, 400, { error: 'Required: { board, dice, player }' });
          }
          if (!ffi) {
            return sendJson(res, 503, { error: 'WildBG FFI not available' });
          }
          try {
            const [d1, d2] = dice;
            const ffiMoves = ffi.bestMove(board, d1, d2, player);
            if (!ffiMoves.length) {
              return sendJson(res, 200, { moves: [] });
            }
            const fullDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
            const legal = generateMoves(board, player, fullDice);
            const match = legal.find(seq =>
              seq.length === ffiMoves.length &&
              seq.every((m, i) => m.from === ffiMoves[i].from && m.to === ffiMoves[i].to)
            );
            return sendJson(res, 200, { moves: match || ffiMoves });
          } catch (err) {
            console.error('[vite-plugin] best-move error:', err.message);
            return sendJson(res, 500, { error: err.message });
          }
        }

        // POST /api/token (Discord OAuth2 — pass through if credentials set)
        if (req.method === 'POST' && req.url === '/api/token') {
          const body = await parseBody(req);
          const { code } = body;
          const CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID;
          const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
          if (!CLIENT_ID || !CLIENT_SECRET) {
            return sendJson(res, 500, { error: 'Discord credentials not configured' });
          }
          try {
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
              return sendJson(res, tokenRes.status, { error: 'Token exchange failed' });
            }
            const data = await tokenRes.json();
            return sendJson(res, 200, { access_token: data.access_token });
          } catch (err) {
            return sendJson(res, 500, { error: 'Token exchange error' });
          }
        }

        // GET /test
        if (req.method === 'GET' && req.url === '/test') {
          return sendJson(res, 200, {
            status: ffi ? 'ok' : 'degraded',
            message: ffi ? 'WildBG FFI loaded (embedded)' : 'WildBG FFI not available',
          });
        }

        next();
      });

      /* ---------- WebSocket server for multiplayer ------------------- */
      if (rooms) {
        const wss = new WebSocketServer({ noServer: true });
        const AI_SOLO_TIMEOUT = 15000;

        server.httpServer.on('upgrade', (req, socket, head) => {
          if (req.url === '/ws') {
            wss.handleUpgrade(req, socket, head, (ws) => {
              wss.emit('connection', ws, req);
            });
          }
          // Let Vite handle its own HMR WebSocket upgrades
        });

        wss.on('connection', (ws) => {
          let roomRef = null;

          ws.on('message', async (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }

            if (msg.type === 'join') {
              const { instanceId, userId } = msg;
              if (!instanceId || !userId) {
                ws.send(JSON.stringify({ type: 'error', error: 'Missing instanceId or userId' }));
                return;
              }
              const room = rooms.getOrCreateRoom(instanceId);
              roomRef = room;
              const colour = room.addPlayer(userId, ws);
              ws.send(JSON.stringify({ type: 'joined', colour, instanceId, userId }));
              room.broadcast(room.getState());

              if (room.playerCount() === 1) {
                if (room.aiTimer) clearTimeout(room.aiTimer);
                room.aiTimer = setTimeout(async () => {
                  if (room.playerCount() < 2 && !room.game.winner) {
                    const aiColour = room.players.black ? 'white' : 'black';
                    room.broadcast({ type: 'ai_opponent', colour: aiColour });
                    startAiLoop(room, aiColour);
                  }
                }, AI_SOLO_TIMEOUT);
              } else if (room.playerCount() === 2 && room.aiTimer) {
                clearTimeout(room.aiTimer);
                room.aiTimer = null;
              }
              return;
            }

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
            if (roomRef) roomRef.removeClient(ws);
          });
        });

        async function startAiLoop(room, aiColour) {
          const delay = (ms) => new Promise(r => setTimeout(r, ms));
          while (!room.game.winner && room.playerCount() < 2) {
            if (room.game.player !== aiColour) { await delay(500); continue; }
            await delay(800);
            await room.startAiForColour(aiColour);
            await delay(200);
          }
        }

        console.log('[vite-plugin] WebSocket server ready on /ws');
      }

      console.log('[vite-plugin] Backend loaded —', ffi ? 'WildBG FFI active' : 'local AI only');
    },
  };
}

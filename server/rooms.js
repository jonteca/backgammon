/* ------------------------------------------------------------------ */
/*  rooms.js — multiplayer room manager keyed by Discord instanceId    */
/* ------------------------------------------------------------------ */

const { Game, generateMoves } = require('./game');
const { getBestMove } = require('./ai');

class Room {
  constructor(instanceId) {
    this.instanceId = instanceId;
    this.game = new Game();
    this.players = {};        // { black: userId, white: userId }
    this.clients = new Map(); // userId → Set<ws>
    this.spectators = new Set(); // ws
    this.lastActivity = Date.now();
    this.aiTimer = null;

    // Doubling cube state (server-authoritative)
    this.cubeValue = 1;
    this.cubeOwner = null;       // null = centered, "black" or "white"
    this.doubleOffered = false;
    this.doublingPlayer = null;
  }

  addPlayer(userId, ws) {
    this.lastActivity = Date.now();

    // Already assigned a colour?
    const existing = this.colourOf(userId);
    if (existing) {
      if (!this.clients.has(userId)) this.clients.set(userId, new Set());
      this.clients.get(userId).add(ws);
      return existing;
    }

    // Assign to first open seat
    let colour = null;
    if (!this.players.black) {
      this.players.black = userId;
      colour = 'black';
    } else if (!this.players.white) {
      this.players.white = userId;
      colour = 'white';
    }

    if (colour) {
      if (!this.clients.has(userId)) this.clients.set(userId, new Set());
      this.clients.get(userId).add(ws);
      return colour;
    }

    // No seats — spectator
    this.spectators.add(ws);
    return null;
  }

  removeClient(ws) {
    for (const [userId, sockets] of this.clients) {
      sockets.delete(ws);
      // Don't remove player assignment — they can reconnect
    }
    this.spectators.delete(ws);
    this.lastActivity = Date.now();
  }

  colourOf(userId) {
    if (this.players.black === userId) return 'black';
    if (this.players.white === userId) return 'white';
    return null;
  }

  playerCount() {
    let n = 0;
    if (this.players.black) n++;
    if (this.players.white) n++;
    return n;
  }

  hasConnections() {
    for (const sockets of this.clients.values()) {
      if (sockets.size > 0) return true;
    }
    return this.spectators.size > 0;
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const sockets of this.clients.values()) {
      for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(data);
      }
    }
    for (const ws of this.spectators) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  getState() {
    const gs = this.game.getState();
    return {
      type: 'state',
      board: gs.board,
      player: gs.player,
      dice: gs.dice,
      turnPhase: gs.turnPhase,
      winner: gs.winner,
      legalMoves: gs.legalMoves,
      players: { ...this.players },
      playerCount: this.playerCount(),
      cubeValue: this.cubeValue,
      cubeOwner: this.cubeOwner,
      doubleOffered: this.doubleOffered,
      doublingPlayer: this.doublingPlayer,
    };
  }

  /* Process an action from a player. Returns error string or null. */
  async handleAction(userId, action) {
    this.lastActivity = Date.now();
    const colour = this.colourOf(userId);
    if (!colour) return 'Not a player in this room';

    const game = this.game;

    switch (action.type) {
      case 'roll': {
        if (game.player !== colour) return 'Not your turn';
        if (game.winner) return 'Game is over';
        const result = game.roll();
        if (result.error) return result.error;

        this.broadcast(this.getState());

        // Auto-pass if no legal moves
        if (game.turnPhase === 'done') {
          game.pass();
          this.broadcast(this.getState());
        }
        return null;
      }

      case 'move': {
        if (game.player !== colour) return 'Not your turn';
        const { from, to, pip } = action;
        if (from == null || to == null || pip == null) return 'Missing move fields';
        const result = game.move(Number(from), Number(to), Number(pip));
        if (result.error) return result.error;

        this.broadcast(this.getState());

        // Auto-pass if turn done
        if (game.turnPhase === 'done' && !game.winner) {
          game.pass();
          this.broadcast(this.getState());
        }
        return null;
      }

      case 'pass': {
        if (game.player !== colour) return 'Not your turn';
        if (game.turnPhase !== 'done') return 'Cannot pass yet';
        const result = game.pass();
        if (result.error) return result.error;
        this.broadcast(this.getState());
        return null;
      }

      case 'offer_double': {
        if (game.player !== colour) return 'Not your turn';
        if (this.doubleOffered) return 'Double already offered';
        if (game.dice.length > 0) return 'Cannot double after rolling';
        if (this.cubeOwner !== null && this.cubeOwner !== colour) return 'You do not own the cube';
        this.doubleOffered = true;
        this.doublingPlayer = colour;
        this.broadcast(this.getState());
        return null;
      }

      case 'accept_double': {
        if (!this.doubleOffered) return 'No double to accept';
        const opponent = this.doublingPlayer === 'black' ? 'white' : 'black';
        if (colour !== opponent) return 'Only the opponent can accept';
        this.cubeValue *= 2;
        this.cubeOwner = opponent;
        this.doubleOffered = false;
        this.doublingPlayer = null;
        this.broadcast(this.getState());
        return null;
      }

      case 'decline_double': {
        if (!this.doubleOffered) return 'No double to decline';
        const opponent = this.doublingPlayer === 'black' ? 'white' : 'black';
        if (colour !== opponent) return 'Only the opponent can decline';
        // Decliner loses — the doubler wins
        // We don't have scoring in the server Game class, so just signal winner
        this.doubleOffered = false;
        this.doublingPlayer = null;
        this.broadcast({
          type: 'state',
          ...this.getState(),
          winner: this.doublingPlayer || colour === 'black' ? 'white' : 'black',
        });
        return null;
      }

      case 'new_game': {
        game.newGame();
        this.cubeValue = 1;
        this.cubeOwner = null;
        this.doubleOffered = false;
        this.doublingPlayer = null;
        this.broadcast(this.getState());
        return null;
      }

      default:
        return `Unknown action: ${action.type}`;
    }
  }

  /* Start AI for missing player after timeout */
  async startAiForColour(colour) {
    const game = this.game;
    if (game.winner) return;
    if (game.player !== colour) return;

    try {
      // Roll if needed
      if (game.turnPhase === 'roll') {
        const rollResult = game.roll();
        if (rollResult.error) return;
        this.broadcast(this.getState());
      }

      if (game.turnPhase === 'done') {
        game.pass();
        this.broadcast(this.getState());
        return;
      }

      // Get AI move
      let bestSeq = await getBestMove(game.board, game.dice, game.player, 'wildbg');
      if ((!bestSeq || !bestSeq.length) && game.activeMoves.length) {
        bestSeq = game.activeMoves[0];
      }

      for (const m of (bestSeq || [])) {
        if (game.turnPhase !== 'move') break;
        game.move(m.from, m.to, m.pip);
      }

      if (game.turnPhase === 'done' && !game.winner) {
        game.pass();
      }

      this.broadcast(this.getState());
    } catch (err) {
      console.error('[Room AI] error:', err.message);
    }
  }

  destroy() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
  }
}

/* ======================== ROOM MANAGER ============================= */
const rooms = new Map();

function getOrCreateRoom(instanceId) {
  if (!rooms.has(instanceId)) {
    rooms.set(instanceId, new Room(instanceId));
  }
  return rooms.get(instanceId);
}

function getRoom(instanceId) {
  return rooms.get(instanceId) || null;
}

function deleteRoom(instanceId) {
  const room = rooms.get(instanceId);
  if (room) {
    room.destroy();
    rooms.delete(instanceId);
  }
}

function getAllRooms() {
  return rooms;
}

module.exports = { Room, getOrCreateRoom, getRoom, deleteRoom, getAllRooms };

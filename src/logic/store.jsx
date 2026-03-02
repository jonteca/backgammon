/* ------------------------------------------------------------------ */
/*  store.js – main state & control logic (AI-ready, no AI pre-set)   */
/* ------------------------------------------------------------------ */
import React, { createContext, useContext, useReducer, useEffect } from "react";
import initialBoard                     from "./initialBoard";
import { PLAYERS }                      from "./constants";
import legalMoves, { applyMove }        from "./generateMoves";
import { getBestMove, AI_TYPES }        from "../ai/aiManager";
import { scoreGame, pipCount }           from "./scoring";

const BORNE_OFF = { black: 26, white: 27 };
const MOVE_DELAY = 600;           // ms between moves in an AI sequence
const DICE_DISPLAY_DELAY = 800;   // ms pause so dice are visible before AI moves
const AI_TIMEOUT = 10000;         // ms max thinking time

/* ---------- helpers --------------------------------------------- */
const roll = () => {
  const a = 1 + (Math.random() * 6) | 0;
  const b = 1 + (Math.random() * 6) | 0;
  return a === b ? [a, a, a, a] : [a, b];
};

const nextPlayer = p => PLAYERS[(PLAYERS.indexOf(p) + 1) % 2];

/* ---------- AI doubling heuristics ------------------------------ */
function shouldAiDouble(board, aiPlayer) {
  const mine = pipCount(board, aiPlayer);
  const opp  = pipCount(board, nextPlayer(aiPlayer));
  if (opp === 0) return false;           // opponent already bore off everything
  const advantage = (opp - mine) / opp;  // positive = AI is ahead
  return advantage >= 0.12;              // double with 12%+ pip lead
}

function shouldAiAccept(board, aiPlayer) {
  const mine = pipCount(board, aiPlayer);
  const opp  = pipCount(board, nextPlayer(aiPlayer));
  if (mine === 0) return true;           // already won the race
  const deficit = (mine - opp) / mine;   // positive = AI is behind
  return deficit < 0.25;                 // accept unless 25%+ behind
}

/* ---------- initial state --------------------------------------- */
const initState = {
  board       : initialBoard(),
  player      : "black",
  dice        : [],
  activeMoves : [],
  selected    : null,
  winner      : null,
  aiPlayers   : new Set(),      // nobody is AI until UI says so
  isAiThinking: false,
  aiTypes     : { black: AI_TYPES.WILDBG, white: AI_TYPES.WILDBG },
  lastError   : null,
  aiTurnId    : 0,              // increments each AI ROLL to trigger effect

  /* doubling cube */
  cubeValue     : 1,
  cubeOwner     : null,         // null = centered, "black" or "white"
  doubleOffered : false,
  doublingPlayer: null,

  /* match scoring */
  matchLength : 0,              // 0 = unlimited/money play
  matchScore  : { black: 0, white: 0 },
  gameResult  : null,           // { winner, type, points }
  matchWinner : null,
  crawford    : false,          // is this the Crawford game?
  crawfordUsed: false,          // has the Crawford game been played?

  /* online multiplayer */
  mode        : "local",        // "local" | "online"
  myColour    : null,           // which colour this client controls
  onlinePlayers: {},            // { black: userId, white: userId }
  playerCount : 0,
};

/* ---------- compute Crawford for next game ---------------------- */
function computeCrawford(matchLength, matchScore, prevCrawfordUsed) {
  if (matchLength <= 0) return { crawford: false, crawfordUsed: false };
  const bNeedsOne = matchScore.black === matchLength - 1;
  const wNeedsOne = matchScore.white === matchLength - 1;
  if ((bNeedsOne || wNeedsOne) && !prevCrawfordUsed) {
    return { crawford: true, crawfordUsed: true };
  }
  return { crawford: false, crawfordUsed: prevCrawfordUsed };
}

/* ---------- end-of-game helper ---------------------------------- */
function endGame(state, winner, board) {
  const result   = scoreGame(board, winner, state.cubeValue);
  const newScore = {
    ...state.matchScore,
    [winner]: state.matchScore[winner] + result.points
  };
  const mw = state.matchLength > 0 && newScore[winner] >= state.matchLength
    ? winner : null;
  return {
    winner, gameResult: result, matchScore: newScore, matchWinner: mw,
    dice: [], activeMoves: [], selected: null, isAiThinking: false
  };
}

/* ---------- reducer --------------------------------------------- */
function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return {
        ...initState,
        aiPlayers: state.aiPlayers,
        aiTypes: state.aiTypes,
        matchLength: state.matchLength
      };

    case "ROLL": {
      if (state.doubleOffered) return state;
      const dice  = roll();
      const moves = legalMoves(state.board, state.player, dice);
      const isAi  = state.aiPlayers.has(state.player);
      return { ...state, dice, activeMoves: moves, selected: null,
               isAiThinking: isAi,
               lastError: null,
               aiTurnId: isAi ? state.aiTurnId + 1 : state.aiTurnId };
    }

    case "SELECT":
      return { ...state, selected: action.point };

    case "MOVE": {
      const { from, to, pip } = action;
      const board    = structuredClone(state.board);
      applyMove(board, state.player, from, to);

      const diceLeft = state.dice.slice();
      const idx      = diceLeft.indexOf(pip);
      if (idx !== -1) diceLeft.splice(idx, 1);

      const win =
        board[BORNE_OFF.black]?.n === 15 ? "black" :
        board[BORNE_OFF.white]?.n === 15 ? "white" : null;

      if (win) {
        return { ...state, board, ...endGame(state, win, board) };
      }

      /* still have dice left – check if any legal moves remain */
      if (diceLeft.length) {
        const moves = legalMoves(board, state.player, diceLeft);
        if (moves.length) {
          return { ...state,
            board, dice: diceLeft, activeMoves: moves,
            selected: null, winner: null
          };
        }
        /* no legal moves with remaining dice → end turn */
      }

      const who = nextPlayer(state.player);
      return { ...state,
        board,
        dice       : [],
        player     : who,
        activeMoves: [],
        selected   : null,
        winner     : null,
        isAiThinking: false
      };
    }

    case "AI_DONE":
      return { ...state, isAiThinking: false, selected: null };

    case "AI_CHECK_REMAINING":
      /* AI dispatched all its moves but dice remain — re-trigger AI */
      if (state.dice.length > 0 && state.activeMoves.length > 0 && state.isAiThinking) {
        return { ...state, aiTurnId: state.aiTurnId + 1 };
      }
      return state;

    case "SET_AI_PLAYERS":
      return { ...state, aiPlayers: new Set(action.players) };

    case "SET_AI_TYPE":
      return { ...state,
        aiTypes: { ...state.aiTypes, [action.player]: action.aiType }
      };

    case "AI_ERROR":
      return { ...state, isAiThinking: false, lastError: action.error,
               dice: [], activeMoves: [] };

    case "CLEAR_ERROR":
      return { ...state, lastError: null };

    case "PASS_TURN":
      return { ...state,
        player: action.nextPlayer,
        dice: [], activeMoves: [], selected: null,
        isAiThinking: false
      };

    /* ---------- doubling cube ------------------------------------ */
    case "OFFER_DOUBLE":
      return { ...state, doubleOffered: true, doublingPlayer: state.player };

    case "ACCEPT_DOUBLE":
      return { ...state,
        cubeValue     : state.cubeValue * 2,
        cubeOwner     : nextPlayer(state.doublingPlayer), // accepter owns it
        doubleOffered : false,
        doublingPlayer: null
      };

    case "DECLINE_DOUBLE": {
      const winner = state.doublingPlayer; // offerer wins
      return { ...state,
        board: state.board,
        ...endGame(state, winner, state.board)
      };
    }

    /* ---------- match scoring ------------------------------------ */
    case "SET_MATCH_LENGTH":
      return { ...state, matchLength: action.length };

    case "NEXT_GAME": {
      const craw = computeCrawford(
        state.matchLength, state.matchScore, state.crawfordUsed
      );
      return {
        ...initState,
        aiPlayers   : state.aiPlayers,
        aiTypes     : state.aiTypes,
        matchLength : state.matchLength,
        matchScore  : state.matchScore,
        crawford    : craw.crawford,
        crawfordUsed: craw.crawfordUsed
      };
    }

    /* ---------- online multiplayer --------------------------------- */
    case "SET_ONLINE":
      return { ...state,
        mode: "online",
        myColour: action.colour,
        aiPlayers: new Set(),   // disable AI toggles in online mode
      };

    case "SYNC_STATE": {
      // Server-authoritative state replaces board/dice/player
      const s = action.serverState;
      const moves = legalMoves(s.board, s.player, s.dice || []);
      return { ...state,
        board          : s.board,
        player         : s.player,
        dice           : s.dice || [],
        winner         : s.winner,
        activeMoves    : moves,
        selected       : null,
        isAiThinking   : false,
        onlinePlayers  : s.players || {},
        playerCount    : s.playerCount || 0,
        cubeValue      : s.cubeValue ?? state.cubeValue,
        cubeOwner      : s.cubeOwner !== undefined ? s.cubeOwner : state.cubeOwner,
        doubleOffered  : s.doubleOffered ?? state.doubleOffered,
        doublingPlayer : s.doublingPlayer !== undefined ? s.doublingPlayer : state.doublingPlayer,
      };
    }

    default:
      return state;
  }
}

/* ---------- context --------------------------------------------- */
const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

/* ---------- provider -------------------------------------------- */
export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initState);

  /* AI think loop ------------------------------------------------ */
  useEffect(() => {
    if (state.mode === "online") return;
    if (!state.isAiThinking || !state.aiTurnId) return;
    let cancelled = false;
    let timerIds = [];

    console.log(`[AI turn ${state.aiTurnId}] ${state.player} thinking, dice:`, state.dice);

    (async () => {
      try {
        const seq = await Promise.race([
          getBestMove(state.board, state.dice, state.player, state.aiTypes[state.player]),
          new Promise((_, rej) => {
            timerIds.push(setTimeout(() => rej(new Error("AI timeout")), AI_TIMEOUT));
          })
        ]);
        if (cancelled) { console.log(`[AI turn ${state.aiTurnId}] cancelled`); return; }

        console.log(`[AI turn ${state.aiTurnId}] got ${seq?.length || 0} moves`);

        if (seq?.length) {
          seq.forEach((m, i) => {
            timerIds.push(setTimeout(() => {
              if (!cancelled) dispatch({ type: "MOVE", ...m });
            }, DICE_DISPLAY_DELAY + i * MOVE_DELAY));
          });
          // After all moves dispatched, check if dice remain (AI returned partial sequence)
          timerIds.push(setTimeout(() => {
            if (!cancelled) dispatch({ type: "AI_CHECK_REMAINING" });
          }, DICE_DISPLAY_DELAY + seq.length * MOVE_DELAY));
        } else {
          timerIds.push(setTimeout(() => {
            if (!cancelled) dispatch({ type: "PASS_TURN", nextPlayer: nextPlayer(state.player) });
          }, DICE_DISPLAY_DELAY));
        }
      } catch (e) {
        console.error(`[AI turn ${state.aiTurnId}] error:`, e.message);
        if (!cancelled) dispatch({ type: "AI_ERROR", error: e.message });
      }
    })();

    return () => {
      cancelled = true;
      timerIds.forEach(clearTimeout);
    };
  }, [state.aiTurnId]);

  /* auto-pass when a human rolls but has no legal moves --------- */
  useEffect(() => {
    if (state.mode === "online") return;
    if (
      state.dice.length > 0 &&
      state.activeMoves.length === 0 &&
      !state.winner &&
      !state.isAiThinking
    ) {
      const t = setTimeout(() => {
        dispatch({ type: "PASS_TURN", nextPlayer: nextPlayer(state.player) });
      }, MOVE_DELAY);
      return () => clearTimeout(t);
    }
  }, [state.dice, state.activeMoves, state.winner, state.isAiThinking, state.player]);

  /* auto-clear AI errors after a short delay so the game recovers */
  useEffect(() => {
    if (state.lastError) {
      console.warn("[AI error]", state.lastError);
      const t = setTimeout(() => dispatch({ type: "CLEAR_ERROR" }), 2000);
      return () => clearTimeout(t);
    }
  }, [state.lastError]);

  /* auto-roll (or double) whenever an idle AI has the dice ------- */
  useEffect(() => {
    if (state.mode === "online") return;
    if (
      state.aiPlayers.has(state.player) &&
      state.dice.length === 0 &&
      !state.winner &&
      !state.lastError &&
      !state.isAiThinking &&
      !state.doubleOffered
    ) {
      const canAiDouble = !state.crawford &&
        (state.cubeOwner === null || state.cubeOwner === state.player);

      if (canAiDouble && shouldAiDouble(state.board, state.player)) {
        const t = setTimeout(() => dispatch({ type: "OFFER_DOUBLE" }), MOVE_DELAY);
        return () => clearTimeout(t);
      }

      const t = setTimeout(() => dispatch({ type: "ROLL" }), MOVE_DELAY);
      return () => clearTimeout(t);
    }
  }, [
    state.player,
    state.dice,
    state.aiPlayers,
    state.winner,
    state.isAiThinking,
    state.lastError,
    state.doubleOffered,
    state.crawford,
    state.cubeOwner,
    state.board
  ]);

  /* AI responds to doubles (accept or decline based on pip count) */
  useEffect(() => {
    if (state.mode === "online") return;
    if (
      state.doubleOffered &&
      state.aiPlayers.has(nextPlayer(state.doublingPlayer))
    ) {
      const aiPlayer = nextPlayer(state.doublingPlayer);
      const accept = shouldAiAccept(state.board, aiPlayer);
      const t = setTimeout(() => {
        dispatch({ type: accept ? "ACCEPT_DOUBLE" : "DECLINE_DOUBLE" });
      }, MOVE_DELAY);
      return () => clearTimeout(t);
    }
  }, [state.doubleOffered, state.doublingPlayer, state.aiPlayers, state.board]);

  return <GameCtx.Provider value={[state, dispatch]}>{children}</GameCtx.Provider>;
};

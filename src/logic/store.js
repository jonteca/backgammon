/* ------------------------------------------------------------------ */
/*  store.js – main state & control logic (AI-ready, no AI pre-set)   */
/* ------------------------------------------------------------------ */
import React, { createContext, useContext, useReducer, useEffect } from "react";
import initialBoard                     from "./initialBoard";
import { PLAYERS }                      from "./constants";
import legalMoves, { applyMove }        from "./generateMoves";
import { getBestMove, AI_TYPES }        from "../ai/aiManager";

const BORNE_OFF = { black: 26, white: 27 };
const MOVE_DELAY = 600;           // ms between moves in an AI sequence
const AI_TIMEOUT = 10000;         // ms max thinking time

/* ---------- helpers --------------------------------------------- */
const roll = () => {
  const a = 1 + (Math.random() * 6) | 0;
  const b = 1 + (Math.random() * 6) | 0;
  return a === b ? [a, a, a, a] : [a, b];
};

const nextPlayer = p => PLAYERS[(PLAYERS.indexOf(p) + 1) % 2];

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
  aiType      : AI_TYPES.WILDBG,
  lastError   : null
};

/* ---------- reducer --------------------------------------------- */
function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return { ...initState, aiPlayers: state.aiPlayers, aiType: state.aiType };

    case "ROLL": {
      const dice  = roll();
      const moves = legalMoves(state.board, state.player, dice);
      return { ...state, dice, activeMoves: moves, selected: null,
               isAiThinking: state.aiPlayers.has(state.player) };
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

      /* still have dice left – check if any legal moves remain */
      if (diceLeft.length) {
        const moves = legalMoves(board, state.player, diceLeft);
        if (moves.length) {
          return { ...state,
            board, dice: diceLeft, activeMoves: moves,
            selected: null, winner: win
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
        winner     : win,
        isAiThinking: state.aiPlayers.has(who)
      };
    }

    case "AI_DONE":
      return { ...state, isAiThinking: false, selected: null };

    case "SET_AI_PLAYERS":
      return { ...state, aiPlayers: new Set(action.players) };

    case "SET_AI_TYPE":
      return { ...state, aiType: action.aiType };

    case "AI_ERROR":
      return { ...state, isAiThinking: false, lastError: action.error };

    case "CLEAR_ERROR":
      return { ...state, lastError: null };

    case "TOGGLE_AI_TYPE":
      return { ...state,
        aiType: state.aiType === AI_TYPES.WILDBG ? AI_TYPES.LOCAL : AI_TYPES.WILDBG
      };

    case "PASS_TURN":
      return { ...state,
        player: action.nextPlayer,
        dice: [], activeMoves: [], selected: null,
        isAiThinking: false
      };

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
    if (!state.isAiThinking) return;
    let timerIds = [];

    const cleanup = () => timerIds.forEach(clearTimeout);

    (async () => {
      try {
        const seq = await Promise.race([
          getBestMove(state.board, state.dice, state.player, state.aiType),
          new Promise((_, rej) => setTimeout(() => rej(new Error("AI timeout")), AI_TIMEOUT))
        ]);

        if (seq?.length) {
          seq.forEach((m, i) => {
            timerIds.push(setTimeout(
              () => dispatch({ type: "MOVE", ...m }),
              i * MOVE_DELAY
            ));
          });
          timerIds.push(setTimeout(
            () => dispatch({ type: "AI_DONE" }),
            seq.length * MOVE_DELAY
          ));
        } else {
          dispatch({ type: "PASS_TURN", nextPlayer: nextPlayer(state.player) });
          dispatch({ type: "AI_DONE" });
        }
      } catch (e) {
        dispatch({ type: "AI_ERROR", error: e.message });
      }
    })();

    return cleanup;
  }, [state.isAiThinking]);

  /* auto-pass when a human rolls but has no legal moves --------- */
  useEffect(() => {
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

  /* auto-roll whenever an idle AI has the dice ------------------ */
  useEffect(() => {
    if (
      state.aiPlayers.has(state.player) &&
      state.dice.length === 0 &&
      !state.winner &&
      !state.lastError &&
      !state.isAiThinking
    ) {
      const t = setTimeout(() => dispatch({ type: "ROLL" }), MOVE_DELAY);
      return () => clearTimeout(t);
    }
  }, [
    state.player,
    state.dice,
    state.aiPlayers,
    state.winner,
    state.isAiThinking,
    state.lastError
  ]);

  return <GameCtx.Provider value={[state, dispatch]}>{children}</GameCtx.Provider>;
};

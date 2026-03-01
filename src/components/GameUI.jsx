import React from "react";
import { useGame } from "../logic/store";
import "./GameUI.css";

export default function GameUI() {
  const [state, dispatch] = useGame();
  const {
    dice, player, winner, aiPlayers, isAiThinking, lastError,
    matchScore, matchLength, gameResult, matchWinner, cubeValue,
    doubleOffered, crawford
  } = state;

  const toggleAI = (player) => {
    const newAiPlayers = new Set(aiPlayers);
    if (newAiPlayers.has(player)) {
      newAiPlayers.delete(player);
    } else {
      newAiPlayers.add(player);
    }
    dispatch({ type: "SET_AI_PLAYERS", players: Array.from(newAiPlayers) });
    if (lastError) {
      dispatch({ type: "CLEAR_ERROR" });
    }
  };

  const toggleAllAI = () => {
    if (aiPlayers.size === 2) {
      dispatch({ type: "SET_AI_PLAYERS", players: [] });
    } else {
      dispatch({ type: "SET_AI_PLAYERS", players: ["black", "white"] });
    }
    if (lastError) {
      dispatch({ type: "CLEAR_ERROR" });
    }
  };

  const startNewGame = () => {
    dispatch({ type: "NEW_GAME" });
    if (lastError) {
      dispatch({ type: "CLEAR_ERROR" });
    }
  };

  const retryTurn = () => {
    dispatch({ type: "CLEAR_ERROR" });
    dispatch({ type: "ROLL" });
  };

  return (
    <div className="ui">
      {winner ? (
        <>
          <h2>{winner.toUpperCase()} wins!</h2>
          {gameResult && (
            <p style={{ margin: "4px 0" }}>
              {gameResult.type === "backgammon" ? "Backgammon! " :
               gameResult.type === "gammon" ? "Gammon! " : ""}
              {gameResult.points} point{gameResult.points !== 1 ? "s" : ""}
              {cubeValue > 1 && ` (cube: ${cubeValue}x)`}
            </p>
          )}
          <p style={{ margin: "4px 0" }}>
            Score: {matchScore.black} — {matchScore.white}
            {matchLength > 0 && ` / ${matchLength}`}
          </p>
          {matchWinner ? (
            <>
              <p style={{ fontWeight: 700, color: "#ffd700" }}>
                {matchWinner.toUpperCase()} wins the match!
              </p>
              <button
                onClick={startNewGame}
                style={{
                  padding: "12px 24px", fontSize: 18, fontWeight: 700,
                  background: "linear-gradient(#4a90e2,#357abd 50%,#2f6fab)",
                  color: "#fff", border: "none", borderRadius: 8,
                  cursor: "pointer", marginTop: 10
                }}
              >
                New Match
              </button>
            </>
          ) : (
            <button
              onClick={() => dispatch({ type: "NEXT_GAME" })}
              style={{
                padding: "12px 24px", fontSize: 18, fontWeight: 700,
                background: "linear-gradient(#66c06f,#4CAF50 60%,#3b8f3d)",
                color: "#fff", border: "none", borderRadius: 8,
                cursor: "pointer", marginTop: 10
              }}
            >
              Next Game
            </button>
          )}
        </>
      ) : (
        <>
          {lastError && (
            <div className="error-message" style={{
              backgroundColor: "#fee",
              border: "1px solid #faa",
              padding: "10px",
              margin: "10px 0",
              borderRadius: "4px"
            }}>
              <p>AI Error: {lastError}</p>
              <button onClick={retryTurn}>Retry Turn</button>
              <button onClick={() => dispatch({ type: "CLEAR_ERROR" })}>Dismiss</button>
            </div>
          )}

          <button
            onClick={() => dispatch({ type: "ROLL" })}
            disabled={isAiThinking || lastError || dice.length > 0 || doubleOffered}
          >
            Roll Dice
          </button>

          <span className="dice">
            {isAiThinking ? "AI thinking..." : (dice.length ? dice.join(" , ") : "roll!")}
          </span>

          <span className="turn">
            Turn: {player} {aiPlayers.has(player) ? "(AI)" : ""}
            {crawford && " [Crawford]"}
          </span>

          <span className="turn">
            Score: {matchScore.black} — {matchScore.white}
            {matchLength > 0 && ` / ${matchLength}`}
          </span>

          <button onClick={() => toggleAI("black")}>
            {aiPlayers.has("black") ? "Disable Black AI" : "Enable Black AI"}
          </button>

          <button onClick={() => toggleAI("white")}>
            {aiPlayers.has("white") ? "Disable White AI" : "Enable White AI"}
          </button>

          <button onClick={toggleAllAI}>
            {aiPlayers.size === 2 ? "Disable All AI" : "Watch AI vs AI"}
          </button>

          <button onClick={startNewGame}>New Game</button>
        </>
      )}
    </div>
  );
}

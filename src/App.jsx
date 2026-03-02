import React, { useEffect } from "react";
import "./App.css";
import Board2D from "./components/Board2D";
import GameUI from "./components/GameUI";
import { GameProvider, useGame } from "./logic/store";
import { isDiscordEmbedded, getInstanceId, getAuth } from "./discord";
import useMultiplayer from "./hooks/useMultiplayer";

/* Bridge component: connects WebSocket hook to store dispatch */
function MultiplayerBridge() {
  const [, dispatch] = useGame();
  const auth = getAuth();
  const userId = auth?.user?.id;
  const username = auth?.user?.username || auth?.user?.global_name;
  const instanceId = getInstanceId();

  const { myColour, serverState } = useMultiplayer(instanceId, userId, username);

  // Set online mode when colour assigned
  useEffect(() => {
    if (myColour) {
      dispatch({ type: "SET_ONLINE", colour: myColour });
    }
  }, [myColour, dispatch]);

  // Sync server state
  useEffect(() => {
    if (serverState) {
      dispatch({ type: "SYNC_STATE", serverState });
    }
  }, [serverState, dispatch]);

  return null;
}

export default function App() {
  const discord = isDiscordEmbedded();

  return (
    <GameProvider>
      {discord && <MultiplayerBridge />}
      <h1 className="title">Backgammon</h1>
      <GameUI />
      <Board2D />
    </GameProvider>
  );
}

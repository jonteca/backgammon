import React from "react";
import "./App.css";
import Board2D from "./components/Board2D";
import GameUI from "./components/GameUI";
import { GameProvider } from "./logic/store";

export default function App() {
  return (
    <GameProvider>
      <h1 className="title">Backgammon</h1>
      <GameUI />
      <Board2D />
    </GameProvider>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { isDiscordEmbedded, initDiscord } from "./discord";

const root = ReactDOM.createRoot(document.getElementById("root"));

async function boot() {
  if (isDiscordEmbedded()) {
    try {
      await initDiscord();
    } catch (err) {
      console.error("Discord SDK init failed:", err);
    }
  }
  root.render(<App />);
}

boot();

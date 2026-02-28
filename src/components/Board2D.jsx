/* ------------------------------------------------------------------ */
/*  Board2D.jsx – bar centred, single off‑strip, correct bear‑off      */
/* ------------------------------------------------------------------ */

import React, { useMemo, useState } from "react";
import { useGame } from "../logic/store";
import Dice from "./Dice";

/* geometry & palette ------------------------------------------------ */
const PT_W = 70, PT_H = 180;
const GAP = 70;                     // full middle band
const TIP_PAD = 10;                 // wedge stops 10 px before row edge
const BOARD_PAD = 8;                // top / bottom padding inside frame
const BAR_W = 70, OFF_W = 64;

const DARK = "#865129", LIGHT = "#d7b98b";
const BOARD_BG = "#c9a46c", RIM = "#543517";

/* ---------- primitives -------------------------------------------- */
const Disc = ({ colour, glow, onClick }) => {
  const base = colour === "black" ? "#7c0000" : "#f5f5f5";
  const rim  = colour === "black" ? "#430000" : "#989898";
  return (
    <div
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        background: base, border: `2px solid ${rim}`,
        boxShadow: glow ? `0 0 12px ${glow}` : "0 2px 4px rgba(0,0,0,.6)",
        cursor: "pointer"
      }}
    />
  );
};

const Triangle = ({ idx, discs, dest, onClick }) => {
  const top  = idx > 12;
  const dark = top ? idx % 2 === 0 : (idx + 1) % 2 === 0;
  const pct  = (TIP_PAD / PT_H) * 100;
  const clip = top
    ? `polygon(0 0,100% 0,50% ${100 - pct}%)`
    : `polygon(0 100%,100% 100%,50% ${pct}%)`;

  return (
    <div
      onClick={onClick}
      style={{
        width: PT_W, height: PT_H, position: "relative",
        background: dest ? "rgba(144,238,144,.25)" : "transparent",
        cursor: "pointer"
      }}
    >
      <div
        style={{
          position: "absolute", inset: 0, clipPath: clip,
          background: dark ? DARK : LIGHT,
          boxShadow: "inset 0 0 6px rgba(0,0,0,.4)"
        }}
      />
      <span
        style={{
          position: "absolute",
          top: top ? -22 : "auto",
          bottom: top ? "auto" : -22,
          left: "50%", transform: "translateX(-50%)",
          fontSize: 13, fontFamily: "Georgia,serif",
          color: "#f8f1d2", textShadow: "1px 1px 2px rgba(0,0,0,.75)"
        }}
      >
        {idx}
      </span>
      <div
        style={{
          position: "absolute",
          left: "50%", transform: "translateX(-50%)",
          top: top ? 4 : "auto", bottom: top ? "auto" : 4,
          display: "flex",
          flexDirection: top ? "column" : "column-reverse",
          gap: 2
        }}
      >
        {discs}
      </div>
      {dest && (
        <div
          style={{
            position: "absolute", inset: 0,
            border: "2px solid #90EE90",
            animation: "pulse 1.2s infinite"
          }}
        />
      )}
    </div>
  );
};

/*  stack / bar / off  --------------------------------------------- */
function Stack({ idx, board, onClick, grow = "top", dest = false }) {
  const slot = board[idx] || { n: 0, colour: null };

  /* show an empty placeholder when this off‑square is a legal dest */
  const showAll   = idx === 26 || idx === 27;              // borne‑off stacks show everything
  const maxVis    = showAll ? 15 : 5;
  const visible   = Math.min(maxVis, slot.n);

  return (
    <div
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 36,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        justifyContent: grow === "top" ? "flex-start" : "flex-end",
        position: "relative",
        cursor: dest || slot.n ? "pointer" : "default"
      }}
    >
      {slot.n === 0 && !dest && !showAll ? null : (
        Array.from({ length: visible }).map((_, i) => (
          <Disc key={i} colour={slot.colour} />
        ))
      )}
      {!showAll && slot.n > maxVis && (
        <span
          style={{
            fontWeight: 700,
            color: slot.colour === "black" ? "#fff" : "#000",
            textShadow: "0 0 2px rgba(0,0,0,.6)"
          }}
        >
          {slot.n}
        </span>
      )}

      {dest && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid #90EE90",
            borderRadius: 4,
            animation: "pulse 1.2s infinite"
          }}
        />
      )}
    </div>
  );
}

/* ---------- main board ------------------------------------------- */
export default function Board2D() {
  const [
    { board, selected, activeMoves, player, dice, aiType, isAiThinking, winner },
    dispatch
  ] = useGame();

  const [rolling, setRolling] = useState(false);
  const roll = () => {
    setRolling(true);
    setTimeout(() => {
      dispatch({ type: "ROLL" });
      setRolling(false);
    }, 600);
  };

  /* highlight sets */
  const { movable, dest } = useMemo(() => {
    const m = new Set(), d = new Set();
    if (activeMoves.length) {
      if (selected !== null)
        activeMoves.filter(s => s[0].from === selected).forEach(s => d.add(s[0].to));
      else activeMoves.forEach(s => m.add(s[0].from));
    }
    return { movable: m, dest: d };
  }, [activeMoves, selected]);

  const handle = (idx, pt) => {
    const bar = player === "black" ? 25 : 0;

    if (board[bar].n && board[bar].colour === player) {
      if (idx === bar)
        dispatch({ type: "SELECT", point: selected === idx ? null : idx });
      else if (dest.has(idx)) {
        const mv = activeMoves.find(s => s[0].from === selected && s[0].to === idx);
        if (mv) dispatch({ type: "MOVE", ...mv[0] });
      }
      return;
    }

    if (pt.colour === player && (movable.has(idx) || selected === idx)) {
      dispatch({ type: "SELECT", point: selected === idx ? null : idx });
    } else if (dest.has(idx)) {
      const mv = activeMoves.find(s => s[0].from === selected && s[0].to === idx);
      if (mv) dispatch({ type: "MOVE", ...mv[0] });
    }
  };

  const P = i => {
    const pt = board[i];
    const discs =
      pt?.n > 0
        ? Array.from({ length: pt.n }).map((_, k) => (
            <Disc
              key={k}
              colour={pt.colour}
              glow={selected === i ? "#ffd700" : movable.has(i) ? "#ffef99" : null}
              onClick={() => handle(i, pt)}
            />
          ))
        : [];
    return (
      <Triangle
        key={i}
        idx={i}
        discs={discs}
        dest={dest.has(i)}
        onClick={() => handle(i, pt)}
      />
    );
  };

  const topL = [24,23,22,21,20,19];
  const topR = [18,17,16,15,14,13];
  const botL = [1,2,3,4,5,6];
  const botR = [7,8,9,10,11,12];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#2c1810",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: 20
      }}
    >
      {/* header ---------------------------------------------------- */}
      <div
        style={{
          width: 1100,
          maxWidth: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>
            Player: <strong>{player}</strong>
          </span>

          {winner && (
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#90EE90",
                animation: "pulse 1.2s infinite"
              }}
            >
              {winner.toUpperCase()} wins!
            </span>
          )}

          <button
            onClick={() => dispatch({ type: "TOGGLE_AI_TYPE" })}
            style={{
              padding: "6px 12px",
              fontSize: 14,
              background: "#4a2c18",
              color: "#fff",
              border: "1px solid #865129",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            AI: {aiType}
          </button>

          {isAiThinking && (
            <span
              style={{
                color: "#90EE90",
                fontSize: 14,
                fontStyle: "italic"
              }}
              className="thinking-dots"
            />
          )}

          {dice.length && activeMoves.length > 0 && (
            <Dice values={dice} rolling={rolling} />
          )}
        </div>

        <button
          onClick={roll}
          disabled={(dice.length && activeMoves.length) || winner}
          style={{
            padding: "10px 22px",
            fontSize: 16,
            fontWeight: 700,
            background:
              (dice.length && activeMoves.length) || winner
                ? "#555"
                : "linear-gradient(#66c06f,#4CAF50 60%,#3b8f3d)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: (dice.length && activeMoves.length) || winner
              ? "not-allowed"
              : "pointer"
          }}
        >
          {winner ? "Game Over" : "Roll"}
        </button>
      </div>

      {/* main board --------------------------------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${OFF_W}px repeat(6,${PT_W}px) ${BAR_W}px repeat(6,${PT_W}px)`,
          gridTemplateRows: `${BOARD_PAD}px ${PT_H}px ${GAP}px ${PT_H}px ${BOARD_PAD}px`,
          background: BOARD_BG,
          border: `8px solid ${RIM}`,
          borderRadius: 12
        }}
      >
        <div style={{ gridColumn: "1 / -1", gridRow: 1 }} />

        {/* Left bearing off */}
        <div
          style={{
            gridColumn: 1,
            gridRow: "2 / span 3",
            width: OFF_W,
            background: LIGHT,
            border: `1px solid ${RIM}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0"
          }}
        >
          <Stack idx={26} board={board} onClick={() => handle(26, board[26])} grow="top" dest={dest.has(26)} />
          <Stack idx={27} board={board} onClick={() => handle(27, board[27])} grow="bottom" dest={dest.has(27)} />
        </div>

        {topL.map((i, c) => (
          <div key={i} style={{ gridColumn: c + 2, gridRow: 2 }}>{P(i)}</div>
        ))}

        {/* BAR */}
        <div
          style={{
            gridColumn: 8,
            gridRow: "2 / span 3",
            width: BAR_W,
            background:
              "repeating-linear-gradient(135deg,#4a2c18 0 8px,#5d3d21 8px 16px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0"
          }}
        >
          <Stack idx={0}  board={board} onClick={() => handle(0,  board[0])}  grow="top"    dest={dest.has(0)} />
          <Stack idx={25} board={board} onClick={() => handle(25, board[25])} grow="bottom" dest={dest.has(25)} />
        </div>

        {topR.map((i, c) => (
          <div key={i} style={{ gridColumn: c + 9, gridRow: 2 }}>{P(i)}</div>
        ))}

        {/* gap row 3 */}

        {botL.map((i, c) => (
          <div key={i} style={{ gridColumn: c + 2, gridRow: 4 }}>{P(i)}</div>
        ))}
        {botR.map((i, c) => (
          <div key={i} style={{ gridColumn: c + 9, gridRow: 4 }}>{P(i)}</div>
        ))}

        <div style={{ gridColumn: "1 / -1", gridRow: 5 }} />
      </div>

      {/* CSS for pulse & thinking dots --------------------------- */}
      <style>{`
        @keyframes pulse{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}
        @keyframes thinking{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
        .thinking-dots::after{content:'';animation:thinking 1.4s steps(4,end) infinite}
      `}</style>
    </div>
  );
}

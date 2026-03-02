/* ------------------------------------------------------------------ */
/*  Board2D.jsx – bar centred, single off‑strip, correct bear‑off      */
/* ------------------------------------------------------------------ */

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useGame } from "../logic/store";
import { AI_TYPES } from "../ai/aiManager";
import { wsSend } from "../hooks/multiplayerSend";
import Dice from "./Dice";

/* geometry & palette ------------------------------------------------ */
const PT_W = 70, PT_H = 180;
const GAP = 70;                     // full middle band
const TIP_PAD = 10;                 // wedge stops 10 px before row edge
const BOARD_PAD = 8;                // top / bottom padding inside frame
const BAR_W = 70, OFF_W = 64;

const DARK = "#865129", LIGHT = "#d7b98b";
const BOARD_BG = "#c9a46c", RIM = "#543517";

/* ---------- primitives -------------------------------------------- */
const DISC_SIZE = 36;
const Disc = ({ colour, glow, onClick }) => {
  const grad = colour === "black"
    ? "radial-gradient(circle at 35% 35%, #d44, #7c0000 70%, #430000)"
    : "radial-gradient(circle at 35% 35%, #fff, #f5f5f5 60%, #ccc)";
  const rim  = colour === "black" ? "#430000" : "#989898";
  return (
    <div
      onClick={onClick}
      style={{
        width: DISC_SIZE, height: DISC_SIZE, borderRadius: "50%",
        background: grad, border: `2px solid ${rim}`,
        boxShadow: glow ? `0 0 12px ${glow}` : "0 2px 4px rgba(0,0,0,.6)",
        cursor: "pointer",
        flexShrink: 0
      }}
    />
  );
};

const Triangle = ({ idx, discs, count, dest, onClick }) => {
  const top  = idx > 12;
  const dark = top ? idx % 2 === 0 : (idx + 1) % 2 === 0;
  const pct  = (TIP_PAD / PT_H) * 100;
  const clip = top
    ? `polygon(0 0,100% 0,50% ${100 - pct}%)`
    : `polygon(0 100%,100% 100%,50% ${pct}%)`;

  /* dynamic stacking: absolute position each disc, compress when needed */
  const available = PT_H - TIP_PAD - 8;
  const naturalStep = DISC_SIZE + 2;
  const step = count > 1 && count * naturalStep > available
    ? (available - DISC_SIZE) / (count - 1)
    : naturalStep;

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
      {discs.map((disc, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%", transform: "translateX(-50%)",
            [top ? "top" : "bottom"]: 4 + i * step,
            zIndex: i
          }}
        >
          {disc}
        </div>
      ))}
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
const CHIP_H = 10;

function Stack({ idx, board, onClick, grow = "top", dest = false }) {
  const slot = board[idx] || { n: 0, colour: null };
  const isOff = idx === 26 || idx === 27;
  const stackH = 190; /* half the bearing-off / bar column */

  if (isOff) {
    /* borne-off: thin horizontal chips like real backgammon tray */
    const naturalStep = CHIP_H + 1;
    const step = slot.n > 1 && slot.n * naturalStep > stackH
      ? (stackH - CHIP_H) / (slot.n - 1)
      : naturalStep;

    return (
      <div
        onClick={onClick}
        style={{
          width: "100%", height: stackH, position: "relative",
          cursor: dest || slot.n ? "pointer" : "default"
        }}
      >
        {Array.from({ length: slot.n }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%", transform: "translateX(-50%)",
              [grow === "top" ? "top" : "bottom"]: i * step,
              width: 48, height: CHIP_H, borderRadius: 3,
              background: slot.colour === "black"
                ? "linear-gradient(to bottom, #d44, #7c0000)"
                : "linear-gradient(to bottom, #fff, #ccc)",
              border: `1px solid ${slot.colour === "black" ? "#430000" : "#989898"}`,
              boxShadow: "0 1px 2px rgba(0,0,0,.4)",
              zIndex: i
            }}
          />
        ))}
        {dest && (
          <div
            style={{
              position: "absolute", inset: 0,
              border: "2px solid #90EE90", borderRadius: 4,
              animation: "pulse 1.2s infinite"
            }}
          />
        )}
      </div>
    );
  }

  /* bar: round discs with absolute positioning for overlap */
  const naturalStep = DISC_SIZE + 2;
  const step = slot.n > 1 && slot.n * naturalStep > stackH
    ? (stackH - DISC_SIZE) / (slot.n - 1)
    : naturalStep;

  return (
    <div
      onClick={onClick}
      style={{
        width: "100%", height: stackH, position: "relative",
        cursor: dest || slot.n ? "pointer" : "default"
      }}
    >
      {Array.from({ length: slot.n }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%", transform: "translateX(-50%)",
            [grow === "top" ? "top" : "bottom"]: i * step,
            zIndex: i
          }}
        >
          <Disc colour={slot.colour} />
        </div>
      ))}
      {dest && (
        <div
          style={{
            position: "absolute", inset: 0,
            border: "2px solid #90EE90", borderRadius: 4,
            animation: "pulse 1.2s infinite"
          }}
        />
      )}
    </div>
  );
}

/* ---------- doubling cube widget --------------------------------- */
const CUBE_SIZE = 40;
function DoublingCube({ value, owner }) {
  const borderCol = owner === "black" ? "#d44" : owner === "white" ? "#ccc" : "#886";
  return (
    <div style={{
      width: CUBE_SIZE, height: CUBE_SIZE,
      background: "linear-gradient(135deg, #f5f0e0, #d4c8a0)",
      border: `3px solid ${borderCol}`,
      borderRadius: 6,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 900, fontSize: value >= 32 ? 14 : 18,
      color: "#333", fontFamily: "Georgia,serif",
      boxShadow: "0 2px 6px rgba(0,0,0,.5)"
    }}>
      {value}
    </div>
  );
}

/* ---------- button style helpers --------------------------------- */
const btnStyle = (bg, disabled) => ({
  padding: "8px 18px",
  fontSize: 14,
  fontWeight: 700,
  background: disabled ? "#555" : bg,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: disabled ? "not-allowed" : "pointer"
});

/* ---------- main board ------------------------------------------- */
export default function Board2D() {
  const [state, dispatch] = useGame();
  const {
    board, selected, activeMoves, player, dice, aiTypes, isAiThinking, winner,
    aiPlayers, cubeValue, cubeOwner, doubleOffered, doublingPlayer,
    matchLength, matchScore, gameResult, matchWinner, crawford,
    mode, myColour
  } = state;
  const online = mode === "online";
  const isMyTurn = !online || player === myColour;

  const [rolling, setRolling] = useState(false);
  const rollDice = () => {
    if (online) {
      wsSend({ type: 'roll' });
    } else {
      setRolling(true);
      setTimeout(() => {
        dispatch({ type: "ROLL" });
        setRolling(false);
      }, 600);
    }
  };

  const isHuman = online ? isMyTurn : !aiPlayers.has(player);
  const canDouble = isHuman &&
    dice.length === 0 &&
    !winner &&
    !doubleOffered &&
    !isAiThinking &&
    !crawford &&
    (cubeOwner === null || cubeOwner === player);
  const respondingToDouble = doubleOffered && (
    online
      ? myColour !== doublingPlayer   // online: I'm the opponent being doubled
      : isHuman && player !== doublingPlayer
  );

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

  const doMove = (mv) => {
    if (online) {
      wsSend({ type: 'move', from: mv.from, to: mv.to, pip: mv.pip });
    } else {
      dispatch({ type: "MOVE", ...mv });
    }
  };

  const handle = (idx, pt) => {
    if (online && !isMyTurn) return; // can't interact when not your turn

    const bar = player === "black" ? 25 : 0;

    if (board[bar].n && board[bar].colour === player) {
      if (idx === bar)
        dispatch({ type: "SELECT", point: selected === idx ? null : idx });
      else if (dest.has(idx)) {
        const mv = activeMoves.find(s => s[0].from === selected && s[0].to === idx);
        if (mv) doMove(mv[0]);
      }
      return;
    }

    if (pt.colour === player && (movable.has(idx) || selected === idx)) {
      dispatch({ type: "SELECT", point: selected === idx ? null : idx });
    } else if (dest.has(idx)) {
      const mv = activeMoves.find(s => s[0].from === selected && s[0].to === idx);
      if (mv) doMove(mv[0]);
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
        count={pt?.n || 0}
        dest={dest.has(i)}
        onClick={() => handle(i, pt)}
      />
    );
  };

  const topL = [24,23,22,21,20,19];
  const topR = [18,17,16,15,14,13];
  const botL = [1,2,3,4,5,6];
  const botR = [7,8,9,10,11,12];

  const rollDisabled = (dice.length && activeMoves.length) || winner || doubleOffered
    || (online && !isMyTurn);

  const MATCH_OPTIONS = [0, 3, 5, 7, 11];

  /* Responsive scaling: shrink to fit Discord's resizable panel */
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const recalcScale = useCallback(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = inner.scrollWidth;
    const ih = inner.scrollHeight;
    const s = Math.min(1, cw / iw, ch / ih);
    setScale(s);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recalcScale);
    ro.observe(el);
    recalcScale();
    return () => ro.disconnect();
  }, [recalcScale]);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: "#2c1810",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
    <div
      ref={innerRef}
      style={{
        transform: scale < 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: 20,
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

          <DoublingCube value={cubeValue} owner={cubeOwner} />

          {/* match score */}
          <span style={{
            fontFamily: "Georgia,serif", fontSize: 16,
            background: "#4a2c18", padding: "4px 12px",
            borderRadius: 4, border: "1px solid #865129"
          }}>
            <span style={{ color: "#f88" }}>{matchScore.black}</span>
            {" — "}
            <span style={{ color: "#eee" }}>{matchScore.white}</span>
            {matchLength > 0 && (
              <span style={{ fontSize: 12, color: "#a98" }}>
                {" "}(first to {matchLength})
              </span>
            )}
          </span>

          {crawford && (
            <span style={{
              fontSize: 12, color: "#ffd700",
              background: "#4a2c18", padding: "3px 8px",
              borderRadius: 4, border: "1px solid #865129"
            }}>
              Crawford
            </span>
          )}

          {["black", "white"].map(p => aiPlayers.has(p) && (
            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontSize: 12, color: p === "black" ? "#f88" : "#eee"
              }}>
                {p[0].toUpperCase()} AI:
              </span>
              <select
                value={aiTypes[p]}
                onChange={e => dispatch({ type: "SET_AI_TYPE", player: p, aiType: e.target.value })}
                style={{
                  padding: "4px 6px", fontSize: 12,
                  background: "#4a2c18", color: "#fff",
                  border: "1px solid #865129", borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                {Object.values(AI_TYPES).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </span>
          ))}

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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* match length selector */}
          <select
            value={matchLength}
            onChange={e => dispatch({ type: "SET_MATCH_LENGTH", length: Number(e.target.value) })}
            style={{
              padding: "6px 8px", fontSize: 13,
              background: "#4a2c18", color: "#fff",
              border: "1px solid #865129", borderRadius: 4,
              cursor: "pointer"
            }}
          >
            {MATCH_OPTIONS.map(n => (
              <option key={n} value={n}>
                {n === 0 ? "Unlimited" : `${n} pt match`}
              </option>
            ))}
          </select>

          {/* double button */}
          {canDouble && (
            <button
              onClick={() => online ? wsSend({ type: 'offer_double' }) : dispatch({ type: "OFFER_DOUBLE" })}
              style={btnStyle("linear-gradient(#e6a832,#c88c20 60%,#a67018)", false)}
            >
              Double
            </button>
          )}

          {/* accept / decline */}
          {respondingToDouble && (
            <>
              <span style={{ fontFamily: "Georgia,serif", fontSize: 14 }}>
                Double to {cubeValue * 2}?
              </span>
              <button
                onClick={() => online ? wsSend({ type: 'accept_double' }) : dispatch({ type: "ACCEPT_DOUBLE" })}
                style={btnStyle("linear-gradient(#66c06f,#4CAF50 60%,#3b8f3d)", false)}
              >
                Accept
              </button>
              <button
                onClick={() => online ? wsSend({ type: 'decline_double' }) : dispatch({ type: "DECLINE_DOUBLE" })}
                style={btnStyle("linear-gradient(#e05555,#c03030 60%,#992020)", false)}
              >
                Decline
              </button>
            </>
          )}

          {/* roll button */}
          <button
            onClick={rollDice}
            disabled={rollDisabled}
            style={{
              padding: "10px 22px",
              fontSize: 16,
              fontWeight: 700,
              background: rollDisabled
                ? "#555"
                : "linear-gradient(#66c06f,#4CAF50 60%,#3b8f3d)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: rollDisabled ? "not-allowed" : "pointer"
            }}
          >
            {winner ? "Game Over" : "Roll"}
          </button>
        </div>
      </div>

      {/* main board --------------------------------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${OFF_W}px repeat(6,${PT_W}px) ${BAR_W}px repeat(6,${PT_W}px)`,
          gridTemplateRows: `${BOARD_PAD}px ${PT_H}px ${GAP}px ${PT_H}px ${BOARD_PAD}px`,
          background: BOARD_BG,
          border: `8px solid ${RIM}`,
          borderRadius: 12,
          position: "relative"
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
          <Stack idx={27} board={board} onClick={() => handle(27, board[27])} grow="top" dest={dest.has(27)} />
          <Stack idx={26} board={board} onClick={() => handle(26, board[26])} grow="bottom" dest={dest.has(26)} />
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

        {/* center gap: cube + dice */}
        <div
          style={{
            gridColumn: "2 / -1",
            gridRow: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            pointerEvents: "none"
          }}
        >
          {dice.length > 0 && <Dice values={dice} rolling={rolling} />}
        </div>

        {botL.map((i, c) => (
          <div key={i} style={{ gridColumn: c + 2, gridRow: 4 }}>{P(i)}</div>
        ))}
        {botR.map((i, c) => (
          <div key={i} style={{ gridColumn: c + 9, gridRow: 4 }}>{P(i)}</div>
        ))}

        <div style={{ gridColumn: "1 / -1", gridRow: 5 }} />
      </div>

      {/* game result overlay --------------------------------------- */}
      {winner && gameResult && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100
        }}>
          <div style={{
            background: "linear-gradient(#3d2415, #2c1810)",
            border: "3px solid #865129",
            borderRadius: 16, padding: "32px 48px",
            textAlign: "center", maxWidth: 420
          }}>
            <div style={{
              fontSize: 28, fontWeight: 700,
              color: winner === "black" ? "#f88" : "#eee",
              fontFamily: "Georgia,serif",
              marginBottom: 8
            }}>
              {winner.toUpperCase()} wins!
            </div>
            <div style={{
              fontSize: 18, color: "#d4c8a0",
              fontFamily: "Georgia,serif",
              marginBottom: 4
            }}>
              {gameResult.type === "backgammon" ? "Backgammon!" :
               gameResult.type === "gammon" ? "Gammon!" : "Single game"}
            </div>
            <div style={{
              fontSize: 16, color: "#a98",
              marginBottom: 20
            }}>
              {gameResult.points} point{gameResult.points !== 1 ? "s" : ""}
              {cubeValue > 1 && ` (cube: ${cubeValue}x)`}
            </div>

            {/* updated match score */}
            <div style={{
              fontSize: 16, color: "#f8f1d2",
              fontFamily: "Georgia,serif",
              marginBottom: 20
            }}>
              Score: <span style={{ color: "#f88" }}>{matchScore.black}</span>
              {" — "}
              <span style={{ color: "#eee" }}>{matchScore.white}</span>
              {matchLength > 0 && ` / ${matchLength}`}
            </div>

            {matchWinner ? (
              <>
                <div style={{
                  fontSize: 22, fontWeight: 700,
                  color: "#ffd700",
                  marginBottom: 16
                }}>
                  {matchWinner.toUpperCase()} wins the match!
                </div>
                <button
                  onClick={() => online ? wsSend({ type: 'new_game' }) : dispatch({ type: "NEW_GAME" })}
                  style={{
                    padding: "12px 28px", fontSize: 16, fontWeight: 700,
                    background: "linear-gradient(#4a90e2,#357abd 50%,#2f6fab)",
                    color: "#fff", border: "none", borderRadius: 8, cursor: "pointer"
                  }}
                >
                  New Match
                </button>
              </>
            ) : (
              <button
                onClick={() => online ? wsSend({ type: 'new_game' }) : dispatch({ type: "NEXT_GAME" })}
                style={{
                  padding: "12px 28px", fontSize: 16, fontWeight: 700,
                  background: "linear-gradient(#66c06f,#4CAF50 60%,#3b8f3d)",
                  color: "#fff", border: "none", borderRadius: 8, cursor: "pointer"
                }}
              >
                Next Game
              </button>
            )}
          </div>
        </div>
      )}

      {/* CSS for pulse & thinking dots --------------------------- */}
      <style>{`
        @keyframes pulse{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}
        @keyframes thinking{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
        .thinking-dots::after{content:'';animation:thinking 1.4s steps(4,end) infinite}
      `}</style>
    </div>
    </div>
  );
}

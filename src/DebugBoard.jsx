// DebugBoard.jsx  —  one off‑strip (left) shared by both colours
import React from "react";

export default function DebugBoard() {
  /* geometry */
  const PT_W = 70, PT_H = 160, BAR_W = 70, OFF_W = 70, GAP_H = 60;

  /* helper cell */
  const Cell = ({ idx, bg, row }) => (
    <div
      style={{
        width: PT_W,
        height: PT_H,
        gridRow: row,
        background: bg,
        color: "#fff",
        fontSize: 22,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {idx}
    </div>
  );

  return (
    <div style={{ padding: 40, background: "#2c1810", minHeight: "100vh" }}>
      <h3 style={{ color: "#fff", marginBottom: 18 }}>
        <code>DebugBoard → OFF (strip) / 6 Pts / BAR / 6 Pts</code>
      </h3>

      <div style={{ display: "flex", gap: 12, border: "4px solid #fff", padding: 12 }}>
        {/* SINGLE OFF strip — upper = white, lower = black */}
        <div
          style={{
            width: OFF_W,
            background: "#8b8b8b",
            color: "#fff",
            fontWeight: 700,
            border: "4px solid #444",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 6
          }}
        >
          <div style={{ textAlign: "center" }}>OFF‑W</div>
          <div style={{ textAlign: "center" }}>OFF‑B</div>
        </div>

        {/* MAIN BOARD */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(6,${PT_W}px) ${BAR_W}px repeat(6,${PT_W}px)`,
            gridTemplateRows: `${PT_H}px ${GAP_H}px ${PT_H}px`,
            border: "2px dashed yellow"
          }}
        >
          {/* top‑left 24‑19 */}
          {[24,23,22,21,20,19].map((n,i)=>(
            <Cell key={n} idx={n} bg="#d9534f" row={1}/>
          ))}

          {/* BAR fixed in column 7 */}
          <div
            style={{
              gridColumn: 7,
              gridRow: "1 / span 3",
              width: BAR_W,
              background: "#337ab7",
              color: "#fff",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            BAR
          </div>

          {/* top‑right 18‑13 */}
          {[18,17,16,15,14,13].map(n=>(
            <Cell key={n} idx={n} bg="#d9534f" row={1}/>
          ))}

          {/* bottom‑left 12‑7 */}
          {[12,11,10,9,8,7].map(n=>(
            <Cell key={n} idx={n} bg="#5cb85c" row={3}/>
          ))}

          {/* bottom‑right 6‑1 */}
          {[6,5,4,3,2,1].map(n=>(
            <Cell key={n} idx={n} bg="#5cb85c" row={3}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// initialBoard.js  – WildBG coordinate system
//   • x  (black) moves 24 → 1  (positive integers)
//   • o  (white) moves 1  → 24 (negative integers)
//   • index 25 = x‑bar  |  o‑off
//   • index  0 = o‑bar  |  x‑off
//   • index 26 = black borne off
//   • index 27 = white borne off

const blank = () => ({ colour: null, n: 0 });

const createInitialBoard = () => {
  // 28 slots: 0‑27 (including borne off positions)
  const board = Array.from({ length: 28 }, blank);

  const place = (pt, colour, n) => { board[pt] = { colour, n }; };

  /* ---------- standard starting position ---------- */
  // Black (x) pieces
  place(24, "black", 2);  // Point 24 (black's 1)
  place(13, "black", 5);  // Point 13 (black's 12)
  place(8,  "black", 3);  // Point 8  (black's 17)
  place(6,  "black", 5);  // Point 6  (black's 19)

  // White (o) pieces
  place(1,  "white", 2);  // Point 1  (white's 24)
  place(12, "white", 5);  // Point 12 (white's 13)
  place(17, "white", 3);  // Point 17 (white's 8)
  place(19, "white", 5);  // Point 19 (white's 6)

  // Initialize bar and off positions as empty
  place(0,  "white", 0);  // White's bar
  place(25, "black", 0);  // Black's bar
  place(26, "black", 0);  // Black's off
  place(27, "white", 0);  // White's off

  return board;
};

export default createInitialBoard;

// Map logical point index 0‑23 to 3‑D world coords (centre of point, y=0)
export default function pointToXZ(idx) {
    const col = idx % 12;
    const row = idx < 12 ? 0 : 1; // top half vs bottom half
    const x = col - 5.5;   // spread points from left to right (-5.5 to +5.5)
    const z = row ? -4 : 4;  // bottom row is positive Z (closer to camera), top row is negative
    return [x, z];
  }
  
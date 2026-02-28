import React from "react";
import pointToXZ from "./coords";

/* alternating green shades */
const colours = ["#2b7a2b", "#195519"];

export default function PointMesh({ index }) {
  const [x, z] = pointToXZ(index);
  const row    = index < 12 ? 0 : 1;          // 0 = upper, 1 = lower
  const colour = colours[index % 2];

  /* rotate triangles so their tips aim toward the board centre */
  const rotation =
    row === 0
      ? [Math.PI / 2, 0, 0]                   // upper row → point “down”
      : [-Math.PI / 2, 0, 0];                 // lower row → point “up”

  return (
    <mesh position={[x, 0.52, z]} rotation={rotation}>
      {/* base radius, height, segments */}
      <coneGeometry args={[0.9, 4, 4]} />
      <meshStandardMaterial color={colour} />
    </mesh>
  );
}

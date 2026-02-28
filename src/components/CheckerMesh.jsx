import React from "react";
import pointToXZ from "./coords";
import { useGame } from "../logic/store";

export default function CheckerMesh({
  pointIdx,
  stack,  // 0-based index in the stack
  colour,
  selected,
  canMove,
  onClick
}) {
  const [{ player }] = useGame();

  /* ------------- positioning ------------- */
  const [baseX, baseZ] = pointToXZ(pointIdx);
  
  // Stack checkers vertically with proper spacing
  const stackHeight = 0.3;  // Increased height between checkers
  const y = 0.2 + (stack * stackHeight);  // Start above board and stack up

  // For bar points (24, 25) and bearing off (26, 27), adjust x position only
  let x = baseX;
  if (pointIdx >= 24) {
    if (pointIdx === 24 || pointIdx === 25) {
      x = 0;  // Center bar
    } else {
      x = 6.5;  // Bearing off area
    }
  }

  /* ------------- colouring ------------- */
  const baseColour = colour === "black" ? 0xc40000 /* red */ : 0xffffff /* white */;
  let highlight = baseColour;
  
  if (selected) {
    highlight = 0xfff38e; // bright yellow for selected
  } else if (canMove && colour === player) {
    highlight = 0xffeb99; // soft yellow for movable
  }

  return (
    <mesh position={[x, y, baseZ]} onClick={onClick}>
      <cylinderGeometry args={[0.45, 0.45, 0.25, 32]} />
      <meshStandardMaterial 
        color={highlight}
        roughness={0.3}
        metalness={0.2}
      />
    </mesh>
  );
}

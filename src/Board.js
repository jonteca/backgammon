import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Create a component for each checker
function Checker({ position, color, onClick }) {
  return (
    <mesh position={position} onClick={onClick}>
      <sphereGeometry args={[0.5]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Game board component
function Board() {
  // Initial positions for checkers (simplified example)
  const initialCheckers = [
    { position: [11, 1, 5], color: 'black', id: 1 },
    { position: [-1, 1, 5], color: 'white', id: 2 },
    { position: [13, 1, 5], color: 'black', id: 3 },
    { position: [-3, 1, 5], color: 'white', id: 4 },
    // Add other initial checkers...
  ];

  const [checkers, setCheckers] = useState(initialCheckers);
  const [dice, setDice] = useState([1, 1]);
  const [turn, setTurn] = useState('black'); // Start with black player's turn
  const [selectedChecker, setSelectedChecker] = useState(null);

  // Handle dice rolling
  const rollDice = () => {
    const newDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    setDice(newDice);
  };

  // Move a checker based on dice roll
  const moveChecker = (id, newPosition) => {
    const updatedCheckers = checkers.map((checker) =>
      checker.id === id ? { ...checker, position: newPosition } : checker
    );
    setCheckers(updatedCheckers);
  };

  // Handle checker click event
  const handleCheckerClick = (checker) => {
    if (selectedChecker) {
      const validMove = isValidMove(selectedChecker, checker);
      if (validMove) {
        moveChecker(selectedChecker.id, checker.position);
        setTurn(turn === 'black' ? 'white' : 'black');
        setSelectedChecker(null); // Deselect checker
      } else {
        alert('Invalid move');
      }
    } else {
      setSelectedChecker(checker);
    }
  };

  // Validate if the move is possible based on dice and the current turn
  const isValidMove = (selectedChecker, targetChecker) => {
    // Implement logic based on dice roll and board rules
    return true; // Placeholder: Add real validation logic here
  };

  // Create a dice display
  const Dice = () => (
    <div>
      <button onClick={rollDice}>Roll Dice</button>
      <p>Dice: {dice[0]} and {dice[1]}</p>
    </div>
  );

  return (
    <div>
      <Dice />
      <p>Current Turn: {turn}</p>

      <Canvas camera={{ position: [0, 10, 30], fov: 75 }}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[24, 1, 12]} />
          <meshStandardMaterial color="burlywood" />
        </mesh>

        {/* Bar */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[2, 1, 12]} />
          <meshStandardMaterial color="saddlebrown" />
        </mesh>

        {/* Checkers */}
        {checkers.map((checker) => (
          <Checker
            key={checker.id}
            position={checker.position}
            color={checker.color}
            onClick={() => handleCheckerClick(checker)}
          />
        ))}

        <ambientLight intensity={0.5} />
        <spotLight position={[10, 15, 10]} angle={0.3} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default Board;

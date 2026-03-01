import React, { useState, useEffect } from 'react';

const Die = ({ value, rolling }) => {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 150); // Even slower changes

      setTimeout(() => {
        clearInterval(interval);
        setDisplayValue(value);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
    }
  }, [rolling, value]);

  // Mapping of dice value to dot positions
  const dotPositions = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  return (
    <div 
      className={`die ${rolling ? 'rolling' : ''}`}
      style={{
        width: 45,
        height: 45,
        background: 'white',
        borderRadius: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        padding: 8,
        boxShadow: rolling ? '0 0 20px rgba(255,215,0,0.8)' : '0 3px 6px rgba(0,0,0,0.4)',
        transition: 'all 0.3s ease',
        transform: `scale(${rolling ? 1.05 : 1})`,
        position: 'relative',
        zIndex: rolling ? 1 : 0
      }}
    >
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {dotPositions[displayValue]?.includes(i) && (
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#333',
                opacity: rolling ? 0.5 : 1,
                transition: 'all 0.15s ease'
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default function Dice({ values, rolling }) {
  return (
    <div style={{
      display: 'flex',
      gap: 16,
      padding: '12px 20px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 16,
      transform: 'translateZ(0)', // Force GPU acceleration
    }}>
      {values.map((value, i) => (
        <Die key={i} value={value} rolling={rolling} />
      ))}
      <style>{`
        @keyframes roll {
          0% { transform: rotate(0deg) scale(1.05); }
          30% { transform: rotate(360deg) scale(1.05); }
          60% { transform: rotate(720deg) scale(1.05); }
          90% { transform: rotate(1080deg) scale(1.05); }
          100% { transform: rotate(1080deg) scale(1.05); }
        }
        .die.rolling {
          animation: roll 1s cubic-bezier(0.45, 0.05, 0.55, 0.95);
        }
      `}</style>
    </div>
  );
} 
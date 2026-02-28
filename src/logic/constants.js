// WildBG coordinate system:
// - Board positions: 24->1 (high to low)
// - Player x (black) moves from 24->1, positive checkers
// - Player o (white) moves from 1->24, negative checkers
// - x's home board is 6-1
// - o's home board is 19-24
// - x's bar is 25, o's bar is 0
// - Bearing off x goes to 0, bearing off o goes to 25

export const PLAYERS = ["black", "white"];  // black = x (positive), white = o (negative)

// Home boards in WildBG coordinates
export const HOME = {
  black: [6, 1],    // x's home board
  white: [19, 24]   // o's home board
};

// Direction is now based on WildBG's coordinate system
export const DIRECTION = {
  black: -1,  // x moves down (24->1)
  white: 1    // o moves up (1->24)
};

// Bar positions
export const BAR = {
  black: 25,  // x's bar
  white: 0    // o's bar
};

// Bearing off positions
export const BEAR_OFF = {
  black: 0,   // x bears off to 0
  white: 25   // o bears off to 25
};

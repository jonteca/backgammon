/* ------------------------------------------------------------------ */
/*  multiplayerSend.js — shared ref for WS send function               */
/* ------------------------------------------------------------------ */

// Global send function, set by useMultiplayer hook
let _send = null;

export function setSendFn(fn) {
  _send = fn;
}

export function wsSend(action) {
  if (_send) _send(action);
}

/* ------------------------------------------------------------------ */
/*  useMultiplayer.js — WebSocket connection to multiplayer server      */
/* ------------------------------------------------------------------ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { setSendFn } from './multiplayerSend';

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 16000;

export default function useMultiplayer(instanceId, userId, username) {
  const [connected, setConnected] = useState(false);
  const [myColour, setMyColour] = useState(null);
  const [serverState, setServerState] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [aiOpponent, setAiOpponent] = useState(null);
  const wsRef = useRef(null);
  const reconnectDelay = useRef(RECONNECT_BASE);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!instanceId || !userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelay.current = RECONNECT_BASE;
      // Send join message
      ws.send(JSON.stringify({
        type: 'join',
        instanceId,
        userId,
        username,
      }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case 'joined':
          setMyColour(msg.colour);
          break;
        case 'state':
          setServerState(msg);
          setPlayerCount(msg.playerCount || 0);
          break;
        case 'ai_opponent':
          setAiOpponent(msg.colour);
          break;
        case 'error':
          console.warn('[WS] server error:', msg.error);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (!mountedRef.current) return;
      // Exponential backoff reconnect
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX);
      setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [instanceId, userId, username]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((action) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...action, userId }));
    }
  }, [userId]);

  // Keep global send ref in sync
  useEffect(() => {
    setSendFn(send);
    return () => setSendFn(null);
  }, [send]);

  return { connected, myColour, serverState, playerCount, aiOpponent, send };
}

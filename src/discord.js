/* ------------------------------------------------------------------ */
/*  discord.js — Discord Embedded App SDK init + OAuth2 helpers        */
/* ------------------------------------------------------------------ */

import { DiscordSDK } from '@discord/embedded-app-sdk';

let discordSdk = null;
let auth = null;

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

/**
 * True when running inside a Discord Activity iframe.
 */
export function isDiscordEmbedded() {
  // The Discord client injects a nested iframe with /.proxy/ in the URL
  // and sets the __DISCORD__ property on the global scope via the SDK
  if (typeof window === 'undefined') return false;
  const searchParams = new URLSearchParams(window.location.search);
  return (
    searchParams.has('frame_id') ||
    searchParams.has('instance_id') ||
    window.location.href.includes('discordsays.com')
  );
}

/**
 * Initialise the Discord SDK and complete the OAuth2 handshake.
 * Call once at app boot. Resolves when the Activity is fully ready.
 */
export async function initDiscord() {
  if (!CLIENT_ID) {
    throw new Error('VITE_DISCORD_CLIENT_ID not set');
  }

  discordSdk = new DiscordSDK(CLIENT_ID);
  await discordSdk.ready();

  // Authorise — opens the OAuth2 consent dialog inside Discord
  const { code } = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds'],
  });

  // Exchange the code for an access token via our backend
  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }
  const { access_token } = await res.json();

  // Authenticate — tells Discord the user is ready
  auth = await discordSdk.commands.authenticate({ access_token });

  return auth;
}

/**
 * Returns the authenticated user info (after initDiscord resolves).
 */
export function getAuth() {
  return auth;
}

/**
 * Returns the Discord Activity instance ID (unique per launch).
 * Used as the room key for multiplayer.
 */
export function getInstanceId() {
  return discordSdk?.instanceId ?? null;
}

/**
 * Returns the underlying DiscordSDK instance.
 */
export function getDiscordSdk() {
  return discordSdk;
}

/**
 * Subscribe to participant updates in the Activity instance.
 * Calls `onChange` with the current list of participants whenever it changes.
 */
export function onParticipantsUpdate(onChange) {
  if (!discordSdk) return () => {};
  const unsub = discordSdk.subscribe(
    'ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE',
    (data) => {
      onChange(data.participants || []);
    }
  );
  return unsub;
}

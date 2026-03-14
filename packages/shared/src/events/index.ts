// ─── Lobby Events ───
export const LOBBY_EVENTS = {
  CREATE: 'lobby:create',
  JOIN: 'lobby:join',
  LEAVE: 'lobby:leave',
  PLAYER_READY: 'lobby:player_ready',
  STATE: 'lobby:state',
  ERROR: 'lobby:error',
  PLAYER_JOINED: 'lobby:player_joined',
  PLAYER_LEFT: 'lobby:player_left',
  HOST_CHANGED: 'lobby:host_changed',
  START_GAME: 'lobby:start_game',
  GAME_STARTING: 'lobby:game_starting',
  BACK_TO_LOBBY: 'lobby:back_to_lobby',
  CHAT_MESSAGE: 'lobby:chat_message',
} as const;

// ─── Game Events ───
export const GAME_EVENTS = {
  STATE: 'game:state',
  MOVE: 'game:move',
  RESULT: 'game:result',
  ERROR: 'game:error',
} as const;

// ─── Bingo-Specific Events ───
export const BINGO_EVENTS = {
  /** Setup phase: player places a number on their board */
  PLACE_NUMBER: 'bingo:place_number',
  /** Play phase: player chooses a number on their turn */
  CHOOSE_NUMBER: 'bingo:choose_number',
} as const;

// ─── Voice Chat Events (WebRTC Signaling) ───
export const VOICE_EVENTS = {
  JOIN: 'voice:join',
  LEAVE: 'voice:leave',
  OFFER: 'voice:offer',
  ANSWER: 'voice:answer',
  ICE_CANDIDATE: 'voice:ice_candidate',
  PEER_JOINED: 'voice:peer_joined',
  PEER_LEFT: 'voice:peer_left',
  TOGGLE_MUTE: 'voice:toggle_mute',
  MUTE_STATUS: 'voice:mute_status',
} as const;

// ─── Auth Events ───
export const AUTH_EVENTS = {
  AUTHENTICATE: 'auth:authenticate',
  AUTHENTICATED: 'auth:authenticated',
  ERROR: 'auth:error',
} as const;

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
  REQUEST_STATE: 'game:request_state',
  SURRENDER: 'game:surrender',
} as const;

// ─── Bingo-Specific Events ───
export const BINGO_EVENTS = {
  PLACE_NUMBER: 'bingo:place_number',
  CHOOSE_NUMBER: 'bingo:choose_number',
  RANDOMIZE_BOARD: 'bingo:randomize_board',
} as const;

// ─── Ludo-Specific Events ───
export const LUDO_EVENTS = {
  ROLL_DICE: 'ludo:roll_dice',
  MOVE_TOKEN: 'ludo:move_token',
  ADD_BOT: 'ludo:add_bot',
  REMOVE_BOT: 'ludo:remove_bot',
} as const;

// ─── Chess-Specific Events ───
// Client → Server: move, resign, draw_offer, draw_response, rejoin, spectate.
// Server → Room / Sender: state, move_applied, move_rejected, clock_tick,
//   draw_offer (broadcast), draw_declined, game_over.
export const CHESS_EVENTS = {
  // client → server
  MOVE: 'chess:move',
  RESIGN: 'chess:resign',
  DRAW_OFFER: 'chess:draw_offer',
  DRAW_RESPONSE: 'chess:draw_response',
  REJOIN: 'chess:rejoin',
  SPECTATE: 'chess:spectate',
  // server → client/room
  STATE: 'chess:state',
  MOVE_APPLIED: 'chess:move_applied',
  MOVE_REJECTED: 'chess:move_rejected',
  CLOCK_TICK: 'chess:clock_tick',
  DRAW_DECLINED: 'chess:draw_declined',
  GAME_OVER: 'chess:game_over',
} as const;

// ─── UNO-Specific Events ───
// Client → Server: play (card, chosen colour), draw, pass, take (accept pending
//   draw), challenge (a Wild Draw Four), call_uno, catch (an opponent), rejoin,
//   spectate.
// Server → Room: state (per-player redacted view), event (transient cues),
//   round_over, game_over.
export const UNO_EVENTS = {
  // client → server
  PLAY: 'uno:play',
  DRAW: 'uno:draw',
  PASS: 'uno:pass',
  TAKE: 'uno:take',
  CHALLENGE: 'uno:challenge',
  CALL_UNO: 'uno:call_uno',
  CATCH: 'uno:catch',
  SURRENDER: 'uno:surrender',
  CHOOSE_SEVEN: 'uno:choose_seven',
  JUMP_IN: 'uno:jump_in',
  REJOIN: 'uno:rejoin',
  SPECTATE: 'uno:spectate',
  // server → client/room
  STATE: 'uno:state',
  EVENT: 'uno:event',
  ROUND_OVER: 'uno:round_over',
  GAME_OVER: 'uno:game_over',
  ERROR: 'uno:error',
} as const;

// ─── Photobooth-Specific Events ───
// Client → Server: configure (host picks layout+theme), start_capture (host),
//   capture (send a half-photo), confirm ("continue"), retake, set_filter.
// Server → Room: state (per-player view), complete (strip finished → reveal).
export const PHOTOBOOTH_EVENTS = {
  // client → server
  CONFIGURE: 'photobooth:configure',
  START_CAPTURE: 'photobooth:start_capture',
  CAPTURE: 'photobooth:capture',
  CONFIRM: 'photobooth:confirm',
  RETAKE: 'photobooth:retake',
  SET_FILTER: 'photobooth:set_filter',
  // server → client/room
  STATE: 'photobooth:state',
  COMPLETE: 'photobooth:complete',
} as const;

export const TICTACTOE_EVENTS = {
  MOVE: 'tictactoe:move',
  STATE: 'tictactoe:state',
  RESULT: 'tictactoe:result',
  ERROR: 'tictactoe:error',
} as const;

export const CONNECTFOUR_EVENTS = {
  DROP: 'connectfour:drop',
  STATE: 'connectfour:state',
  RESULT: 'connectfour:result',
  ERROR: 'connectfour:error',
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

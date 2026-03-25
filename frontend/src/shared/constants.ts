export const GAME_CONSTANTS = {
  LOBBY_CODE_LENGTH: 6,
  DEFAULT_MAX_PLAYERS: 8,
  MIN_PLAYERS: 2,
  LOBBY_TTL_SECONDS: 900,
} as const;

export const BINGO_CONSTANTS = {
  BOARD_SIZE: 5,
  TOTAL_NUMBERS: 25,
  LINES_TO_WIN: 5,
} as const;

export const LUDO_CONSTANTS = {
  BOARD_SIZE: 52,
  HOME_COLUMN_SIZE: 6,
  TOKENS_PER_PLAYER: 4,
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  SAFE_SQUARES: [0, 8, 13, 21, 26, 34, 39, 47] as readonly number[],
  CONSECUTIVE_SIXES_LIMIT: 3,
} as const;

export const AVATARS = [
  '🦊', '🐱', '🐶', '🐸', '🦁', '🐼', '🐨', '🐯',
  '🦄', '🐙', '🦋', '🐢', '🦀', '🐳', '🦜', '🐵',
] as const;

export const GAME_CONSTANTS = {
  LOBBY_CODE_LENGTH: 6,
  DEFAULT_MAX_PLAYERS: 8,
  MIN_PLAYERS: 2,
  LOBBY_TTL_SECONDS: 900, // 15 minutes inactivity
} as const;

export const BINGO_CONSTANTS = {
  BOARD_SIZE: 5,
  TOTAL_NUMBERS: 25,
  LINES_TO_WIN: 5, // B-I-N-G-O
} as const;

export const AVATARS = [
  '🦊', '🐱', '🐶', '🐸', '🦁', '🐼', '🐨', '🐯',
  '🦄', '🐙', '🦋', '🐢', '🦀', '🐳', '🦜', '🐵',
] as const;

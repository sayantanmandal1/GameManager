export const GAME_CONSTANTS = {
  LOBBY_CODE_LENGTH: 6,
  DEFAULT_MAX_PLAYERS: 8,
  MIN_PLAYERS: 2,
  LOBBY_TTL_SECONDS: 1800, // 30 minutes
} as const;

export const BINGO_CONSTANTS = {
  BOARD_SIZE: 5,
  TOTAL_NUMBERS: 75,
  DEFAULT_DRAW_INTERVAL_MS: 5000,
  FREE_CELL_ROW: 2,
  FREE_CELL_COL: 2,
} as const;

export const AVATARS = [
  '🦊', '🐱', '🐶', '🐸', '🦁', '🐼', '🐨', '🐯',
  '🦄', '🐙', '🦋', '🐢', '🦀', '🐳', '🦜', '🐵',
] as const;

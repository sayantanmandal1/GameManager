import { DISTINCT_GAME_KEYS } from '@/shared';
import { DISTINCT_GAME_UI } from '@/lib/distinctGames';

/** Total playable titles: the eight original games plus every distinct game. */
export const GAME_COUNT = 8 + DISTINCT_GAME_KEYS.length;

export interface ShowcaseGame {
  readonly key: string;
  readonly name: string;
  readonly mark: string;
  readonly accent: string;
  readonly surface: string;
  readonly players: string;
}

/** Mirrors the live catalog entries shown in the Android app's library. */
export const FEATURED_APP_GAMES: readonly ShowcaseGame[] = [
  { key: 'monopoly', name: 'Monopoly', mark: 'M', accent: '#f0b55d', surface: '#2f2419', players: '2–4 players' },
  { key: 'contract-bridge', name: 'Contract Bridge', mark: '♠', accent: '#e5c66d', surface: '#17352c', players: '4 players' },
  { key: 'uno', name: 'UNO', mark: '7', accent: '#f2c94c', surface: '#382d16', players: '2–10 players' },
  { key: 'chess', name: 'Chess', mark: '♞', accent: '#65aaf6', surface: '#182938', players: '2 players' },
  { key: 'ludo', name: 'Ludo', mark: '●', accent: '#63d5a4', surface: '#173126', players: '2–4 players' },
  { key: 'wrongway', name: 'Wrongway', mark: 'WW', accent: '#5da8ff', surface: '#0d1b36', players: '2 players' },
];

const ORIGINAL_GAMES = [
  { name: 'Bingo', accent: '#ff684d' },
  { name: 'Chess', accent: '#65aaf6' },
  { name: 'Ludo', accent: '#63d5a4' },
  { name: 'Photobooth', accent: '#ff8db3' },
  { name: 'UNO', accent: '#f2c94c' },
  { name: 'Tic Tac Toe', accent: '#d7a7ff' },
  { name: 'Connect Four', accent: '#ffcf4a' },
  { name: 'Sudoku', accent: '#8dd8c1' },
] as const;

export const ALL_GAME_CHIPS: readonly { name: string; accent: string }[] = [
  ...ORIGINAL_GAMES,
  ...DISTINCT_GAME_KEYS.map((key) => ({ name: DISTINCT_GAME_UI[key].name, accent: DISTINCT_GAME_UI[key].accent })),
];

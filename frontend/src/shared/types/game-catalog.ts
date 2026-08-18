import type { GameType } from './lobby';

export type GameCategory = 'board' | 'cards' | 'party' | 'strategy' | 'race' | 'puzzle';
export type GameFamily =
  | 'bingo'
  | 'chess'
  | 'ludo'
  | 'photobooth'
  | 'uno'
  | 'tictactoe'
  | 'connectfour'
  | 'sudoku'
  | 'alignment'
  | 'takeaway'
  | 'race'
  | 'memory';

export interface GameCatalogEntry {
  key: string;
  name: string;
  gameType: GameType;
  family: GameFamily;
  category: GameCategory;
  description: string;
  mark: string;
  route: string;
  minPlayers: number;
  maxPlayers: number;
  accent: string;
  surface: string;
  rules: Record<string, unknown>;
}

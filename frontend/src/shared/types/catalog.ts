import type { DistinctGameKey } from './distinct-game';
import type { GameType } from './lobby';

export interface GameCatalogMode {
  key: 'online' | 'offline' | 'bot' | 'solo';
  route: string;
}

export interface GameCatalogEntry {
  key: string;
  name: string;
  mark: string;
  description: string;
  route: string;
  accent: string;
  surface: string;
  gameType: GameType;
  gameKey: DistinctGameKey | null;
  minPlayers: number;
  maxPlayers: number;
  modes: GameCatalogMode[];
}

export interface GameCatalogResponse {
  games: GameCatalogEntry[];
  total: number;
}
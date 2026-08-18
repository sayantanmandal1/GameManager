export interface GuestUser {
  id: string;
  username: string;
  avatar: string;
}

export interface GuestSession {
  user: GuestUser;
  token: string;
}

export interface WebDestination {
  title: string;
  route: string;
}

export type GameCategory = 'board' | 'cards' | 'party' | 'strategy' | 'race' | 'puzzle';

export interface GameDefinition {
  key: string;
  name: string;
  gameType: string;
  family: string;
  category: GameCategory;
  mark: string;
  description: string;
  route: string;
  minPlayers: number;
  maxPlayers: number;
  accent: string;
  surface: string;
}
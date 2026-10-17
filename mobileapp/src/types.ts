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

export type GameModeKey = 'online' | 'offline' | 'bot' | 'solo';

export interface GameDefinition extends WebDestination {
  id: string;
  mark: string;
  description: string;
  accent: string;
  surface: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  modes: GameModeKey[];
}
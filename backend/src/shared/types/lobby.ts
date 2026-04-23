export enum LobbyStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

export enum GameType {
  BINGO = 'bingo',
  LUDO = 'ludo',
  CHESS = 'chess',
}

export interface LobbyPlayer {
  id: string;
  username: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}

export interface Lobby {
  id: string;
  code: string;
  hostId: string;
  gameType: GameType;
  players: LobbyPlayer[];
  status: LobbyStatus;
  maxPlayers: number;
  createdAt: Date;
  /** Only populated for chess lobbies. null ⇒ untimed. */
  timeControl?: import('./chess').TimeControl | null;
}

export interface CreateLobbyPayload {
  gameType: GameType;
  maxPlayers?: number;
  /** Only honored when gameType === 'chess'. null or undefined ⇒ untimed. */
  timeControl?: import('./chess').TimeControl | null;
}

export interface JoinLobbyPayload {
  code: string;
}

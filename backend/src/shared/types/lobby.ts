export enum LobbyStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

export enum GameType {
  BINGO = 'bingo',
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
}

export interface CreateLobbyPayload {
  gameType: GameType;
  maxPlayers?: number;
}

export interface JoinLobbyPayload {
  code: string;
}

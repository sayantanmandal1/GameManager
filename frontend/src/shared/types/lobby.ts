export enum LobbyStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

export enum GameType {
  BINGO = 'bingo',
  LUDO = 'ludo',
  CHESS = 'chess',
  PHOTOBOOTH = 'photobooth',
  UNO = 'uno',
  TICTACTOE = 'tictactoe',
  CONNECTFOUR = 'connectfour',
  SUDOKU = 'sudoku',
  DISTINCT = 'distinct',
}

export type LobbyTeam = 0 | 1;

export interface LobbyPlayer {
  id: string;
  username: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  team?: LobbyTeam | null;
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
  /** Only populated for UNO lobbies. */
  unoRules?: import('./uno').UnoRules | null;
  /** Only populated for Tic Tac Toe lobbies. */
  tictactoeMode?: import('./tictactoe').TicTacToeMode | null;
  /** Registry-owned key for GameType.DISTINCT lobbies. */
  gameKey?: import('./distinct-game').DistinctGameKey | null;
}

export interface CreateLobbyPayload {
  gameType: GameType;
  maxPlayers?: number;
  /** Only honored when gameType === 'chess'. null or undefined ⇒ untimed. */
  timeControl?: import('./chess').TimeControl | null;
  /** Only honored when gameType === 'uno'. */
  unoRules?: import('./uno').UnoRules | null;
  /** Only honored when gameType === 'tictactoe'. */
  tictactoeMode?: import('./tictactoe').TicTacToeMode | null;
  /** Required and allow-listed when gameType === 'distinct'. */
  gameKey?: import('./distinct-game').DistinctGameKey | null;
}

export interface JoinLobbyPayload {
  code: string;
}

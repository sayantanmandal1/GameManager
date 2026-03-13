export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

/**
 * Core Game Engine Interface — the extensibility contract.
 * Every game (Bingo, Chess, Ludo, etc.) implements this interface.
 * The platform orchestrates games generically through this contract.
 */
export interface IGameEngine<
  TState = unknown,
  TMove = unknown,
  TPlayerView = unknown,
  TWinResult = unknown,
> {
  /** Initialize a new game for the given player IDs */
  initGame(playerIds: string[]): TState;

  /** Apply a validated move to the game state */
  processMove(state: TState, playerId: string, move: TMove): TState;

  /** Check if a move is valid (without applying it) */
  validateMove(state: TState, playerId: string, move: TMove): { valid: boolean; reason?: string };

  /** Check if there is a winner. Returns null if game is still in progress. */
  checkWinner(state: TState): TWinResult | null;

  /** Get a player-specific view of the state (hides other players' private data) */
  getPlayerView(state: TState, playerId: string): TPlayerView;
}

export interface GameRecord {
  id: string;
  lobbyId: string;
  gameType: string;
  playerIds: string[];
  winnerId: string | null;
  status: GameStatus;
  createdAt: Date;
  finishedAt: Date | null;
}

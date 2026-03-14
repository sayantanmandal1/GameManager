export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
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

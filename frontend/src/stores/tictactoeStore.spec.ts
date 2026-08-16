import { useTicTacToeStore } from './tictactoeStore';
import { TicTacToeMode, TicTacToePhase, type TicTacToePlayerView } from '@/shared';

const view = (): TicTacToePlayerView => ({
  players: [
    { id: 'a', name: 'Alice', mark: 'X', isBot: false },
    { id: 'b', name: 'Bob', mark: 'O', isBot: false },
  ],
  board: Array.from({ length: 9 }, () => null),
  currentTurnId: 'a',
  mode: TicTacToeMode.CLASSIC,
  phase: TicTacToePhase.PLAYING,
  winnerId: null,
  winningLine: null,
  isDraw: false,
  youId: 'a',
  yourMark: 'X',
  canAct: true,
  mustMovePiece: false,
});

describe('tictactoeStore state isolation', () => {
  beforeEach(() => useTicTacToeStore.getState().reset());

  it('accepts only state for the active lobby', () => {
    useTicTacToeStore.getState().setLobbyCode('123456');
    useTicTacToeStore.getState().applyState({
      gameId: 'wrong',
      lobbyCode: '654321',
      view: view(),
    });
    expect(useTicTacToeStore.getState().view).toBeNull();

    useTicTacToeStore.getState().applyState({
      gameId: 'right',
      lobbyCode: '123456',
      view: view(),
    });
    expect(useTicTacToeStore.getState().gameId).toBe('right');
  });

  it('clears the prior board when changing lobby codes', () => {
    useTicTacToeStore.getState().setLobbyCode('123456');
    useTicTacToeStore.getState().applyState({
      gameId: 'game-1',
      lobbyCode: '123456',
      view: view(),
    });
    useTicTacToeStore.getState().setLobbyCode('654321');
    expect(useTicTacToeStore.getState()).toMatchObject({
      gameId: null,
      lobbyCode: '654321',
      view: null,
      result: null,
    });
  });
});
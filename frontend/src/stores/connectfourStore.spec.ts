import { ConnectFourPhase, type ConnectFourPlayerView } from '@/shared';
import { useConnectFourStore } from './connectfourStore';

const view = (): ConnectFourPlayerView => ({
  players: [
    { id: 'a', name: 'Alice', disc: 'red', isBot: false },
    { id: 'b', name: 'Bob', disc: 'yellow', isBot: false },
  ],
  board: Array.from({ length: 42 }, () => null),
  currentTurnId: 'a',
  phase: ConnectFourPhase.PLAYING,
  winnerId: null,
  winningCells: null,
  isDraw: false,
  lastMove: null,
  youId: 'a',
  yourDisc: 'red',
  canAct: true,
  validColumns: [0, 1, 2, 3, 4, 5, 6],
});

describe('connectfourStore state isolation', () => {
  beforeEach(() => useConnectFourStore.getState().reset());

  it('ignores state from another lobby', () => {
    useConnectFourStore.getState().setLobbyCode('123456');
    useConnectFourStore.getState().applyState({
      gameId: 'wrong',
      lobbyCode: '654321',
      view: view(),
    });
    expect(useConnectFourStore.getState().view).toBeNull();
  });

  it('clears the old board when the active lobby changes', () => {
    useConnectFourStore.getState().setLobbyCode('123456');
    useConnectFourStore.getState().applyState({
      gameId: 'game-1',
      lobbyCode: '123456',
      view: view(),
    });
    useConnectFourStore.getState().setLobbyCode('654321');
    expect(useConnectFourStore.getState()).toMatchObject({
      gameId: null,
      lobbyCode: '654321',
      view: null,
    });
  });
});
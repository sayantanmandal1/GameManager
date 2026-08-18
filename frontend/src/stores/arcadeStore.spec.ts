const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('@/lib/socket', () => ({
  getSocket: jest.fn(() => mockSocket),
  waitForSocket: jest.fn(() => Promise.resolve(mockSocket)),
}));

import { ARCADE_EVENTS, GAME_EVENTS, ArcadePhase } from '@/shared';
import { useArcadeStore } from './arcadeStore';

const view = {
  gameKey: 'take-15',
  family: 'takeaway' as const,
  phase: ArcadePhase.PLAYING,
  players: [
    { id: 'p1', name: 'Alice', score: 0 },
    { id: 'p2', name: 'Bob', score: 0 },
  ],
  currentTurn: 'p1',
  canAct: true,
  winnerId: null,
  isDraw: false,
  alignment: null,
  takeaway: { heaps: [15], maxTake: 3, misere: false },
  race: null,
  memory: null,
};

describe('ArcadeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useArcadeStore.getState().reset();
  });

  it('emits authoritative actions with game and lobby identity', () => {
    useArcadeStore.setState({ gameId: 'g1', lobbyCode: '123456' });
    const action = { type: 'take' as const, heap: 0, count: 2 };
    useArcadeStore.getState().action(action);
    expect(mockSocket.emit).toHaveBeenCalledWith(ARCADE_EVENTS.ACTION, {
      gameId: 'g1',
      lobbyCode: '123456',
      action,
    });
  });

  it('registers state, result, error, and reconnect listeners', async () => {
    useArcadeStore.setState({ lobbyCode: '123456' });
    const cleanup = useArcadeStore.getState().initListeners();
    expect(mockSocket.on).toHaveBeenCalledWith(ARCADE_EVENTS.STATE, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(ARCADE_EVENTS.RESULT, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(ARCADE_EVENTS.ERROR, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    await Promise.resolve();
    expect(mockSocket.emit).toHaveBeenCalledWith(GAME_EVENTS.REQUEST_STATE, { lobbyCode: '123456' });
    cleanup();
    expect(mockSocket.off).toHaveBeenCalledWith(ARCADE_EVENTS.STATE, expect.any(Function));
  });

  it('accepts only state for the active lobby and clears an old result', () => {
    useArcadeStore.setState({ lobbyCode: '123456', result: { winnerId: 'p1', isDraw: false, scores: {} } });
    useArcadeStore.getState().initListeners();
    const onState = mockSocket.on.mock.calls.find((call) => call[0] === ARCADE_EVENTS.STATE)![1];
    onState({ gameId: 'wrong', lobbyCode: '654321', view });
    expect(useArcadeStore.getState().view).toBeNull();
    onState({ gameId: 'g1', lobbyCode: '123456', view });
    expect(useArcadeStore.getState()).toMatchObject({ gameId: 'g1', view, result: null });
  });

  it('emits surrender through the shared game event', () => {
    useArcadeStore.setState({ gameId: 'g1', lobbyCode: '123456' });
    useArcadeStore.getState().surrender();
    expect(mockSocket.emit).toHaveBeenCalledWith(GAME_EVENTS.SURRENDER, {
      gameId: 'g1',
      lobbyCode: '123456',
    });
  });
});

import { useUnoStore } from './unoStore';
import { useAuthStore } from './authStore';
import type { UnoPlayerView } from '@/shared';

const viewFor = (lobbyCode: string, gameId: string) =>
  ({ lobbyCode, gameId, yourHand: [] }) as unknown as UnoPlayerView;

describe('unoStore state isolation', () => {
  beforeEach(() => {
    useUnoStore.getState().reset();
    useAuthStore.setState({
      user: { id: 'user-1', username: 'Alice', avatar: 'A' },
      token: 'token',
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it('clears private game state when the route changes to another lobby', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('111111');
    store.applyState({ gameId: 'game-1', view: viewFor('111111', 'game-1') });

    useUnoStore.getState().setLobbyCode('222222');

    expect(useUnoStore.getState()).toMatchObject({
      lobbyCode: '222222',
      gameId: null,
      view: null,
      roundResult: null,
      matchResult: null,
    });
  });

  it('ignores a late state payload from a different lobby', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('222222');
    store.applyState({ gameId: 'game-1', view: viewFor('111111', 'game-1') });

    expect(useUnoStore.getState().view).toBeNull();
    expect(useUnoStore.getState().gameId).toBeNull();
  });

  it('ignores a payload whose envelope and view identify different games', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('222222');
    store.applyState({ gameId: 'game-2', view: viewFor('222222', 'game-1') });

    expect(useUnoStore.getState().view).toBeNull();
  });

  it('rejects a private player view issued for another authenticated user', () => {
    const store = useUnoStore.getState();
    store.setLobbyCode('222222');
    const view = {
      ...viewFor('222222', 'game-1'),
      role: 'player' as const,
      youId: 'user-2',
    };

    store.applyState({ gameId: 'game-1', view });

    expect(useUnoStore.getState().view).toBeNull();
  });
});
import { DistinctGameLifecycle } from './distinct-game.lifecycle';
import type { GameRegistry } from './game-registry';

describe('DistinctGameLifecycle', () => {
  it('returns null for an unknown player without invoking adapter projection', () => {
    const getPlayerView = jest.fn();
    const adapter = {
      key: 'reversi',
      rulesetId: 'test.reversi.v1',
      minPlayers: 2,
      maxPlayers: 2,
      initGame: jest.fn().mockReturnValue({ phase: 'playing' }),
      applyAction: jest.fn(),
      getPlayerView,
      surrender: jest.fn(),
    };
    const getDistinctGame = jest.fn().mockReturnValue(adapter);
    const registry = { getDistinctGame } as unknown as GameRegistry;
    const lifecycle = new DistinctGameLifecycle(registry);

    lifecycle.start('game-1', 'reversi', ['player-1', 'player-2'], {
      'player-1': 'One',
      'player-2': 'Two',
    });
    getDistinctGame.mockClear();

    expect(lifecycle.getPlayerView('game-1', 'unknown-player')).toBeNull();
    expect(getDistinctGame).not.toHaveBeenCalled();
    expect(getPlayerView).not.toHaveBeenCalled();
  });
});
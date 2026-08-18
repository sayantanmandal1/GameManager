import { GameType } from './types/lobby';
import { GAME_CATALOG, getGameDefinition } from './game-catalog';

describe('GAME_CATALOG', () => {
  it('contains exactly 100 multiplayer titles plus the existing solo Sudoku', () => {
    expect(GAME_CATALOG).toHaveLength(101);
    expect(GAME_CATALOG.filter((game) => game.minPlayers >= 2)).toHaveLength(100);
    expect(GAME_CATALOG.filter((game) => game.minPlayers === 1).map((game) => game.key)).toEqual(['sudoku']);
  });

  it('uses unique stable keys and routes', () => {
    expect(new Set(GAME_CATALOG.map((game) => game.key)).size).toBe(101);
    expect(new Set(GAME_CATALOG.map((game) => game.route)).size).toBe(101);
  });

  it('keeps player limits and presentation metadata valid', () => {
    for (const game of GAME_CATALOG) {
      expect(game.key).toMatch(/^[a-z0-9-]{2,64}$/);
      expect(game.name.length).toBeGreaterThan(1);
      expect(game.description.length).toBeGreaterThan(10);
      expect(game.minPlayers).toBeGreaterThanOrEqual(1);
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
      expect(game.maxPlayers).toBeLessThanOrEqual(8);
      expect(game.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(game.surface).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Object.values(GameType)).toContain(game.gameType);
      expect(getGameDefinition(game.key)).toBe(game);
    }
  });

  it('covers multiple multiplayer domains and all arcade families', () => {
    expect(new Set(GAME_CATALOG.map((game) => game.category)).size).toBeGreaterThanOrEqual(6);
    const arcadeFamilies = new Set(
      GAME_CATALOG
        .filter((game) => game.gameType === GameType.ARCADE)
        .map((game) => game.family),
    );
    expect(arcadeFamilies).toEqual(
      new Set(['alignment', 'takeaway', 'race', 'memory']),
    );
  });
});
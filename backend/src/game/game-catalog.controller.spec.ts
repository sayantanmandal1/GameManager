import { GameCatalogController } from './game-catalog.controller';

describe('GameCatalogController', () => {
  it('returns the complete authoritative multiplayer catalog', () => {
    const catalog = new GameCatalogController().getCatalog();
    expect(catalog).toHaveLength(101);
    expect(catalog.filter((game) => game.minPlayers >= 2)).toHaveLength(100);
  });
});
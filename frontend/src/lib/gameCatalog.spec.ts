import { GameType, DISTINCT_GAME_KEYS } from '@/shared';
import { parseGameCatalog } from './gameCatalog';

const existingKeys = [
  'bingo', 'chess', 'ludo', 'photobooth', 'uno', 'tictactoe', 'connectfour', 'sudoku',
];

function catalog() {
  const existing = existingKeys.map((key) => ({
    key,
    name: key,
    mark: key[0],
    description: `${key} game`,
    route: `/games/${key}`,
    accent: '#ffffff',
    surface: '#111111',
    gameType: GameType.BINGO,
    gameKey: null,
    minPlayers: 2,
    maxPlayers: 2,
    modes: [{ key: 'online', route: `/games/${key}` }],
  }));
  const distinct = DISTINCT_GAME_KEYS.map((key) => ({
    key,
    name: key,
    mark: key[0],
    description: `${key} game`,
    route: `/games/${key}`,
    accent: '#ffffff',
    surface: '#111111',
    gameType: GameType.DISTINCT,
    gameKey: key,
    minPlayers: 2,
    maxPlayers: 8,
    modes: [{ key: 'online', route: `/games/${key}` }],
  }));
  return {
    games: [...existing, ...distinct] as Array<Record<string, unknown>>,
    total: existingKeys.length + DISTINCT_GAME_KEYS.length,
  };
}

describe('parseGameCatalog', () => {
  it('accepts exactly eight existing plus all trusted distinct entries', () => {
    const parsed = parseGameCatalog(catalog());
    expect(parsed.total).toBe(existingKeys.length + DISTINCT_GAME_KEYS.length);
    expect(parsed.games.slice(8).map((game) => game.gameKey)).toEqual(DISTINCT_GAME_KEYS);
  });

  it('rejects a partial catalog even when its reported total matches', () => {
    const value = catalog();
    value.games.pop();
    value.total = value.games.length;
    expect(() => parseGameCatalog(value)).toThrow('Invalid game catalog');
  });

  it('rejects a forged distinct key', () => {
    const value = catalog();
    value.games[8] = { ...value.games[8], gameKey: 'battleship' };
    expect(() => parseGameCatalog(value)).toThrow('Invalid game catalog');
  });

  it('rejects duplicate catalog keys', () => {
    const value = catalog();
    const last = value.games.length - 1;
    value.games[last] = { ...value.games[last], key: value.games[last - 1].key };
    expect(() => parseGameCatalog(value)).toThrow('Invalid game catalog');
  });
});
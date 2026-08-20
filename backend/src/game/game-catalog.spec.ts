import { GameType } from '../shared';
import { getGameCatalog } from './game-catalog';
import { GameCatalogController } from './game-catalog.controller';
import { GameRegistry } from './game-registry';

describe('game catalog', () => {
  const registry = new GameRegistry();
  const games = getGameCatalog(registry);

  it('exposes exactly the existing eight plus thirty-six distinct games', () => {
    expect(games).toHaveLength(44);
    expect(games.map((game) => game.key)).toEqual([
      'bingo',
      'chess',
      'ludo',
      'photobooth',
      'uno',
      'tictactoe',
      'connectfour',
      'sudoku',
      'reversi',
      'checkers',
      'mancala',
      'dotsandboxes',
      'pig',
      'grid-salvo',
      'peg-codebreaker',
      'hangman',
      'go-fish',
      'crazy-eights',
      'five-dice-yacht',
      'liars-dice',
      'farkle',
      'shut-the-box',
      'draw-dominoes',
      'hearts',
      'spades',
      'gin-rummy',
      'card-war',
      'old-maid',
      'hex',
      'nine-mens-morris',
      'cee-lo',
      'trivia-quiz-bowl',
      'memory-match',
      'contract-bridge',
      'bourre',
      'bluff',
      'sevens',
      'ninety-nine',
      'euchre',
      'whist',
      'oh-hell',
      'president',
      'slapjack',
      'spoons',
    ]);
  });

  it('preserves all existing primary and alternate routes', () => {
    expect(games.slice(0, 8).map(({ key, route, modes }) => ({ key, route, modes }))).toEqual([
      { key: 'bingo', route: '/games/bingo', modes: [{ key: 'online', route: '/games/bingo' }, { key: 'offline', route: '/games/bingo/offline' }] },
      { key: 'chess', route: '/games/chess', modes: [{ key: 'online', route: '/games/chess' }] },
      { key: 'ludo', route: '/games/ludo', modes: [{ key: 'online', route: '/games/ludo' }, { key: 'offline', route: '/games/ludo/offline' }] },
      { key: 'photobooth', route: '/games/photobooth', modes: [{ key: 'online', route: '/games/photobooth' }] },
      { key: 'uno', route: '/games/uno', modes: [{ key: 'online', route: '/games/uno' }] },
      { key: 'tictactoe', route: '/games/tictactoe', modes: [{ key: 'online', route: '/games/tictactoe' }, { key: 'bot', route: '/games/tictactoe/bot' }] },
      { key: 'connectfour', route: '/games/connectfour', modes: [{ key: 'online', route: '/games/connectfour' }, { key: 'bot', route: '/games/connectfour/bot' }] },
      { key: 'sudoku', route: '/games/sudoku', modes: [{ key: 'solo', route: '/games/sudoku' }] },
    ]);
  });

  it('derives distinct capacities from their registered adapters', () => {
    const added = games.filter((game) => game.gameType === GameType.DISTINCT);
    expect(added).toHaveLength(36);
    expect(added.every((game) => game.minPlayers >= 2 && game.maxPlayers <= 10)).toBe(true);
    expect(added.every((game) => game.gameKey === game.key)).toBe(true);
    expect(added.every((game) => game.modes.length === 1 && game.modes[0].key === 'online')).toBe(true);
    expect(new Set(games.map((game) => game.key)).size).toBe(44);
    expect(added.find((game) => game.key === 'hangman')).toMatchObject({ minPlayers: 2, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'go-fish')).toMatchObject({ minPlayers: 2, maxPlayers: 5 });
    expect(added.find((game) => game.key === 'draw-dominoes')).toMatchObject({ minPlayers: 2, maxPlayers: 4 });
    expect(added.find((game) => game.key === 'hearts')).toMatchObject({ minPlayers: 4, maxPlayers: 4 });
    expect(added.find((game) => game.key === 'contract-bridge')).toMatchObject({ minPlayers: 4, maxPlayers: 4 });
    expect(added.find((game) => game.key === 'bourre')).toMatchObject({ minPlayers: 2, maxPlayers: 7 });
    expect(added.find((game) => game.key === 'bluff')).toMatchObject({ minPlayers: 2, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'sevens')).toMatchObject({ minPlayers: 3, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'ninety-nine')).toMatchObject({ minPlayers: 2, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'euchre')).toMatchObject({ minPlayers: 4, maxPlayers: 4 });
    expect(added.find((game) => game.key === 'whist')).toMatchObject({ minPlayers: 4, maxPlayers: 4 });
    expect(added.find((game) => game.key === 'oh-hell')).toMatchObject({ minPlayers: 3, maxPlayers: 7 });
    expect(added.find((game) => game.key === 'president')).toMatchObject({ minPlayers: 3, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'slapjack')).toMatchObject({ minPlayers: 2, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'spoons')).toMatchObject({ minPlayers: 3, maxPlayers: 8 });
    expect(added.find((game) => game.key === 'trivia-quiz-bowl')).toMatchObject({ minPlayers: 2, maxPlayers: 10 });
  });

  it('returns the count from the REST controller', () => {
    expect(new GameCatalogController(registry).getCatalog()).toEqual({ games, total: 44 });
  });
});
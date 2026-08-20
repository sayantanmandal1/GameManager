import { GameRegistry } from './game-registry';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { TicTacToeEngine } from './engines/tictactoe/tictactoe.engine';
import { ConnectFourEngine } from './engines/connectfour/connectfour.engine';
import { DISTINCT_GAME_KEYS } from '../shared';

describe('GameRegistry', () => {
  let registry: GameRegistry;

  beforeEach(() => {
    registry = new GameRegistry();
  });

  it('should return BingoEngine for BINGO game type', () => {
    const engine = registry.getEngine(GameType.BINGO);
    expect(engine).toBeInstanceOf(BingoEngine);
  });

  it('should return TicTacToeEngine for TICTACTOE game type', () => {
    expect(registry.getEngine(GameType.TICTACTOE)).toBeInstanceOf(TicTacToeEngine);
  });

  it('should return ConnectFourEngine for CONNECTFOUR game type', () => {
    expect(registry.getEngine(GameType.CONNECTFOUR)).toBeInstanceOf(ConnectFourEngine);
  });

  it('should throw for unknown game type', () => {
    expect(() => registry.getEngine('unknown' as any)).toThrow('No engine for game type');
  });

  it('registers exactly thirty-six production games with unique distinct adapters and rulesets', () => {
    const registrations = registry.getDistinctGames();

    expect(registrations.map((adapter) => adapter.key)).toEqual(DISTINCT_GAME_KEYS);
    expect(registrations).toHaveLength(36);
    expect(new Set(registrations.map((adapter) => adapter.key)).size).toBe(36);
    expect(new Set(registrations).size).toBe(36);
    expect(new Set(registrations.map((adapter) => adapter.rulesetId)).size).toBe(36);
    for (const gameKey of DISTINCT_GAME_KEYS) {
      expect(registry.getDistinctGame(gameKey).key).toBe(gameKey);
    }
  });

  it('rejects forged unknown distinct game keys', () => {
    expect(registry.hasDistinctGame('chess-2')).toBe(false);
    expect(() => registry.getDistinctGame('chess-2')).toThrow('invalid_game_key');
  });
});

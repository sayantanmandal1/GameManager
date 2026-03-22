import { GameRegistry } from './game-registry';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';

describe('GameRegistry', () => {
  let registry: GameRegistry;

  beforeEach(() => {
    registry = new GameRegistry();
  });

  it('should return BingoEngine for BINGO game type', () => {
    const engine = registry.getEngine(GameType.BINGO);
    expect(engine).toBeInstanceOf(BingoEngine);
  });

  it('should throw for unknown game type', () => {
    expect(() => registry.getEngine('unknown' as any)).toThrow('No engine for game type');
  });
});

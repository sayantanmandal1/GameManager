import { GameRegistry } from './game-registry';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { TicTacToeEngine } from './engines/tictactoe/tictactoe.engine';
import { ConnectFourEngine } from './engines/connectfour/connectfour.engine';

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
});

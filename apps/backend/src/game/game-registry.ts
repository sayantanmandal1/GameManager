import { Injectable } from '@nestjs/common';
import { GameType, IGameEngine } from '@multiplayer-games/shared';
import { BingoEngine } from './engines/bingo/bingo.engine';

@Injectable()
export class GameRegistry {
  private engines = new Map<GameType, IGameEngine>();

  constructor() {
    this.engines.set(GameType.BINGO, new BingoEngine());
    // Register future game engines here:
    // this.engines.set(GameType.CHESS, new ChessEngine());
  }

  getEngine<T extends IGameEngine>(gameType: GameType): T {
    const engine = this.engines.get(gameType);
    if (!engine) throw new Error(`No engine for game type: ${gameType}`);
    return engine as T;
  }
}

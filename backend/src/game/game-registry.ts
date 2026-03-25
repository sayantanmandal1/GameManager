import { Injectable } from '@nestjs/common';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';

@Injectable()
export class GameRegistry {
  private engines = new Map<GameType, BingoEngine | LudoEngine>();

  constructor() {
    this.engines.set(GameType.BINGO, new BingoEngine());
    this.engines.set(GameType.LUDO, new LudoEngine());
  }

  getEngine(gameType: GameType): BingoEngine | LudoEngine {
    const engine = this.engines.get(gameType);
    if (!engine) throw new Error(`No engine for game type: ${gameType}`);
    return engine;
  }
}

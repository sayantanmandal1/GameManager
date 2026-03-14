import { Injectable } from '@nestjs/common';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';

@Injectable()
export class GameRegistry {
  private engines = new Map<GameType, BingoEngine>();

  constructor() {
    this.engines.set(GameType.BINGO, new BingoEngine());
  }

  getEngine(gameType: GameType): BingoEngine {
    const engine = this.engines.get(gameType);
    if (!engine) throw new Error(`No engine for game type: ${gameType}`);
    return engine;
  }
}

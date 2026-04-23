import { Injectable } from '@nestjs/common';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';
import { ChessEngine } from './engines/chess/chess.engine';

export type AnyGameEngine = BingoEngine | LudoEngine | ChessEngine;

@Injectable()
export class GameRegistry {
  private engines = new Map<GameType, AnyGameEngine>();

  constructor() {
    this.engines.set(GameType.BINGO, new BingoEngine());
    this.engines.set(GameType.LUDO, new LudoEngine());
    this.engines.set(GameType.CHESS, new ChessEngine());
  }

  getEngine(gameType: GameType): AnyGameEngine {
    const engine = this.engines.get(gameType);
    if (!engine) throw new Error(`No engine for game type: ${gameType}`);
    return engine;
  }
}

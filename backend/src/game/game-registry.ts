import { Injectable } from '@nestjs/common';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';
import { ChessEngine } from './engines/chess/chess.engine';
import { PhotoboothEngine } from './engines/photobooth/photobooth.engine';
import { UnoEngine } from './engines/uno/uno.engine';
import { TicTacToeEngine } from './engines/tictactoe/tictactoe.engine';
import { ConnectFourEngine } from './engines/connectfour/connectfour.engine';
import { ArcadeEngine } from './engines/arcade/arcade.engine';

export type AnyGameEngine =
  | BingoEngine
  | LudoEngine
  | ChessEngine
  | PhotoboothEngine
  | UnoEngine
  | TicTacToeEngine
  | ConnectFourEngine
  | ArcadeEngine;

@Injectable()
export class GameRegistry {
  private engines = new Map<GameType, AnyGameEngine>();

  constructor() {
    this.engines.set(GameType.BINGO, new BingoEngine());
    this.engines.set(GameType.LUDO, new LudoEngine());
    this.engines.set(GameType.CHESS, new ChessEngine());
    this.engines.set(GameType.PHOTOBOOTH, new PhotoboothEngine());
    this.engines.set(GameType.UNO, new UnoEngine());
    this.engines.set(GameType.TICTACTOE, new TicTacToeEngine());
    this.engines.set(GameType.CONNECTFOUR, new ConnectFourEngine());
    this.engines.set(GameType.ARCADE, new ArcadeEngine());
  }

  getEngine(gameType: GameType): AnyGameEngine {
    const engine = this.engines.get(gameType);
    if (!engine) throw new Error(`No engine for game type: ${gameType}`);
    return engine;
  }
}

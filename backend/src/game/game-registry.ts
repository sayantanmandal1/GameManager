import { Injectable } from '@nestjs/common';
import { GameType } from '../shared';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';
import { ChessEngine } from './engines/chess/chess.engine';
import { PhotoboothEngine } from './engines/photobooth/photobooth.engine';
import { UnoEngine } from './engines/uno/uno.engine';
import { TicTacToeEngine } from './engines/tictactoe/tictactoe.engine';
import { ConnectFourEngine } from './engines/connectfour/connectfour.engine';
import { ReversiEngine } from './engines/reversi/reversi.engine';
import { CheckersEngine } from './engines/checkers/checkers.engine';
import { MancalaEngine } from './engines/mancala/mancala.engine';
import { DotsAndBoxesEngine } from './engines/dotsandboxes/dotsandboxes.engine';
import { PigEngine } from './engines/pig/pig.engine';
import { GridSalvoEngine } from './engines/gridsalvo/grid-salvo.engine';
import { PegCodebreakerEngine } from './engines/pegcodebreaker/peg-codebreaker.engine';
import { HangmanEngine } from './engines/hangman/hangman.engine';
import { GoFishEngine } from './engines/gofish/go-fish.engine';
import { CrazyEightsEngine } from './engines/crazyeights/crazy-eights.engine';
import { FiveDiceYachtEngine } from './engines/yacht/five-dice-yacht.engine';
import { LiarsDiceEngine } from './engines/liarsdice/liars-dice.engine';
import { FarkleEngine } from './engines/farkle/farkle.engine';
import { ShutTheBoxEngine } from './engines/shutthebox/shut-the-box.engine';
import { DrawDominoesEngine } from './engines/drawdominoes/draw-dominoes.engine';
import { HeartsEngine } from './engines/hearts/hearts.engine';
import { SpadesEngine } from './engines/spades/spades.engine';
import { GinRummyEngine } from './engines/ginrummy/gin-rummy.engine';
import { CardWarEngine } from './engines/cardwar/card-war.engine';
import { OldMaidEngine } from './engines/oldmaid/old-maid.engine';
import { HexEngine } from './engines/hex/hex.engine';
import { NineMensMorrisEngine } from './engines/ninemensmorris/nine-mens-morris.engine';
import { CeeLoEngine } from './engines/ceelo/cee-lo.engine';
import { TriviaQuizBowlEngine } from './engines/trivia/trivia-quiz-bowl.engine';
import { MemoryMatchEngine } from './engines/memorymatch/memory-match.engine';
import { ContractBridgeEngine } from './engines/contractbridge/contract-bridge.engine';
import { BourreEngine } from './engines/bourre/bourre.engine';
import { BluffEngine } from './engines/bluff/bluff.engine';
import { SevensEngine } from './engines/sevens/sevens.engine';
import { NinetyNineEngine } from './engines/ninetynine/ninety-nine.engine';
import { EuchreEngine } from './engines/euchre/euchre.engine';
import { WhistEngine } from './engines/whist/whist.engine';
import { OhHellEngine } from './engines/ohhell/oh-hell.engine';
import { PresidentEngine } from './engines/president/president.engine';
import { SlapjackEngine } from './engines/slapjack/slapjack.engine';
import { SpoonsEngine } from './engines/spoons/spoons.engine';
import {
  asRuntimeDistinctGameAdapter,
  RuntimeDistinctGameAdapter,
} from './engines/distinct-game.adapter';
import type { DistinctGameKey } from '../shared';

export type AnyGameEngine =
  | BingoEngine
  | LudoEngine
  | ChessEngine
  | PhotoboothEngine
  | UnoEngine
  | TicTacToeEngine
  | ConnectFourEngine;

@Injectable()
export class GameRegistry {
  private engines = new Map<GameType, AnyGameEngine>();
  private distinctGames = new Map<DistinctGameKey, RuntimeDistinctGameAdapter>();

  constructor() {
    this.engines.set(GameType.BINGO, new BingoEngine());
    this.engines.set(GameType.LUDO, new LudoEngine());
    this.engines.set(GameType.CHESS, new ChessEngine());
    this.engines.set(GameType.PHOTOBOOTH, new PhotoboothEngine());
    this.engines.set(GameType.UNO, new UnoEngine());
    this.engines.set(GameType.TICTACTOE, new TicTacToeEngine());
    this.engines.set(GameType.CONNECTFOUR, new ConnectFourEngine());

    [
      asRuntimeDistinctGameAdapter(new ReversiEngine()),
      asRuntimeDistinctGameAdapter(new CheckersEngine()),
      asRuntimeDistinctGameAdapter(new MancalaEngine()),
      asRuntimeDistinctGameAdapter(new DotsAndBoxesEngine()),
      asRuntimeDistinctGameAdapter(new PigEngine()),
      asRuntimeDistinctGameAdapter(new GridSalvoEngine()),
      asRuntimeDistinctGameAdapter(new PegCodebreakerEngine()),
      asRuntimeDistinctGameAdapter(new HangmanEngine()),
      asRuntimeDistinctGameAdapter(new GoFishEngine()),
      asRuntimeDistinctGameAdapter(new CrazyEightsEngine()),
      asRuntimeDistinctGameAdapter(new FiveDiceYachtEngine()),
      asRuntimeDistinctGameAdapter(new LiarsDiceEngine()),
      asRuntimeDistinctGameAdapter(new FarkleEngine()),
      asRuntimeDistinctGameAdapter(new ShutTheBoxEngine()),
      asRuntimeDistinctGameAdapter(new DrawDominoesEngine()),
      asRuntimeDistinctGameAdapter(new HeartsEngine()),
      asRuntimeDistinctGameAdapter(new SpadesEngine()),
      asRuntimeDistinctGameAdapter(new GinRummyEngine()),
      asRuntimeDistinctGameAdapter(new CardWarEngine()),
      asRuntimeDistinctGameAdapter(new OldMaidEngine()),
      asRuntimeDistinctGameAdapter(new HexEngine()),
      asRuntimeDistinctGameAdapter(new NineMensMorrisEngine()),
      asRuntimeDistinctGameAdapter(new CeeLoEngine()),
      asRuntimeDistinctGameAdapter(new TriviaQuizBowlEngine()),
      asRuntimeDistinctGameAdapter(new MemoryMatchEngine()),
      asRuntimeDistinctGameAdapter(new ContractBridgeEngine()),
      asRuntimeDistinctGameAdapter(new BourreEngine()),
      asRuntimeDistinctGameAdapter(new BluffEngine()),
      asRuntimeDistinctGameAdapter(new SevensEngine()),
      asRuntimeDistinctGameAdapter(new NinetyNineEngine()),
      asRuntimeDistinctGameAdapter(new EuchreEngine()),
      asRuntimeDistinctGameAdapter(new WhistEngine()),
      asRuntimeDistinctGameAdapter(new OhHellEngine()),
      asRuntimeDistinctGameAdapter(new PresidentEngine()),
      asRuntimeDistinctGameAdapter(new SlapjackEngine()),
      asRuntimeDistinctGameAdapter(new SpoonsEngine()),
    ].forEach((adapter) => {
      if (this.distinctGames.has(adapter.key)) {
        throw new Error(`Duplicate distinct game key: ${adapter.key}`);
      }
      this.distinctGames.set(adapter.key, adapter);
    });
  }

  getEngine(gameType: GameType): AnyGameEngine {
    const engine = this.engines.get(gameType);
    if (!engine) throw new Error(`No engine for game type: ${gameType}`);
    return engine;
  }

  getDistinctGame(gameKey: string): RuntimeDistinctGameAdapter {
    const adapter = this.distinctGames.get(gameKey as DistinctGameKey);
    if (!adapter) throw new Error('invalid_game_key');
    return adapter;
  }

  hasDistinctGame(gameKey: unknown): gameKey is DistinctGameKey {
    return typeof gameKey === 'string' && this.distinctGames.has(gameKey as DistinctGameKey);
  }

  getDistinctGames(): RuntimeDistinctGameAdapter[] {
    return [...this.distinctGames.values()];
  }
}

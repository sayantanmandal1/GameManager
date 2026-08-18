import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CACHE_CLIENT, CacheClient } from '../cache/cache.module';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { BingoEngine } from './engines/bingo/bingo.engine';
import { LudoEngine } from './engines/ludo/ludo.engine';
import { ChessEngine } from './engines/chess/chess.engine';
import { PhotoboothEngine } from './engines/photobooth/photobooth.engine';
import { UnoEngine, UnoActionResult } from './engines/uno/uno.engine';
import { TicTacToeEngine } from './engines/tictactoe/tictactoe.engine';
import { ConnectFourEngine } from './engines/connectfour/connectfour.engine';
import { ArcadeEngine } from './engines/arcade/arcade.engine';
import {
  GameType,
  GameStatus,
  LobbyStatus,
  BingoGameState,
  BingoPlayerView,
  BingoWinResult,
  LudoGameState,
  LudoPlayerView,
  LudoWinResult,
  LudoMoveAction,
  LudoMoveRecord,
  ChessGameState,
  ChessPlayerView,
  ChessMove,
  TimeControl,
  CHESS_SPECTATOR_CAP,
  PhotoboothGameState,
  PhotoboothPlayerView,
  PhotoboothLayout,
  PhotoboothThemeId,
  PhotoboothFilter,
  PHOTOBOOTH_MAX_ACTIVE_GAMES,
  UnoGameState,
  UnoPlayerView,
  UnoColor,
  UnoRoundResult,
  UnoRules,
  UnoPhase,
  TicTacToeAction,
  TicTacToeGameState,
  TicTacToeMode,
  TicTacToePlayerView,
  TicTacToeResult,
  ConnectFourGameState,
  ConnectFourPlayerView,
  ConnectFourResult,
  ArcadeAction,
  ArcadeGameState,
  ArcadePlayerView,
  ArcadeResult,
  getGameDefinition,
} from '../shared';

export interface ChessMoveApplied {
  move: ChessMove;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  clocks: ChessGameState['clocks'];
  inCheck: boolean;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export interface ChessGameOverPayload {
  gameId: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: NonNullable<ChessGameState['termination']>;
  winnerId: string | null;
  finalFen: string;
  pgn: string;
  endedAt: number;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private gameStates = new Map<string, BingoGameState>();
  private ludoGameStates = new Map<string, LudoGameState>();
  private chessGameStates = new Map<string, ChessGameState>();
  private photoboothGameStates = new Map<string, PhotoboothGameState>();
  private unoGameStates = new Map<string, UnoGameState>();
  private tictactoeGameStates = new Map<string, TicTacToeGameState>();
  private connectfourGameStates = new Map<string, ConnectFourGameState>();
  private arcadeGameStates = new Map<string, ArcadeGameState>();
  /** uno gameId → epoch ms to auto-start the next round (ROUND_OVER interstitial). */
  private unoNextRoundAt = new Map<string, number>();
  /** lobbyCode → gameId lookup */
  private lobbyGameMap = new Map<string, string>();
  /** lobbyCode → gameType lookup */
  private lobbyGameTypeMap = new Map<string, GameType>();
  private engine = new BingoEngine();
  private ludoEngine = new LudoEngine();
  private chessEngine = new ChessEngine();
  private photoboothEngine = new PhotoboothEngine();
  private unoEngine = new UnoEngine();
  private tictactoeEngine = new TicTacToeEngine();
  private connectfourEngine = new ConnectFourEngine();
  private arcadeEngine = new ArcadeEngine();

  /** Callbacks set by the gateway to broadcast state */
  onStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onGameFinished: ((gameId: string, lobbyCode: string, result: BingoWinResult) => void) | null =
    null;

  /** Ludo-specific callbacks */
  onLudoStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onLudoGameFinished: ((gameId: string, lobbyCode: string, result: LudoWinResult) => void) | null =
    null;
  onBotTurnNeeded: ((gameId: string, lobbyCode: string, botId: string) => void) | null = null;

  /** Chess-specific callbacks */
  onChessStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onChessMoveApplied:
    | ((gameId: string, lobbyCode: string, payload: ChessMoveApplied) => void)
    | null = null;
  onChessClockTick:
    | ((gameId: string, lobbyCode: string, tick: { whiteMs: number; blackMs: number; turn: 'w' | 'b'; serverTs: number }) => void)
    | null = null;
  onChessDrawOfferBroadcast:
    | ((gameId: string, lobbyCode: string, by: 'w' | 'b', byUserId: string) => void)
    | null = null;
  onChessDrawDeclined:
    | ((gameId: string, lobbyCode: string, by: 'w' | 'b') => void)
    | null = null;
  onChessGameFinished:
    | ((gameId: string, lobbyCode: string, payload: ChessGameOverPayload) => void)
    | null = null;

  /** Photobooth-specific callbacks */
  onPhotoboothStateChanged: ((gameId: string, lobbyCode: string) => void) | null =
    null;
  onPhotoboothFinished: ((gameId: string, lobbyCode: string) => void) | null =
    null;

  /** UNO-specific callbacks */
  onUnoStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onUnoRoundOver:
    | ((gameId: string, lobbyCode: string, result: UnoRoundResult) => void)
    | null = null;
  onUnoGameOver:
    | ((gameId: string, lobbyCode: string, result: UnoRoundResult) => void)
    | null = null;

  onTicTacToeStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onTicTacToeGameFinished:
    | ((gameId: string, lobbyCode: string, result: TicTacToeResult) => void)
    | null = null;
  onConnectFourStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onConnectFourGameFinished:
    | ((gameId: string, lobbyCode: string, result: ConnectFourResult) => void)
    | null = null;
  onArcadeStateChanged: ((gameId: string, lobbyCode: string) => void) | null = null;
  onArcadeGameFinished:
    | ((gameId: string, lobbyCode: string, result: ArcadeResult) => void)
    | null = null;

  constructor(
    @InjectRepository(GameEntity)
    private readonly gameRepo: Repository<GameEntity>,
    @Inject(CACHE_CLIENT) private readonly redis: CacheClient,
    private readonly lobbyService: LobbyService,
  ) {}

  async startBingoGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: BingoGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');

    const playerIds = lobby.players.map((p) => p.id);
    const playerNames: Record<string, string> = {};
    for (const p of lobby.players) {
      playerNames[p.id] = p.username;
    }
    const state = this.engine.initGame(playerIds, playerNames);

    // Persist game record
    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.BINGO,
      gameKey: lobby.gameKey ?? GameType.BINGO,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    // Store state in memory & map
    this.gameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.BINGO);

    // Cache for resilience
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);

    // Update lobby status
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    return { gameId, state };
  }

  getPlayerView(gameId: string, playerId: string): BingoPlayerView | null {
    const state = this.gameStates.get(gameId);
    if (!state) return null;
    return this.engine.getPlayerView(state, playerId);
  }

  placeNumber(
    gameId: string,
    playerId: string,
    row: number,
    col: number,
    number: number,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.placeNumber(state, playerId, row, col, number);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    // Broadcast updated state to all players
    if (this.onStateChanged) {
      this.onStateChanged(gameId, lobbyCode);
    }

    return { ok: true };
  }

  randomizeBoard(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.randomizeBoard(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    if (this.onStateChanged) {
      this.onStateChanged(gameId, lobbyCode);
    }

    return { ok: true };
  }

  async chooseNumber(
    gameId: string,
    playerId: string,
    number: number,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.chooseNumber(state, playerId, number);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    if (result.winner) {
      // Game over
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onGameFinished) {
        this.onGameFinished(gameId, lobbyCode, result.winner);
      }
    } else {
      // Broadcast updated state
      if (this.onStateChanged) {
        this.onStateChanged(gameId, lobbyCode);
      }
    }

    return { ok: true };
  }

  getGameIdForLobby(lobbyCode: string): string | undefined {
    return this.lobbyGameMap.get(lobbyCode);
  }

  getGameTypeForLobby(lobbyCode: string): GameType | undefined {
    return this.lobbyGameTypeMap.get(lobbyCode);
  }

  getState(gameId: string): BingoGameState | undefined {
    return this.gameStates.get(gameId);
  }

  async startTicTacToeGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: TicTacToeGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby || lobby.gameType !== GameType.TICTACTOE) {
      throw new Error('Tic Tac Toe lobby not found');
    }
    if (lobby.players.length !== 2) {
      throw new Error('Tic Tac Toe requires exactly 2 players');
    }

    const playerIds = lobby.players.map((player) => player.id);
    const playerNames = Object.fromEntries(
      lobby.players.map((player) => [player.id, player.username]),
    );
    const state = this.tictactoeEngine.initGame(
      playerIds,
      playerNames,
      lobby.tictactoeMode ?? TicTacToeMode.CLASSIC,
    );
    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.TICTACTOE,
      gameKey: lobby.gameKey ?? GameType.TICTACTOE,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);

    this.tictactoeGameStates.set(saved.id, state);
    this.lobbyGameMap.set(lobbyCode, saved.id);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.TICTACTOE);
    await this.redis.set(`game:${saved.id}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);
    return { gameId: saved.id, state };
  }

  getTicTacToeState(gameId: string): TicTacToeGameState | undefined {
    return this.tictactoeGameStates.get(gameId);
  }

  getTicTacToePlayerView(gameId: string, playerId: string): TicTacToePlayerView | null {
    const state = this.tictactoeGameStates.get(gameId);
    if (!state || !state.players.some((player) => player.id === playerId)) return null;
    return this.tictactoeEngine.getPlayerView(state, playerId);
  }

  async tictactoeMove(
    gameId: string,
    playerId: string,
    action: TicTacToeAction,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (
      this.lobbyGameMap.get(lobbyCode) !== gameId ||
      this.lobbyGameTypeMap.get(lobbyCode) !== GameType.TICTACTOE
    ) {
      return { ok: false, error: 'Game not found' };
    }
    const state = this.tictactoeGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const outcome = this.tictactoeEngine.applyAction(state, playerId, action);
    if (!outcome.valid) return { ok: false, error: outcome.reason };
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);

    if (outcome.result) {
      await this.finalizeTicTacToe(gameId, lobbyCode, outcome.result);
    } else {
      this.onTicTacToeStateChanged?.(gameId, lobbyCode);
    }
    return { ok: true };
  }

  async tictactoeSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.lobbyGameMap.get(lobbyCode) !== gameId) {
      return { ok: false, error: 'Game not found' };
    }
    const state = this.tictactoeGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    const outcome = this.tictactoeEngine.surrender(state, playerId);
    if (!outcome.valid || !outcome.result) {
      return { ok: false, error: outcome.reason };
    }
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.finalizeTicTacToe(gameId, lobbyCode, outcome.result);
    return { ok: true };
  }

  private async finalizeTicTacToe(
    gameId: string,
    lobbyCode: string,
    result: TicTacToeResult,
  ): Promise<void> {
    await this.gameRepo.update(gameId, {
      winnerId: result.winnerId,
      status: GameStatus.FINISHED,
      finishedAt: new Date(),
    });
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);
    this.onTicTacToeGameFinished?.(gameId, lobbyCode, result);
  }

  async startConnectFourGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: ConnectFourGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby || lobby.gameType !== GameType.CONNECTFOUR) {
      throw new Error('Connect Four lobby not found');
    }
    if (lobby.players.length !== 2) {
      throw new Error('Connect Four requires exactly 2 players');
    }
    const playerIds = lobby.players.map((player) => player.id);
    const playerNames = Object.fromEntries(
      lobby.players.map((player) => [player.id, player.username]),
    );
    const state = this.connectfourEngine.initGame(playerIds, playerNames);
    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.CONNECTFOUR,
      gameKey: lobby.gameKey ?? GameType.CONNECTFOUR,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    this.connectfourGameStates.set(saved.id, state);
    this.lobbyGameMap.set(lobbyCode, saved.id);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.CONNECTFOUR);
    await this.redis.set(`game:${saved.id}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);
    return { gameId: saved.id, state };
  }

  getConnectFourState(gameId: string): ConnectFourGameState | undefined {
    return this.connectfourGameStates.get(gameId);
  }

  getConnectFourPlayerView(gameId: string, playerId: string): ConnectFourPlayerView | null {
    const state = this.connectfourGameStates.get(gameId);
    if (!state || !state.players.some((player) => player.id === playerId)) return null;
    return this.connectfourEngine.getPlayerView(state, playerId);
  }

  async connectfourDrop(
    gameId: string,
    playerId: string,
    column: number,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (
      this.lobbyGameMap.get(lobbyCode) !== gameId ||
      this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CONNECTFOUR
    ) {
      return { ok: false, error: 'Game not found' };
    }
    const state = this.connectfourGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    const outcome = this.connectfourEngine.drop(state, playerId, column);
    if (!outcome.valid) return { ok: false, error: outcome.reason };
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    if (outcome.result) {
      await this.finalizeConnectFour(gameId, lobbyCode, outcome.result);
    } else {
      this.onConnectFourStateChanged?.(gameId, lobbyCode);
    }
    return { ok: true };
  }

  async connectfourSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.lobbyGameMap.get(lobbyCode) !== gameId) {
      return { ok: false, error: 'Game not found' };
    }
    const state = this.connectfourGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    const outcome = this.connectfourEngine.surrender(state, playerId);
    if (!outcome.valid || !outcome.result) {
      return { ok: false, error: outcome.reason };
    }
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.finalizeConnectFour(gameId, lobbyCode, outcome.result);
    return { ok: true };
  }

  private async finalizeConnectFour(
    gameId: string,
    lobbyCode: string,
    result: ConnectFourResult,
  ): Promise<void> {
    await this.gameRepo.update(gameId, {
      winnerId: result.winnerId,
      status: GameStatus.FINISHED,
      finishedAt: new Date(),
    });
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);
    this.onConnectFourGameFinished?.(gameId, lobbyCode, result);
  }

  async startArcadeGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: ArcadeGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby || lobby.gameType !== GameType.ARCADE || !lobby.gameKey) {
      throw new Error('Arcade lobby not found');
    }
    const definition = getGameDefinition(lobby.gameKey);
    if (!definition || definition.gameType !== GameType.ARCADE) {
      throw new Error('Arcade game not found');
    }
    const playerIds = lobby.players.map((player) => player.id);
    const playerNames = Object.fromEntries(
      lobby.players.map((player) => [player.id, player.username]),
    );
    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.ARCADE,
      gameKey: lobby.gameKey,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const state = this.arcadeEngine.initGame(
      saved.id,
      lobbyCode,
      definition as Parameters<ArcadeEngine['initGame']>[2],
      playerIds,
      playerNames,
    );

    this.arcadeGameStates.set(saved.id, state);
    this.lobbyGameMap.set(lobbyCode, saved.id);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.ARCADE);
    await this.redis.set(`game:${saved.id}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);
    return { gameId: saved.id, state };
  }

  getArcadeState(gameId: string): ArcadeGameState | undefined {
    return this.arcadeGameStates.get(gameId);
  }

  getArcadePlayerView(gameId: string, playerId: string): ArcadePlayerView | null {
    const state = this.arcadeGameStates.get(gameId);
    return state ? this.arcadeEngine.getPlayerView(state, playerId) : null;
  }

  async arcadeAction(
    gameId: string,
    playerId: string,
    action: ArcadeAction,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (
      this.lobbyGameMap.get(lobbyCode) !== gameId ||
      this.lobbyGameTypeMap.get(lobbyCode) !== GameType.ARCADE
    ) {
      return { ok: false, error: 'Game not found' };
    }
    const state = this.arcadeGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    const outcome = this.arcadeEngine.applyAction(state, playerId, action);
    if (!outcome.valid) return { ok: false, error: outcome.reason };
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    if (outcome.result) {
      await this.finalizeArcade(gameId, lobbyCode, outcome.result);
    } else {
      this.onArcadeStateChanged?.(gameId, lobbyCode);
    }
    return { ok: true };
  }

  async arcadeSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.lobbyGameMap.get(lobbyCode) !== gameId) {
      return { ok: false, error: 'Game not found' };
    }
    const state = this.arcadeGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    const outcome = this.arcadeEngine.surrender(state, playerId);
    if (!outcome.valid || !outcome.result) {
      return { ok: false, error: outcome.reason };
    }
    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.finalizeArcade(gameId, lobbyCode, outcome.result);
    return { ok: true };
  }

  private async finalizeArcade(
    gameId: string,
    lobbyCode: string,
    result: ArcadeResult,
  ): Promise<void> {
    await this.gameRepo.update(gameId, {
      winnerId: result.winnerId,
      status: GameStatus.FINISHED,
      finishedAt: new Date(),
    });
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);
    this.onArcadeGameFinished?.(gameId, lobbyCode, result);
  }

  async bingoSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.gameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.engine.surrender(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.gameStates.set(gameId, state);

    if (result.winner) {
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onGameFinished) {
        this.onGameFinished(gameId, lobbyCode, result.winner);
      }
    }

    return { ok: true };
  }

  // ─── Ludo Game Methods ───

  async startLudoGame(
    lobbyCode: string,
    botIds: string[] = [],
  ): Promise<{ gameId: string; state: LudoGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');

    const playerIds = lobby.players.map((p) => p.id);
    const playerNames: Record<string, string> = {};
    for (const p of lobby.players) {
      playerNames[p.id] = p.username;
    }
    const state = this.ludoEngine.initGame(playerIds, playerNames, botIds);

    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.LUDO,
      gameKey: lobby.gameKey ?? GameType.LUDO,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    this.ludoGameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.LUDO);

    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    return { gameId, state };
  }

  getLudoPlayerView(gameId: string, playerId: string): LudoPlayerView | null {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return null;
    return this.ludoEngine.getPlayerView(state, playerId);
  }

  getLudoState(gameId: string): LudoGameState | undefined {
    return this.ludoGameStates.get(gameId);
  }

  ludoRollDice(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): { ok: boolean; error?: string; dice?: number; turnSkipped?: boolean; turnCanceled?: boolean } {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.ludoEngine.rollDice(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.ludoGameStates.set(gameId, state);

    if (this.onLudoStateChanged) {
      this.onLudoStateChanged(gameId, lobbyCode);
    }

    // If no moves / turn skipped / canceled, check if next player is a bot
    if (result.turnSkipped || result.turnCanceled) {
      this.checkBotTurn(gameId, lobbyCode, state);
    }

    return { ok: true, dice: result.dice, turnSkipped: result.turnSkipped, turnCanceled: result.turnCanceled };
  }

  async ludoMoveToken(
    gameId: string,
    playerId: string,
    moves: LudoMoveAction[],
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.ludoEngine.moveToken(state, playerId, moves);
    if (!result.valid) return { ok: false, error: result.reason };

    this.ludoGameStates.set(gameId, state);

    if (result.winner) {
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onLudoGameFinished) {
        this.onLudoGameFinished(gameId, lobbyCode, result.winner);
      }
    } else {
      if (this.onLudoStateChanged) {
        this.onLudoStateChanged(gameId, lobbyCode);
      }
      // Check if next turn is a bot
      this.checkBotTurn(gameId, lobbyCode, state);
    }

    return { ok: true };
  }

  executeLudoBotTurn(
    gameId: string,
    lobbyCode: string,
  ): LudoMoveRecord[] {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return [];

    const botId = state.currentTurn;
    const player = state.players[botId];
    if (!player || !player.isBot) return [];

    const records = this.ludoEngine.executeBotTurn(state, botId);
    this.ludoGameStates.set(gameId, state);

    // Check for game over after bot turn
    if (state.winnerId && this.onLudoGameFinished) {
      this.gameRepo.update(gameId, {
        winnerId: state.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      }).catch(() => {});
      this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING).catch(() => {});

      this.onLudoGameFinished(gameId, lobbyCode, {
        winnerId: state.winnerId,
        winnerName: state.players[state.winnerId]?.username || 'Unknown',
        rankings: [...state.rankings],
      });
    } else if (this.onLudoStateChanged) {
      this.onLudoStateChanged(gameId, lobbyCode);
    }

    return records;
  }

  private checkBotTurn(gameId: string, lobbyCode: string, state: LudoGameState): void {
    const nextPlayer = state.players[state.currentTurn];
    if (nextPlayer?.isBot && this.onBotTurnNeeded) {
      this.onBotTurnNeeded(gameId, lobbyCode, state.currentTurn);
    }
  }

  async ludoSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.ludoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };

    const result = this.ludoEngine.surrender(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.ludoGameStates.set(gameId, state);

    if (result.winner) {
      await this.gameRepo.update(gameId, {
        winnerId: result.winner.winnerId,
        status: GameStatus.FINISHED,
        finishedAt: new Date(),
      });
      await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING);

      if (this.onLudoGameFinished) {
        this.onLudoGameFinished(gameId, lobbyCode, result.winner);
      }
    } else {
      if (this.onLudoStateChanged) {
        this.onLudoStateChanged(gameId, lobbyCode);
      }
      this.checkBotTurn(gameId, lobbyCode, state);
    }

    return { ok: true };
  }

  /** Find active Ludo game for a player by scanning all active games */
  findLudoGameForPlayer(playerId: string): { gameId: string; lobbyCode: string } | null {
    for (const [lobbyCode, gameId] of this.lobbyGameMap.entries()) {
      if (this.lobbyGameTypeMap.get(lobbyCode) !== GameType.LUDO) continue;
      const state = this.ludoGameStates.get(gameId);
      if (!state) continue;
      if (state.phase === 'finished') continue;
      if (state.players[playerId] && !state.rankings.includes(playerId)) {
        return { gameId, lobbyCode };
      }
    }
    return null;
  }

  // ─── Chess Game Methods ───────────────────────────────────────────────

  /**
   * Start a chess game for a 2-player lobby. Creates the `GameEntity` row,
   * seats the first joiner as white and the second as black, initializes
   * the engine with the lobby's optional `timeControl`, and caches state
   * in memory + cache. Throws if the lobby is missing or does not have
   * exactly two players.
   */
  async startChessGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: ChessGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.players.length !== 2) {
      throw new Error('Chess requires exactly 2 players');
    }

    // Seat assignment: first joiner = white, second = black. (Deterministic
    // and broadcast to clients via chess:state.)
    const [white, black] = lobby.players;
    const playerIds = [white.id, black.id];
    const playerNames: Record<string, string> = {
      [white.id]: white.username,
      [black.id]: black.username,
    };

    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.CHESS,
      gameKey: lobby.gameKey ?? GameType.CHESS,
      playerIds,
      status: GameStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    const tc: TimeControl | null = lobby.timeControl ?? null;
    const state = this.chessEngine.initGame(
      gameId,
      lobbyCode,
      white.id,
      black.id,
      playerNames,
      tc,
    );

    this.chessGameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.CHESS);

    await this.redis.set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    this.logger.log(
      `chess.started gameId=${gameId} lobbyCode=${lobbyCode} timed=${!!tc}`,
    );

    return { gameId, state };
  }

  getChessState(gameId: string): ChessGameState | undefined {
    return this.chessGameStates.get(gameId);
  }

  getChessView(gameId: string, userId: string): ChessPlayerView | null {
    const state = this.chessGameStates.get(gameId);
    if (!state) return null;
    return this.chessEngine.getPlayerView(state, userId);
  }

  /**
   * Apply a chess move. On success schedules broadcast + persistence; on
   * termination updates GameEntity and fires finish callback.
   */
  async applyChessMove(
    gameId: string,
    userId: string,
    move: { from: string; to: string; promotion?: string | null },
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) {
      return { ok: false, errorCode: 'game_not_active', errorMessage: 'Game not found' };
    }
    const res = this.chessEngine.applyMove(state, userId, move);
    if (!res.valid || !res.move) {
      this.logger.warn(
        `chess.illegal_move gameId=${gameId} userId=${userId} code=${res.errorCode}`,
      );
      return {
        ok: false,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
      };
    }

    // Persist snapshot
    await this.redis
      .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
      .catch(() => {});

    // Broadcast move
    if (this.onChessMoveApplied) {
      const halfmoveClock = parseInt(state.fen.split(' ')[4] ?? '0', 10) || 0;
      const fullmoveNumber = parseInt(state.fen.split(' ')[5] ?? '1', 10) || 1;
      // `inCheck` is encoded in the FEN via side-to-move — cheap reconstruct.
      const inCheck = this.computeInCheck(state);
      this.onChessMoveApplied(gameId, lobbyCode, {
        move: res.move,
        fen: state.fen,
        pgn: state.pgn,
        turn: state.turn,
        clocks: { ...state.clocks },
        inCheck,
        halfmoveClock,
        fullmoveNumber,
      });
    }

    this.logger.log(
      `chess.move gameId=${gameId} userId=${userId} san=${res.move.san} lobbyCode=${lobbyCode}`,
    );

    if (state.status === 'finished') {
      await this.finalizeChess(gameId, lobbyCode, state);
    }

    return { ok: true };
  }

  /** Resign the active chess game for `userId`; opponent wins. */
  async chessResign(
    gameId: string,
    userId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'game_not_active' };
    const res = this.chessEngine.resign(state, userId);
    if (!res.valid) return { ok: false, errorCode: res.errorCode };
    this.logger.log(
      `chess.resigned gameId=${gameId} userId=${userId} lobbyCode=${lobbyCode}`,
    );
    await this.finalizeChess(gameId, lobbyCode, state);
    return { ok: true };
  }

  /** Open a draw offer from `userId`; broadcast to the room on success. */
  async chessDrawOffer(
    gameId: string,
    userId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'game_not_active' };
    const res = this.chessEngine.offerDraw(state, userId);
    if (!res.valid) return { ok: false, errorCode: res.errorCode };
    const by = state.drawOffer!.by;
    await this.redis
      .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
      .catch(() => {});
    if (this.onChessDrawOfferBroadcast) {
      this.onChessDrawOfferBroadcast(gameId, lobbyCode, by, userId);
    }
    this.logger.log(
      `chess.draw_offered gameId=${gameId} userId=${userId} by=${by} lobbyCode=${lobbyCode}`,
    );
    return { ok: true };
  }

  /**
   * Respond to an open draw offer. `accept=true` ends the game 1/2-1/2 via
   * draw-agreement; `accept=false` clears the offer and emits
   * `chess:draw_declined` to the room.
   */
  async chessDrawResponse(
    gameId: string,
    userId: string,
    accept: boolean,
    lobbyCode: string,
  ): Promise<{ ok: boolean; errorCode?: string }> {
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'game_not_active' };
    const res = this.chessEngine.respondDraw(state, userId, accept);
    if (!res.valid) return { ok: false, errorCode: res.errorCode };
    this.logger.log(
      `chess.draw_response gameId=${gameId} userId=${userId} accept=${accept} lobbyCode=${lobbyCode}`,
    );
    if (res.accepted) {
      await this.finalizeChess(gameId, lobbyCode, state);
    } else {
      await this.redis
        .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
        .catch(() => {});
      if (this.onChessDrawDeclined && res.by) {
        this.onChessDrawDeclined(gameId, lobbyCode, res.by);
      }
    }
    return { ok: true };
  }

  /**
   * Called by the gateway clock-tick loop (every 500ms). Iterates active
   * chess games: updates clocks, detects flag-fall, and emits a ≤1Hz
   * `chess:clock_tick` broadcast per game.
   */
  async chessTick(nowMs: number = Date.now()): Promise<void> {
    for (const [lobbyCode, gameId] of this.lobbyGameMap.entries()) {
      if (this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) continue;
      const state = this.chessGameStates.get(gameId);
      if (!state) continue;
      if (state.status !== 'in_progress') continue;
      if (!state.timeControl) continue;

      const tick = this.chessEngine.tickClocks(state, nowMs);
      if (tick.flagged) {
        this.logger.log(
          `chess.flagged gameId=${gameId} color=${tick.flaggedColor} insufficient=${tick.insufficientMaterialForOpponent}`,
        );
        await this.finalizeChess(gameId, lobbyCode, state);
        continue;
      }

      // 1Hz throttle on tick broadcast
      if (nowMs - state.lastEmittedTickAt >= 1000 && this.onChessClockTick) {
        state.lastEmittedTickAt = nowMs;
        this.onChessClockTick(gameId, lobbyCode, {
          whiteMs: state.clocks.whiteMs,
          blackMs: state.clocks.blackMs,
          turn: state.turn,
          serverTs: nowMs,
        });
      }
    }
  }

  /** Handle a player or spectator rejoining an active chess game. */
  chessRejoin(
    lobbyCode: string,
    userId: string,
  ): { ok: boolean; errorCode?: string; gameId?: string; view?: ChessPlayerView } {
    const gameId = this.lobbyGameMap.get(lobbyCode);
    if (!gameId || this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) {
      return { ok: false, errorCode: 'no_active_game' };
    }
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'no_active_game' };
    const view = this.chessEngine.getPlayerView(state, userId);
    this.logger.log(
      `chess.rejoin gameId=${gameId} userId=${userId} role=${view.role}`,
    );
    return { ok: true, gameId, view };
  }

  /**
   * Add `userId` to the spectator list for the lobby's active chess game
   * and return the clamped player view. Rejects with `already_seated` if
   * the user is a seat and `spectator_cap` when the cap is reached.
   */
  chessSpectate(
    lobbyCode: string,
    userId: string,
  ): { ok: boolean; errorCode?: string; gameId?: string; view?: ChessPlayerView } {
    const gameId = this.lobbyGameMap.get(lobbyCode);
    if (!gameId || this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) {
      return { ok: false, errorCode: 'no_active_game' };
    }
    const state = this.chessGameStates.get(gameId);
    if (!state) return { ok: false, errorCode: 'no_active_game' };
    if (this.chessEngine.isSeat(state, userId)) {
      return { ok: false, errorCode: 'already_seated' };
    }
    if (state.spectators.length >= CHESS_SPECTATOR_CAP) {
      return { ok: false, errorCode: 'spectator_cap' };
    }
    if (!state.spectators.includes(userId)) {
      state.spectators.push(userId);
    }
    const view = this.chessEngine.getPlayerView(state, userId);
    return { ok: true, gameId, view };
  }

  /** Remove a spectator on disconnect (best-effort). */
  chessRemoveSpectator(gameId: string, userId: string): void {
    const state = this.chessGameStates.get(gameId);
    if (!state) return;
    const i = state.spectators.indexOf(userId);
    if (i >= 0) state.spectators.splice(i, 1);
  }

  private async finalizeChess(
    gameId: string,
    lobbyCode: string,
    state: ChessGameState,
  ): Promise<void> {
    const result = state.result!;
    const termination = state.termination!;
    const endedAt = state.endedAt ?? Date.now();
    const winnerId =
      result === '1-0'
        ? state.whitePlayerId
        : result === '0-1'
          ? state.blackPlayerId
          : null;

    await this.gameRepo
      .update(gameId, {
        status: GameStatus.FINISHED,
        finishedAt: new Date(endedAt),
        winnerId,
        result,
        termination,
        pgn: state.pgn,
        finalFen: state.fen,
      })
      .catch(() => {});
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.WAITING).catch(() => {});
    await this.redis
      .set(`game:${gameId}`, JSON.stringify(state), 'EX', 3600)
      .catch(() => {});

    this.logger.log(
      `chess.ended gameId=${gameId} result=${result} termination=${termination} winnerId=${winnerId ?? 'null'}`,
    );

    if (this.onChessGameFinished) {
      this.onChessGameFinished(gameId, lobbyCode, {
        gameId,
        result,
        termination,
        winnerId,
        finalFen: state.fen,
        pgn: state.pgn,
        endedAt,
      });
    }
  }

  private computeInCheck(state: ChessGameState): boolean {
    // Lazy import avoids a hard dep for consumers of the service who don't
    // use chess.js directly. chess.js itself is already pulled in by the
    // engine; this import is a no-op at runtime after that.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Chess } = require('chess.js');
      const c = new Chess();
      if (state.pgn) {
        try {
          c.loadPgn(state.pgn);
        } catch {
          c.load(state.fen);
        }
      } else {
        c.load(state.fen);
      }
      return c.inCheck();
    } catch {
      return false;
    }
  }

  /** Find active chess game a user is seated in. */
  findChessGameForPlayer(playerId: string): { gameId: string; lobbyCode: string } | null {
    for (const [lobbyCode, gameId] of this.lobbyGameMap.entries()) {
      if (this.lobbyGameTypeMap.get(lobbyCode) !== GameType.CHESS) continue;
      const state = this.chessGameStates.get(gameId);
      if (!state) continue;
      if (state.status !== 'in_progress') continue;
      if (state.whitePlayerId === playerId || state.blackPlayerId === playerId) {
        return { gameId, lobbyCode };
      }
    }
    return null;
  }

  // ─── Photobooth Game Methods ───────────────────────────────────────
  //
  // Photobooth is intentionally EPHEMERAL: state (including the base64 photo
  // blobs) lives only in memory for the lifetime of the session. Nothing is
  // written to the database or Redis, and the whole session is torn down when
  // the room dissolves (see photoboothCleanup). There is no winner/loser.

  async startPhotoboothGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: PhotoboothGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.players.length < 2) throw new Error('Photobooth needs two players');

    const [host, guest] = lobby.players;

    // Fresh start: drop any stale in-memory session bound to this lobby.
    const prior = this.lobbyGameMap.get(lobbyCode);
    if (prior) this.photoboothGameStates.delete(prior);
    if (!prior && this.photoboothGameStates.size >= PHOTOBOOTH_MAX_ACTIVE_GAMES) {
      throw new Error('Photobooth capacity reached');
    }

    const gameId = randomUUID();
    const state = this.photoboothEngine.initGame(
      gameId,
      lobbyCode,
      host.id,
      guest.id,
      host.username,
      guest.username,
    );

    this.photoboothGameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.PHOTOBOOTH);

    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    return { gameId, state };
  }

  getPhotoboothState(gameId: string): PhotoboothGameState | undefined {
    return this.photoboothGameStates.get(gameId);
  }

  getPhotoboothPlayerView(
    gameId: string,
    playerId: string,
  ): PhotoboothPlayerView | null {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return null;
    return this.photoboothEngine.getPlayerView(state, playerId);
  }

  photoboothConfigure(
    gameId: string,
    playerId: string,
    layout: PhotoboothLayout,
    theme: PhotoboothThemeId,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };

    const result = this.photoboothEngine.configure(state, playerId, layout, theme);
    if (!result.valid) return { ok: false, error: result.reason };

    this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
    return { ok: true };
  }

  photoboothStartCapture(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };

    const result = this.photoboothEngine.startCapture(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
    return { ok: true };
  }

  async photoboothCapture(
    gameId: string,
    playerId: string,
    image: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };

    const result = await this.photoboothEngine.capture(state, playerId, image);
    if (!result.valid) return { ok: false, error: result.reason };

    // Intentionally NOT broadcast: a partner's half stays hidden until both
    // confirm (the synchronized reveal), so the capturer's local preview is
    // the only thing that changes here. Skipping the broadcast also avoids a
    // broadcast-amplification vector from rapid re-captures.
    return { ok: true };
  }

  photoboothRetake(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };

    const result = this.photoboothEngine.retake(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
    return { ok: true };
  }

  async photoboothConfirm(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };

    const result = this.photoboothEngine.confirm(state, playerId);
    if (!result.valid) return { ok: false, error: result.reason };

    if (result.finished) {
      // No DB record — just free the lobby for a rematch and fire the reveal.
      await this.lobbyService
        .setStatus(state.lobbyCode, LobbyStatus.WAITING)
        .catch(() => {});
      this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
      this.onPhotoboothFinished?.(gameId, state.lobbyCode);
    } else {
      this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
    }

    return { ok: true };
  }

  photoboothSetFilter(
    gameId: string,
    playerId: string,
    filter: PhotoboothFilter,
    lobbyCode: string,
  ): { ok: boolean; error?: string } {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };

    const result = this.photoboothEngine.setFilter(state, playerId, filter);
    if (!result.valid) return { ok: false, error: result.reason };

    this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
    return { ok: true };
  }

  /** Mark a partner disconnected/reconnected and broadcast presence. */
  photoboothSetConnected(
    gameId: string,
    playerId: string,
    connected: boolean,
    lobbyCode: string,
  ): void {
    const state = this.photoboothGameStates.get(gameId);
    if (!state) return;
    if (state.lobbyCode !== lobbyCode) return;
    this.photoboothEngine.setConnected(state, playerId, connected);
    this.onPhotoboothStateChanged?.(gameId, state.lobbyCode);
  }

  /**
   * Tear down all in-memory photobooth state once the room dissolves (both
   * partners gone). Guarantees the photos are deleted and the next session
   * starts from scratch — nothing lingers anywhere.
   */
  photoboothCleanup(gameId: string, lobbyCode: string): void {
    const state = this.photoboothGameStates.get(gameId);
    if (!state || state.lobbyCode !== lobbyCode) return;
    this.photoboothGameStates.delete(gameId);
    if (this.lobbyGameMap.get(state.lobbyCode) === gameId) {
      this.lobbyGameMap.delete(state.lobbyCode);
      this.lobbyGameTypeMap.delete(state.lobbyCode);
    }
  }

  // ─── UNO Game Methods ──────────────────────────────────────────────

  private readonly UNO_NEXT_ROUND_DELAY_MS = 6000;

  async startUnoGame(
    lobbyCode: string,
  ): Promise<{ gameId: string; state: UnoGameState }> {
    const lobby = await this.lobbyService.getLobby(lobbyCode);
    if (!lobby) throw new Error('Lobby not found');
    const playerIds = lobby.players.map((p) => p.id);
    if (playerIds.length < 2) throw new Error('UNO needs at least 2 players');

    const names: Record<string, string> = {};
    const connected: Record<string, boolean> = {};
    for (const p of lobby.players) {
      names[p.id] = p.username;
      connected[p.id] = true;
    }
    const rules: UnoRules = lobby.unoRules ?? {
      mode: 'classic',
      targetScore: null,
      stacking: false,
      drawToMatch: false,
      jumpIn: false,
      sevenZero: false,
      forcePlay: false,
      noBluffing: false,
    };

    const entity = this.gameRepo.create({
      lobbyId: lobby.id,
      gameType: GameType.UNO,
      gameKey: lobby.gameKey ?? GameType.UNO,
      playerIds,
      status: GameStatus.IN_PROGRESS,
    });
    const saved = await this.gameRepo.save(entity);
    const gameId = saved.id;

    const state = this.unoEngine.initRound(
      gameId,
      lobbyCode,
      playerIds,
      names,
      rules,
      {},
      connected,
    );

    this.unoGameStates.set(gameId, state);
    this.lobbyGameMap.set(lobbyCode, gameId);
    this.lobbyGameTypeMap.set(lobbyCode, GameType.UNO);
    await this.lobbyService.setStatus(lobbyCode, LobbyStatus.IN_PROGRESS);

    return { gameId, state };
  }

  getUnoState(gameId: string): UnoGameState | undefined {
    return this.unoGameStates.get(gameId);
  }

  getUnoPlayerView(gameId: string, recipientId: string): UnoPlayerView | null {
    const state = this.unoGameStates.get(gameId);
    if (!state) return null;
    const isPlayer = state.players.some((player) => player.id === recipientId);
    if (!isPlayer && !state.spectators.includes(recipientId)) return null;
    return this.unoEngine.getPlayerView(state, recipientId);
  }

  async unoPlay(
    gameId: string,
    playerId: string,
    cardId: string,
    chosenColor: UnoColor | undefined,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.play(state, playerId, cardId, chosenColor),
    );
  }

  async unoDraw(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.draw(state, playerId),
    );
  }

  async unoPass(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.pass(state, playerId),
    );
  }

  async unoTake(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.take(state, playerId),
    );
  }

  async unoChallenge(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.challenge(state, playerId),
    );
  }

  async unoCallUno(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.callUno(state, playerId),
    );
  }

  async unoCatch(
    gameId: string,
    catcherId: string,
    targetId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.catchPlayer(state, catcherId, targetId),
    );
  }

  async unoSurrender(
    gameId: string,
    playerId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.surrender(state, playerId),
    );
  }

  async unoChooseSeven(
    gameId: string,
    playerId: string,
    targetId: string,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.chooseSeven(state, playerId, targetId),
    );
  }

  async unoJumpIn(
    gameId: string,
    playerId: string,
    cardId: string,
    chosenColor: UnoColor | undefined,
    lobbyCode: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'Game not found' };
    if (state.lobbyCode !== lobbyCode)
      return { ok: false, error: 'Game not found' };
    return this.handleUnoResult(
      gameId,
      state.lobbyCode,
      this.unoEngine.jumpIn(state, playerId, cardId, chosenColor),
    );
  }

  unoRejoin(
    lobbyCode: string,
    userId: string,
  ): { ok: boolean; error?: string; gameId?: string; view?: UnoPlayerView } {
    const gameId = this.lobbyGameMap.get(lobbyCode);
    if (!gameId || this.lobbyGameTypeMap.get(lobbyCode) !== GameType.UNO)
      return { ok: false, error: 'no_active_game' };
    const state = this.unoGameStates.get(gameId);
    if (!state) return { ok: false, error: 'no_active_game' };

    if (state.players.some((p) => p.id === userId)) {
      this.unoEngine.setConnected(state, userId, true);
    } else {
      if (!this.unoEngine.addSpectator(state, userId))
        return { ok: false, error: 'spectator_cap' };
    }
    return { ok: true, gameId, view: this.unoEngine.getPlayerView(state, userId) };
  }

  unoHandleDisconnect(gameId: string, userId: string, lobbyCode: string): void {
    const state = this.unoGameStates.get(gameId);
    if (!state) return;
    if (state.lobbyCode !== lobbyCode) return;
    if (state.players.some((p) => p.id === userId)) {
      this.unoEngine.setConnected(state, userId, false);
    } else {
      this.unoEngine.removeSpectator(state, userId);
    }
    this.onUnoStateChanged?.(gameId, state.lobbyCode);
  }

  unoCleanup(gameId: string, lobbyCode: string): void {
    const state = this.unoGameStates.get(gameId);
    if (!state || state.lobbyCode !== lobbyCode) return;
    this.unoGameStates.delete(gameId);
    this.unoNextRoundAt.delete(gameId);
    if (this.lobbyGameMap.get(state.lobbyCode) === gameId) {
      this.lobbyGameMap.delete(state.lobbyCode);
      this.lobbyGameTypeMap.delete(state.lobbyCode);
    }
  }

  /** Driven ~1 Hz by the gateway: enforce turn timers and round pacing. */
  async unoTick(): Promise<void> {
    const now = Date.now();
    for (const [gameId, state] of this.unoGameStates) {
      const lobbyCode = state.lobbyCode;
      if (state.phase === UnoPhase.PLAYING) {
        if (now >= state.turnEndsAt) {
          const r = this.unoEngine.timeout(state);
          if (r.ok) await this.handleUnoResult(gameId, lobbyCode, r);
        }
      } else if (state.phase === UnoPhase.ROUND_OVER) {
        const at = this.unoNextRoundAt.get(gameId);
        if (at && now >= at) {
          this.unoNextRoundAt.delete(gameId);
          this.unoEngine.startNextRound(state);
          this.onUnoStateChanged?.(gameId, lobbyCode);
        }
      }
    }
  }

  private async handleUnoResult(
    gameId: string,
    lobbyCode: string,
    result: UnoActionResult,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!result.ok) return { ok: false, error: result.error };

    this.onUnoStateChanged?.(gameId, lobbyCode);

    const rr = result.roundResult;
    if (rr) {
      if (rr.matchOver) {
        await this.gameRepo
          .update(gameId, {
            winnerId: rr.matchWinnerId,
            status: GameStatus.FINISHED,
            finishedAt: new Date(),
          })
          .catch(() => {});
        await this.lobbyService
          .setStatus(lobbyCode, LobbyStatus.WAITING)
          .catch(() => {});
        this.onUnoGameOver?.(gameId, lobbyCode, rr);
      } else {
        this.unoNextRoundAt.set(
          gameId,
          Date.now() + this.UNO_NEXT_ROUND_DELAY_MS,
        );
        this.onUnoRoundOver?.(gameId, lobbyCode, rr);
      }
    }
    return { ok: true };
  }
}

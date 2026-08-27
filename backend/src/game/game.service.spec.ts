import { GameService } from './game.service';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { Repository } from 'typeorm';
import { CacheClient } from '../cache/cache.module';
import {
  GameType,
  GameStatus,
  LobbyStatus,
  BingoGamePhase,
  PHOTOBOOTH_MAX_ACTIVE_GAMES,
  TicTacToeMode,
  TicTacToePhase,
  UnoPhase,
} from '../shared';

describe('GameService', () => {
  let service: GameService;
  let mockGameRepo: Partial<Record<keyof Repository<GameEntity>, jest.Mock>>;
  let mockRedis: Partial<Record<'get' | 'set' | 'del', jest.Mock>>;
  let mockLobbyService: Partial<Record<keyof LobbyService, jest.Mock>>;

  const fakeLobby = {
    id: 'lobby1',
    code: '123456',
    hostId: 'player1',
    gameType: GameType.BINGO,
    players: [
      { id: 'player1', username: 'Alice', avatar: '🦊', isReady: true, isHost: true, joinedAt: new Date() },
      { id: 'player2', username: 'Bob', avatar: '🐱', isReady: true, isHost: false, joinedAt: new Date() },
    ],
    status: LobbyStatus.WAITING,
    maxPlayers: 8,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockGameRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'game1' })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn(),
    };
    mockLobbyService = {
      getLobby: jest.fn(),
      setStatus: jest.fn().mockResolvedValue(undefined),
      orderPlayersForGame: jest.fn().mockImplementation((lobby) => [...lobby.players]),
    };

    service = new GameService(
      mockGameRepo as unknown as Repository<GameEntity>,
      mockRedis as unknown as CacheClient,
      mockLobbyService as unknown as LobbyService,
    );
  });

  describe('startBingoGame', () => {
    it('should create a game in SETUP phase', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);

      const { gameId, state } = await service.startBingoGame('123456');

      expect(gameId).toBe('game1');
      expect(state.phase).toBe(BingoGamePhase.SETUP);
      expect(state.playerIds).toEqual(['player1', 'player2']);
      expect(state.playerNames).toEqual({ player1: 'Alice', player2: 'Bob' });
      expect(mockGameRepo.save).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockLobbyService.setStatus).toHaveBeenCalledWith('123456', LobbyStatus.IN_PROGRESS);
    });

    it('should throw if lobby not found', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(null);
      await expect(service.startBingoGame('000000')).rejects.toThrow('Lobby not found');
    });
  });

  describe('getPlayerView', () => {
    it('should return null for unknown game', () => {
      const view = service.getPlayerView('unknown', 'player1');
      expect(view).toBeNull();
    });

    it('should return the player view after starting a game', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);
      const { gameId } = await service.startBingoGame('123456');

      const view = service.getPlayerView(gameId, 'player1');
      expect(view).toBeTruthy();
      expect(view!.phase).toBe(BingoGamePhase.SETUP);
      expect(view!.board).toBeDefined();
    });
  });

  describe('Tic Tac Toe lifecycle', () => {
    const tictactoeLobby = {
      ...fakeLobby,
      gameType: GameType.TICTACTOE,
      maxPlayers: 2,
      tictactoeMode: TicTacToeMode.LIMITED,
    };

    it('starts a two-player game with the persisted mode', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(tictactoeLobby);

      const { gameId, state } = await service.startTicTacToeGame('123456');

      expect(gameId).toBe('game1');
      expect(state.mode).toBe(TicTacToeMode.LIMITED);
      expect(state.players.map((player) => player.id)).toEqual(['player1', 'player2']);
      expect(mockLobbyService.setStatus).toHaveBeenCalledWith(
        '123456',
        LobbyStatus.IN_PROGRESS,
      );
    });

    it('rejects a move whose game is not bound to the supplied lobby', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(tictactoeLobby);
      const { gameId } = await service.startTicTacToeGame('123456');

      await expect(
        service.tictactoeMove(gameId, 'player1', { to: 0 }, '654321'),
      ).resolves.toEqual({ ok: false, error: 'Game not found' });
    });

    it('persists a winning move and emits the terminal result', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...tictactoeLobby,
        tictactoeMode: TicTacToeMode.CLASSIC,
      });
      const { gameId } = await service.startTicTacToeGame('123456');
      const finished = jest.fn();
      service.onTicTacToeGameFinished = finished;

      await service.tictactoeMove(gameId, 'player1', { to: 0 }, '123456');
      await service.tictactoeMove(gameId, 'player2', { to: 3 }, '123456');
      await service.tictactoeMove(gameId, 'player1', { to: 1 }, '123456');
      await service.tictactoeMove(gameId, 'player2', { to: 4 }, '123456');
      await service.tictactoeMove(gameId, 'player1', { to: 2 }, '123456');

      expect(service.getTicTacToeState(gameId)?.phase).toBe(TicTacToePhase.FINISHED);
      expect(mockGameRepo.update).toHaveBeenCalledWith(
        gameId,
        expect.objectContaining({ winnerId: 'player1', status: GameStatus.FINISHED }),
      );
      expect(finished).toHaveBeenCalledWith(
        gameId,
        '123456',
        expect.objectContaining({ winnerId: 'player1' }),
      );
    });
  });

  describe('Connect Four lifecycle', () => {
    const connectFourLobby = {
      ...fakeLobby,
      gameType: GameType.CONNECTFOUR,
      maxPlayers: 2,
    };

    it('starts exactly two players and binds the lobby to the game', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(connectFourLobby);
      const { gameId, state } = await service.startConnectFourGame('123456');
      expect(gameId).toBe('game1');
      expect(state.players.map((player) => player.id)).toEqual(['player1', 'player2']);
      expect(service.getGameTypeForLobby('123456')).toBe(GameType.CONNECTFOUR);
    });

    it('persists and emits a terminal horizontal win', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(connectFourLobby);
      const { gameId } = await service.startConnectFourGame('123456');
      const finished = jest.fn();
      service.onConnectFourGameFinished = finished;
      for (const [player, column] of [
        ['player1', 0], ['player2', 0], ['player1', 1], ['player2', 1],
        ['player1', 2], ['player2', 2], ['player1', 3],
      ] as const) {
        await service.connectfourDrop(gameId, player, column, '123456');
      }
      expect(mockGameRepo.update).toHaveBeenCalledWith(
        gameId,
        expect.objectContaining({ winnerId: 'player1', status: GameStatus.FINISHED }),
      );
      expect(finished).toHaveBeenCalledWith(
        gameId,
        '123456',
        expect.objectContaining({ winnerId: 'player1' }),
      );
    });
  });

  describe('distinct game lifecycle', () => {
    const distinctLobby = {
      ...fakeLobby,
      gameType: GameType.DISTINCT,
      gameKey: 'reversi' as const,
      maxPlayers: 2,
    };

    it('cancels pending automatic actions during shutdown', () => {
      jest.useFakeTimers();
      const callback = jest.fn();
      const timer = setTimeout(callback, 1_500) as unknown as ReturnType<typeof setTimeout>;
      const timers = (service as unknown as {
        distinctAutoPlayTimers: Map<string, ReturnType<typeof setTimeout>>;
      }).distinctAutoPlayTimers;
      timers.set('game1', timer);

      service.onModuleDestroy();
      jest.advanceTimersByTime(1_500);

      expect(callback).not.toHaveBeenCalled();
      expect(timers).toHaveProperty('size', 0);
      jest.useRealTimers();
    });

    it('binds the persisted key and routes actions through its adapter', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(distinctLobby);
      const { gameId, gameKey } = await service.startDistinctGame('123456');
      const changed = jest.fn();
      service.onDistinctGameStateChanged = changed;

      expect(gameKey).toBe('reversi');
      expect(service.getDistinctGameKey(gameId)).toBe('reversi');
      expect(mockGameRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ gameType: GameType.DISTINCT, gameKey: 'reversi' }),
      );
      await expect(
        service.distinctGameAction(gameId, 'player1', { cell: 19 }, '123456'),
      ).resolves.toEqual({ ok: true });
      expect(changed).toHaveBeenCalledWith(gameId, '123456', 'reversi');
      expect(service.getDistinctPlayerView(gameId, 'outside')).toBeNull();
    });

    it('waits for multiplayer state fanout before completing an action', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(distinctLobby);
      const { gameId } = await service.startDistinctGame('123456');
      let releaseBroadcast!: () => void;
      const broadcast = new Promise<void>((resolve) => {
        releaseBroadcast = resolve;
      });
      service.onDistinctGameStateChanged = jest.fn(() => broadcast);

      const action = service.distinctGameAction(
        gameId,
        'player1',
        { cell: 19 },
        '123456',
      );
      let completed = false;
      void action.then(() => {
        completed = true;
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(completed).toBe(false);
      releaseBroadcast();
      await expect(action).resolves.toEqual({ ok: true });
      expect(service.onDistinctGameStateChanged).toHaveBeenCalledWith(
        gameId,
        '123456',
        'reversi',
      );
    });

    it('rejects a distinct action paired with another lobby', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(distinctLobby);
      const { gameId } = await service.startDistinctGame('123456');

      await expect(
        service.distinctGameAction(gameId, 'player1', { cell: 19 }, '654321'),
      ).resolves.toEqual({ ok: false, error: 'Game not found' });
    });

    it('finalizes a surrender and returns the lobby to waiting', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(distinctLobby);
      const { gameId } = await service.startDistinctGame('123456');
      const finished = jest.fn();
      service.onDistinctGameFinished = finished;

      await expect(
        service.distinctGameSurrender(gameId, 'player1', '123456'),
      ).resolves.toEqual({ ok: true });
      expect(mockGameRepo.update).toHaveBeenCalledWith(
        gameId,
        expect.objectContaining({ winnerId: 'player2', status: GameStatus.FINISHED }),
      );
      expect(mockLobbyService.setStatus).toHaveBeenCalledWith(
        '123456',
        LobbyStatus.WAITING,
      );
      expect(finished).toHaveBeenCalledWith(
        gameId,
        '123456',
        'reversi',
        expect.objectContaining({ winnerId: 'player2', reason: 'surrender' }),
      );
    });

    it('starts partnership engines in the server-validated team order', async () => {
      const bridgeLobby = {
        ...fakeLobby,
        gameType: GameType.DISTINCT,
        gameKey: 'contract-bridge' as const,
        maxPlayers: 4,
        players: [
          { id: 'north', username: 'North', team: 0 },
          { id: 'south', username: 'South', team: 0 },
          { id: 'east', username: 'East', team: 1 },
          { id: 'west', username: 'West', team: 1 },
        ],
      };
      const ordered = [
        bridgeLobby.players[0],
        bridgeLobby.players[2],
        bridgeLobby.players[1],
        bridgeLobby.players[3],
      ];
      mockLobbyService.getLobby!.mockResolvedValue(bridgeLobby);
      mockLobbyService.orderPlayersForGame!.mockReturnValue(ordered);

      const { state } = await service.startDistinctGame('123456');

      expect(mockLobbyService.orderPlayersForGame).toHaveBeenCalledWith(bridgeLobby);
      expect((state as { players: Array<{ id: string; team: number }> }).players).toEqual([
        expect.objectContaining({ id: 'north', team: 0 }),
        expect.objectContaining({ id: 'east', team: 1 }),
        expect.objectContaining({ id: 'south', team: 0 }),
        expect.objectContaining({ id: 'west', team: 1 }),
      ]);
    });
  });

  describe('placeNumber', () => {
    it('should place a number and return ok', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);
      const { gameId } = await service.startBingoGame('123456');

      const result = service.placeNumber(gameId, 'player1', 0, 0, 1, '123456');
      expect(result.ok).toBe(true);
    });

    it('should return error for unknown game', () => {
      const result = service.placeNumber('unknown', 'player1', 0, 0, 1, '123456');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Game not found');
    });

    it('should call onStateChanged callback', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);
      const { gameId } = await service.startBingoGame('123456');

      const mockCallback = jest.fn();
      service.onStateChanged = mockCallback;

      service.placeNumber(gameId, 'player1', 0, 0, 1, '123456');
      expect(mockCallback).toHaveBeenCalledWith(gameId, '123456');
    });
  });

  describe('randomizeBoard', () => {
    it('should randomize a board and return ok', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);
      const { gameId } = await service.startBingoGame('123456');

      const result = service.randomizeBoard(gameId, 'player1', '123456');
      expect(result.ok).toBe(true);
    });

    it('should return error for unknown game', () => {
      const result = service.randomizeBoard('unknown', 'player1', '123456');
      expect(result.ok).toBe(false);
    });
  });

  describe('chooseNumber', () => {
    async function setupPlayingGame() {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);
      const { gameId } = await service.startBingoGame('123456');

      // Randomize both boards to get to play phase
      service.randomizeBoard(gameId, 'player1', '123456');
      service.randomizeBoard(gameId, 'player2', '123456');

      return gameId;
    }

    it('should choose a number in play phase', async () => {
      const gameId = await setupPlayingGame();

      const result = await service.chooseNumber(gameId, 'player1', 1, '123456');
      expect(result.ok).toBe(true);
    });

    it('should return error for unknown game', async () => {
      const result = await service.chooseNumber('unknown', 'player1', 1, '123456');
      expect(result.ok).toBe(false);
    });

    it('should advance turns after choosing', async () => {
      const gameId = await setupPlayingGame();

      await service.chooseNumber(gameId, 'player1', 1, '123456');

      const view = service.getPlayerView(gameId, 'player2');
      expect(view!.currentTurn).toBe('player2');
    });
  });

  describe('getGameIdForLobby', () => {
    it('should return the game id for a lobby', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(fakeLobby);
      await service.startBingoGame('123456');

      expect(service.getGameIdForLobby('123456')).toBe('game1');
    });

    it('should return undefined for unknown lobby', () => {
      expect(service.getGameIdForLobby('unknown')).toBeUndefined();
    });
  });

  describe('authoritative lobby binding', () => {
    it('rejects a photobooth mutation paired with another lobby code', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...fakeLobby,
        gameType: GameType.PHOTOBOOTH,
      });
      const { gameId } = await service.startPhotoboothGame('123456');
      const onStateChanged = jest.fn();
      service.onPhotoboothStateChanged = onStateChanged;

      const result = service.photoboothConfigure(
        gameId,
        'player1',
        'grid-2x2',
        'denim',
        '654321',
      );

      expect(result).toEqual({ ok: false, error: 'Game not found' });
      expect(onStateChanged).not.toHaveBeenCalled();
    });

    it('rejects a UNO mutation paired with another lobby code', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...fakeLobby,
        gameType: GameType.UNO,
      });
      const { gameId } = await service.startUnoGame('123456');
      const onStateChanged = jest.fn();
      service.onUnoStateChanged = onStateChanged;

      const result = await service.unoDraw(gameId, 'player1', '654321');

      expect(result).toEqual({ ok: false, error: 'Game not found' });
      expect(onStateChanged).not.toHaveBeenCalled();
    });

    it('rejects a roulette color paired with another lobby code', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...fakeLobby,
        gameType: GameType.UNO,
      });
      const { gameId } = await service.startUnoGame('123456');
      const onStateChanged = jest.fn();
      service.onUnoStateChanged = onStateChanged;

      const result = await service.unoChooseRouletteColor(
        gameId,
        'player1',
        'red',
        '654321',
      );

      expect(result).toEqual({ ok: false, error: 'Game not found' });
      expect(onStateChanged).not.toHaveBeenCalled();
    });

    it('rejects an opening color paired with another lobby code', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...fakeLobby,
        gameType: GameType.UNO,
      });
      const { gameId } = await service.startUnoGame('123456');
      const onStateChanged = jest.fn();
      service.onUnoStateChanged = onStateChanged;

      const result = await service.unoChooseOpeningColor(
        gameId,
        'player1',
        'red',
        '654321',
      );

      expect(result).toEqual({ ok: false, error: 'Game not found' });
      expect(onStateChanged).not.toHaveBeenCalled();
    });
  });

  describe('UNO match pacing', () => {
    it('never auto-starts another round after a terminal match result', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...fakeLobby,
        gameType: GameType.UNO,
      });
      const { gameId, state } = await service.startUnoGame('123456');
      state.phase = UnoPhase.FINISHED;
      state.matchWinnerId = 'player1';
      state.roundWinnerId = 'player1';
      (service as unknown as { unoNextRoundAt: Map<string, number> })
        .unoNextRoundAt.set(gameId, 0);

      await service.unoTick();

      expect(state.phase).toBe(UnoPhase.FINISHED);
      expect(state.roundNumber).toBe(1);
      expect(state.matchWinnerId).toBe('player1');
    });

    it('awaits final player-state delivery before emitting game over', async () => {
      let releaseState!: () => void;
      const stateDelivered = new Promise<void>((resolve) => {
        releaseState = resolve;
      });
      const order: string[] = [];
      service.onUnoStateChanged = jest.fn(async () => {
        order.push('state-start');
        await stateDelivered;
        order.push('state-complete');
      });
      service.onUnoGameOver = jest.fn(() => {
        order.push('game-over');
      });
      const result = {
        roundWinnerId: 'player1',
        roundWinnerName: 'Alice',
        points: 0,
        scores: { player1: 0, player2: 0 },
        matchOver: true,
        matchWinnerId: 'player1',
        reason: 'single' as const,
      };

      const handling = (service as unknown as {
        handleUnoResult: (
          gameId: string,
          lobbyCode: string,
          action: { ok: boolean; roundResult: typeof result },
        ) => Promise<{ ok: boolean }>;
      }).handleUnoResult('game1', '123456', { ok: true, roundResult: result });
      await Promise.resolve();

      expect(order).toEqual(['state-start']);
      releaseState();
      await handling;
      expect(order).toEqual(['state-start', 'state-complete', 'game-over']);
    });
  });

  describe('photobooth resource limits', () => {
    it('rejects new sessions after the process-wide cap', async () => {
      mockLobbyService.getLobby!.mockResolvedValue({
        ...fakeLobby,
        gameType: GameType.PHOTOBOOTH,
      });
      for (let index = 0; index < PHOTOBOOTH_MAX_ACTIVE_GAMES; index += 1) {
        await service.startPhotoboothGame(String(index).padStart(6, '0'));
      }

      await expect(service.startPhotoboothGame('999999')).rejects.toThrow(
        'Photobooth capacity reached',
      );
    });
  });

  describe('chess game-over persistence', () => {
    // Covers AC-14: Completed chess games are persisted: the GameEntity row is
    // updated on game end with final result, termination reason, PGN, and
    // timestamps. Exercised via the resign path (shortest route to finalize).
    const chessLobby = {
      ...fakeLobby,
      gameType: GameType.CHESS,
      maxPlayers: 2,
      timeControl: null,
      players: [
        { id: 'white1', username: 'White', avatar: '♔', isReady: true, isHost: true, joinedAt: new Date() },
        { id: 'black1', username: 'Black', avatar: '♚', isReady: true, isHost: false, joinedAt: new Date() },
      ],
    };

    it('updates GameEntity with result/termination/pgn/finalFen/finishedAt/winnerId on resign', async () => {
      mockLobbyService.getLobby!.mockResolvedValue(chessLobby);
      const { gameId } = await service.startChessGame('123456');

      mockGameRepo.update!.mockClear();

      const res = await service.chessResign(gameId, 'white1', '123456');
      expect(res.ok).toBe(true);

      expect(mockGameRepo.update).toHaveBeenCalledTimes(1);
      const [updateId, patch] = mockGameRepo.update!.mock.calls[0];
      expect(updateId).toBe(gameId);
      expect(patch).toEqual(
        expect.objectContaining({
          status: GameStatus.FINISHED,
          result: '0-1', // white resigned → black wins
          termination: 'resignation',
          winnerId: 'black1',
          pgn: expect.any(String),
          finalFen: expect.any(String),
          finishedAt: expect.any(Date),
        }),
      );
      // Lobby transitions back to WAITING so players can start another game.
      expect(mockLobbyService.setStatus).toHaveBeenCalledWith(
        '123456',
        LobbyStatus.WAITING,
      );
    });
  });
});

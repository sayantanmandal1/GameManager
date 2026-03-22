import { GameService } from './game.service';
import { GameEntity } from './game.entity';
import { LobbyService } from '../lobby/lobby.service';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import {
  GameType,
  GameStatus,
  LobbyStatus,
  BingoGamePhase,
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
    };

    service = new GameService(
      mockGameRepo as unknown as Repository<GameEntity>,
      mockRedis as unknown as Redis,
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
});

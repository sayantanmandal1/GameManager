import {
  GAME_CONSTANTS,
  BINGO_CONSTANTS,
  AVATARS,
  GAME_EVENTS,
  LOBBY_EVENTS,
  BINGO_EVENTS,
  VOICE_EVENTS,
  AUTH_EVENTS,
  LobbyStatus,
  GameType,
  GameStatus,
  BingoGamePhase,
  BINGO_BOARD_SIZE,
  BINGO_TOTAL_NUMBERS,
} from './index';

describe('Shared Constants', () => {
  describe('GAME_CONSTANTS', () => {
    it('should have correct lobby code length', () => {
      expect(GAME_CONSTANTS.LOBBY_CODE_LENGTH).toBe(6);
    });

    it('should have correct default max players', () => {
      expect(GAME_CONSTANTS.DEFAULT_MAX_PLAYERS).toBe(8);
    });

    it('should have min 2 players', () => {
      expect(GAME_CONSTANTS.MIN_PLAYERS).toBe(2);
    });

    it('should have lobby TTL of 900 seconds', () => {
      expect(GAME_CONSTANTS.LOBBY_TTL_SECONDS).toBe(900);
    });
  });

  describe('BINGO_CONSTANTS', () => {
    it('should have 5x5 board', () => {
      expect(BINGO_CONSTANTS.BOARD_SIZE).toBe(5);
    });

    it('should have 25 numbers', () => {
      expect(BINGO_CONSTANTS.TOTAL_NUMBERS).toBe(25);
    });

    it('should require 5 lines to win', () => {
      expect(BINGO_CONSTANTS.LINES_TO_WIN).toBe(5);
    });
  });

  describe('AVATARS', () => {
    it('should have 16 avatars', () => {
      expect(AVATARS).toHaveLength(16);
    });

    it('should contain only emoji strings', () => {
      AVATARS.forEach((avatar) => {
        expect(typeof avatar).toBe('string');
        expect(avatar.length).toBeGreaterThan(0);
      });
    });
  });

  describe('BINGO types', () => {
    it('should have correct board size constant', () => {
      expect(BINGO_BOARD_SIZE).toBe(5);
    });

    it('should have correct total numbers constant', () => {
      expect(BINGO_TOTAL_NUMBERS).toBe(25);
    });

    it('should export BingoGamePhase enum values', () => {
      expect(BingoGamePhase.SETUP).toBe('setup');
      expect(BingoGamePhase.PLAYING).toBe('playing');
      expect(BingoGamePhase.FINISHED).toBe('finished');
    });
  });
});

describe('Shared Enums', () => {
  describe('LobbyStatus', () => {
    it('should have correct values', () => {
      expect(LobbyStatus.WAITING).toBe('waiting');
      expect(LobbyStatus.IN_PROGRESS).toBe('in_progress');
      expect(LobbyStatus.FINISHED).toBe('finished');
    });
  });

  describe('GameType', () => {
    it('should have BINGO type', () => {
      expect(GameType.BINGO).toBe('bingo');
    });
  });

  describe('GameStatus', () => {
    it('should have correct values', () => {
      expect(GameStatus.WAITING).toBe('waiting');
      expect(GameStatus.IN_PROGRESS).toBe('in_progress');
      expect(GameStatus.FINISHED).toBe('finished');
    });
  });
});

describe('Event Constants', () => {
  describe('LOBBY_EVENTS', () => {
    it('should have all required events', () => {
      expect(LOBBY_EVENTS.CREATE).toBeDefined();
      expect(LOBBY_EVENTS.JOIN).toBeDefined();
      expect(LOBBY_EVENTS.LEAVE).toBeDefined();
      expect(LOBBY_EVENTS.PLAYER_READY).toBeDefined();
      expect(LOBBY_EVENTS.STATE).toBeDefined();
      expect(LOBBY_EVENTS.ERROR).toBeDefined();
      expect(LOBBY_EVENTS.START_GAME).toBeDefined();
      expect(LOBBY_EVENTS.GAME_STARTING).toBeDefined();
      expect(LOBBY_EVENTS.CHAT_MESSAGE).toBeDefined();
    });

    it('should have correct prefix pattern', () => {
      Object.values(LOBBY_EVENTS).forEach((event) => {
        expect(event).toMatch(/^lobby:/);
      });
    });
  });

  describe('GAME_EVENTS', () => {
    it('should have all required events', () => {
      expect(GAME_EVENTS.STATE).toBeDefined();
      expect(GAME_EVENTS.RESULT).toBeDefined();
      expect(GAME_EVENTS.ERROR).toBeDefined();
      expect(GAME_EVENTS.REQUEST_STATE).toBeDefined();
    });

    it('should have correct prefix', () => {
      Object.values(GAME_EVENTS).forEach((event) => {
        expect(event).toMatch(/^game:/);
      });
    });
  });

  describe('BINGO_EVENTS', () => {
    it('should have all required events', () => {
      expect(BINGO_EVENTS.PLACE_NUMBER).toBeDefined();
      expect(BINGO_EVENTS.CHOOSE_NUMBER).toBeDefined();
      expect(BINGO_EVENTS.RANDOMIZE_BOARD).toBeDefined();
    });

    it('should have correct prefix', () => {
      Object.values(BINGO_EVENTS).forEach((event) => {
        expect(event).toMatch(/^bingo:/);
      });
    });
  });

  describe('VOICE_EVENTS', () => {
    it('should have all required events', () => {
      expect(VOICE_EVENTS.JOIN).toBeDefined();
      expect(VOICE_EVENTS.LEAVE).toBeDefined();
      expect(VOICE_EVENTS.OFFER).toBeDefined();
      expect(VOICE_EVENTS.ANSWER).toBeDefined();
      expect(VOICE_EVENTS.ICE_CANDIDATE).toBeDefined();
    });

    it('should have correct prefix', () => {
      Object.values(VOICE_EVENTS).forEach((event) => {
        expect(event).toMatch(/^voice:/);
      });
    });
  });

  describe('AUTH_EVENTS', () => {
    it('should have all required events', () => {
      expect(AUTH_EVENTS.AUTHENTICATE).toBeDefined();
      expect(AUTH_EVENTS.AUTHENTICATED).toBeDefined();
      expect(AUTH_EVENTS.ERROR).toBeDefined();
    });

    it('should have correct prefix', () => {
      Object.values(AUTH_EVENTS).forEach((event) => {
        expect(event).toMatch(/^auth:/);
      });
    });
  });
});

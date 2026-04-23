import {
  GAME_CONSTANTS,
  BINGO_CONSTANTS,
  AVATARS,
  GAME_EVENTS,
  LOBBY_EVENTS,
  BINGO_EVENTS,
  CHESS_EVENTS,
  VOICE_EVENTS,
  AUTH_EVENTS,
  LobbyStatus,
  GameType,
  GameStatus,
  BingoGamePhase,
  BINGO_BOARD_SIZE,
  BINGO_TOTAL_NUMBERS,
  CHESS_SPECTATOR_CAP,
  CHESS_MOVE_RATE_CAPACITY,
  CHESS_MOVE_RATE_REFILL_PER_SEC,
} from './index';
import type {
  TimeControl,
  ChessClocks,
  ChessMove,
  ChessPlayerView,
  ChessTermination,
} from './index';

describe('Frontend Shared Constants', () => {
  describe('GAME_CONSTANTS', () => {
    it('should have lobby code length of 6', () => {
      expect(GAME_CONSTANTS.LOBBY_CODE_LENGTH).toBe(6);
    });

    it('should have default max players of 8', () => {
      expect(GAME_CONSTANTS.DEFAULT_MAX_PLAYERS).toBe(8);
    });

    it('should require minimum 2 players', () => {
      expect(GAME_CONSTANTS.MIN_PLAYERS).toBe(2);
    });

    it('should have lobby TTL of 900 seconds', () => {
      expect(GAME_CONSTANTS.LOBBY_TTL_SECONDS).toBe(900);
    });
  });

  describe('BINGO_CONSTANTS', () => {
    it('should have 5x5 board size', () => {
      expect(BINGO_CONSTANTS.BOARD_SIZE).toBe(5);
    });

    it('should have 25 total numbers', () => {
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

    it('should contain non-empty strings', () => {
      AVATARS.forEach((avatar) => {
        expect(typeof avatar).toBe('string');
        expect(avatar.length).toBeGreaterThan(0);
      });
    });
  });

  describe('BINGO_BOARD_SIZE and BINGO_TOTAL_NUMBERS', () => {
    it('should export board size as 5', () => {
      expect(BINGO_BOARD_SIZE).toBe(5);
    });

    it('should export total numbers as 25', () => {
      expect(BINGO_TOTAL_NUMBERS).toBe(25);
    });

    it('should satisfy board_size^2 = total_numbers', () => {
      expect(BINGO_BOARD_SIZE * BINGO_BOARD_SIZE).toBe(BINGO_TOTAL_NUMBERS);
    });
  });
});

describe('Frontend Shared Enums', () => {
  describe('BingoGamePhase', () => {
    it('should have SETUP, PLAYING, FINISHED', () => {
      expect(BingoGamePhase.SETUP).toBe('setup');
      expect(BingoGamePhase.PLAYING).toBe('playing');
      expect(BingoGamePhase.FINISHED).toBe('finished');
    });
  });

  describe('LobbyStatus', () => {
    it('should have WAITING, IN_PROGRESS, FINISHED', () => {
      expect(LobbyStatus.WAITING).toBe('waiting');
      expect(LobbyStatus.IN_PROGRESS).toBe('in_progress');
      expect(LobbyStatus.FINISHED).toBe('finished');
    });
  });

  describe('GameType', () => {
    it('should have BINGO', () => {
      expect(GameType.BINGO).toBe('bingo');
    });

    it('should have LUDO', () => {
      expect(GameType.LUDO).toBe('ludo');
    });

    it('should have CHESS', () => {
      expect(GameType.CHESS).toBe('chess');
    });
  });

  describe('GameStatus', () => {
    it('should have WAITING, IN_PROGRESS, FINISHED', () => {
      expect(GameStatus.WAITING).toBe('waiting');
      expect(GameStatus.IN_PROGRESS).toBe('in_progress');
      expect(GameStatus.FINISHED).toBe('finished');
    });
  });
});

describe('Frontend Event Constants', () => {
  describe('LOBBY_EVENTS', () => {
    it('should have all events with lobby: prefix', () => {
      Object.values(LOBBY_EVENTS).forEach((event) => {
        expect(event).toMatch(/^lobby:/);
      });
    });

    it('should include CHAT_MESSAGE event', () => {
      expect(LOBBY_EVENTS.CHAT_MESSAGE).toBe('lobby:chat_message');
    });

    it('should include GAME_STARTING event', () => {
      expect(LOBBY_EVENTS.GAME_STARTING).toBe('lobby:game_starting');
    });
  });

  describe('GAME_EVENTS', () => {
    it('should have all events with game: prefix', () => {
      Object.values(GAME_EVENTS).forEach((event) => {
        expect(event).toMatch(/^game:/);
      });
    });

    it('should include REQUEST_STATE event', () => {
      expect(GAME_EVENTS.REQUEST_STATE).toBe('game:request_state');
    });
  });

  describe('BINGO_EVENTS', () => {
    it('should have all events with bingo: prefix', () => {
      Object.values(BINGO_EVENTS).forEach((event) => {
        expect(event).toMatch(/^bingo:/);
      });
    });

    it('should include RANDOMIZE_BOARD event', () => {
      expect(BINGO_EVENTS.RANDOMIZE_BOARD).toBe('bingo:randomize_board');
    });
  });

  describe('VOICE_EVENTS', () => {
    it('should have all events with voice: prefix', () => {
      Object.values(VOICE_EVENTS).forEach((event) => {
        expect(event).toMatch(/^voice:/);
      });
    });
  });

  describe('AUTH_EVENTS', () => {
    it('should have all events with auth: prefix', () => {
      Object.values(AUTH_EVENTS).forEach((event) => {
        expect(event).toMatch(/^auth:/);
      });
    });
  });
});

describe('Frontend Chess Parity', () => {
  it('exports CHESS_EVENTS with the expected client/server names', () => {
    expect(CHESS_EVENTS.MOVE).toBe('chess:move');
    expect(CHESS_EVENTS.RESIGN).toBe('chess:resign');
    expect(CHESS_EVENTS.DRAW_OFFER).toBe('chess:draw_offer');
    expect(CHESS_EVENTS.DRAW_RESPONSE).toBe('chess:draw_response');
    expect(CHESS_EVENTS.REJOIN).toBe('chess:rejoin');
    expect(CHESS_EVENTS.SPECTATE).toBe('chess:spectate');
    expect(CHESS_EVENTS.STATE).toBe('chess:state');
    expect(CHESS_EVENTS.MOVE_APPLIED).toBe('chess:move_applied');
    expect(CHESS_EVENTS.MOVE_REJECTED).toBe('chess:move_rejected');
    expect(CHESS_EVENTS.CLOCK_TICK).toBe('chess:clock_tick');
    expect(CHESS_EVENTS.DRAW_DECLINED).toBe('chess:draw_declined');
    expect(CHESS_EVENTS.GAME_OVER).toBe('chess:game_over');
  });

  it('has all chess events with the chess: prefix', () => {
    Object.values(CHESS_EVENTS).forEach((ev) => {
      expect(ev).toMatch(/^chess:/);
    });
  });

  it('exports the spectator cap and rate-limit constants', () => {
    expect(CHESS_SPECTATOR_CAP).toBe(50);
    expect(CHESS_MOVE_RATE_CAPACITY).toBe(10);
    expect(CHESS_MOVE_RATE_REFILL_PER_SEC).toBe(10);
  });

  it('chess types are importable from the shared barrel', () => {
    // Pure type-level import smoke test — body uses literals that must
    // structurally satisfy the types.
    const tc: TimeControl = { baseMs: 300_000, incrementMs: 0 };
    const clocks: ChessClocks = { whiteMs: 1, blackMs: 1, lastTickAt: 1 };
    const move: ChessMove = {
      from: 'e2',
      to: 'e4',
      promotion: null,
      san: 'e4',
      color: 'w',
      captured: null,
    };
    const term: ChessTermination = 'checkmate';
    const view: ChessPlayerView = {
      gameId: 'g',
      lobbyCode: '123456',
      role: 'white',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      turn: 'w',
      history: [move],
      clocks,
      timeControl: tc,
      whitePlayerId: 'u1',
      blackPlayerId: 'u2',
      whiteName: 'w',
      blackName: 'b',
      status: 'in_progress',
      drawOffer: null,
      result: null,
      termination: null,
      spectatorCount: 0,
    };
    expect(view.clocks.whiteMs).toBe(1);
    expect(term).toBe('checkmate');
  });
});

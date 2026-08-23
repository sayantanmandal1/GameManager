import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { ChessMoveDto, ChessResignDto, ChessRejoinDto } from './dto/chess.dto';
import { PhotoboothCaptureDto } from './dto/photobooth.dto';
import { UnoColorChoiceDto } from './dto/uno.dto';
import { DistinctGameActionDto } from './dto/distinct-game.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CHESS_EVENTS, GAME_EVENTS, LUDO_EVENTS, UNO_EVENTS } from '../shared';

// ─── DTO-level validation tests (exercise the actual validators the
// ValidationPipe uses at runtime). Gateway-level rate-limit + auth tests
// instantiate the gateway directly with mocks.

describe('chess DTOs — class-validator', () => {
  it('accepts a well-formed ChessMoveDto', async () => {
    const dto = plainToInstance(ChessMoveDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      from: 'e2',
      to: 'e4',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid square', async () => {
    const dto = plainToInstance(ChessMoveDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      from: 'e9',
      to: 'e4',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid promotion piece', async () => {
    const dto = plainToInstance(ChessMoveDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      from: 'a7',
      to: 'a8',
      promotion: 'k',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-numeric lobby code', async () => {
    const dto = plainToInstance(ChessMoveDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: 'abcdef',
      from: 'e2',
      to: 'e4',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-uuid gameId', async () => {
    const dto = plainToInstance(ChessResignDto, {
      gameId: 'not-a-uuid',
      lobbyCode: '123456',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a well-formed ChessRejoinDto', async () => {
    const dto = plainToInstance(ChessRejoinDto, { lobbyCode: '123456' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('distinct game DTOs - class-validator', () => {
  it('accepts a bounded game action', async () => {
    const dto = plainToInstance(DistinctGameActionDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      action: { cell: 19 },
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a client-supplied Pig die value', async () => {
    const dto = plainToInstance(DistinctGameActionDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      action: { type: 'roll', value: 6 },
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a bounded nested Grid Salvo fleet', async () => {
    const dto = plainToInstance(DistinctGameActionDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      action: {
        type: 'place_fleet',
        ships: [
          { start: 0, end: 4 },
          { start: 10, end: 13 },
          { start: 20, end: 22 },
          { start: 30, end: 32 },
          { start: 40, end: 41 },
        ],
      },
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });

  it('rejects oversized fleet, dice, and tile arrays', async () => {
    const actions = [
      { type: 'place_fleet', ships: Array.from({ length: 6 }, () => ({ start: 0, end: 1 })) },
      { type: 'select_dice', indices: [0, 1, 2, 3, 4, 5, 5] },
      { type: 'close_tiles', tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 9] },
    ];

    for (const action of actions) {
      const dto = plainToInstance(DistinctGameActionDto, {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        action,
      });
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects overlong or non-letter Hangman phrases', async () => {
    for (const phrase of ['A'.repeat(41), 'SAFE PHRASE 2']) {
      const dto = plainToInstance(DistinctGameActionDto, {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        action: { type: 'set_phrase', phrase },
      });
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects client-controlled random results for every dice game', async () => {
    for (const action of [
      { type: 'roll_dice', heldIndices: [], dice: [6, 6, 6, 6, 6] },
      { type: 'roll_farkle', dice: [1, 1, 1, 1, 1, 1] },
      { type: 'roll_box', roll: [6, 6] },
      { type: 'roll_ceelo', dice: [4, 5, 6] },
    ]) {
      const dto = plainToInstance(DistinctGameActionDto, {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        action,
      });
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('accepts bounded actions for the expanded games', async () => {
    const actions = [
      { type: 'pass_cards', cardIds: ['c-clubs-A', 'c-hearts-2', 'c-spades-Q'] },
      { type: 'bid_spades', bid: 13 },
      { type: 'gin_discard', cardId: 'c-diamonds-10', knock: true },
      { type: 'draw_from_player', handIndex: 50 },
      { type: 'place_hex', cell: 120 },
      { type: 'place_stone', node: 23 },
      { type: 'answer_trivia', answerIndex: 3 },
      { type: 'reveal_tile', tileIndex: 23 },
    ];

    for (const action of actions) {
      const dto = plainToInstance(DistinctGameActionDto, {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        action,
      });
      await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);
    }
  });

  it('rejects out-of-range expanded-game fields and malformed card arrays', async () => {
    const actions = [
      { type: 'pass_cards', cardIds: ['c-clubs-A', 'invalid card'] },
      { type: 'bid_spades', bid: 14 },
      { type: 'draw_from_player', handIndex: 51 },
      { type: 'place_hex', cell: 121 },
      { type: 'place_stone', node: 24 },
      { type: 'answer_trivia', answerIndex: 4 },
      { type: 'reveal_tile', tileIndex: 24 },
    ];

    for (const action of actions) {
      const dto = plainToInstance(DistinctGameActionDto, {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        action,
      });
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});

describe('UNO DTOs - class-validator', () => {
  it('accepts a bounded light-side roulette color', async () => {
    const dto = plainToInstance(UnoColorChoiceDto, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      chosenColor: 'red',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects dark-side and forged roulette colors', async () => {
    for (const chosenColor of ['purple', 'chartreuse']) {
      const dto = plainToInstance(UnoColorChoiceDto, {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        chosenColor,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});

// ─── Gateway-level tests (auth + rate limiting) ───────────────────────────

interface MockSocket {
  id: string;
  data: { user?: { sub: string; username: string } };
  emit: jest.Mock;
  join: jest.Mock;
  handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
}

function mkSocket(user?: { sub: string; username: string }): MockSocket {
  return {
    id: 'sock-' + Math.random().toString(16).slice(2),
    data: user ? { user } : {},
    emit: jest.fn(),
    join: jest.fn(),
    handshake: { auth: {}, headers: {} },
  };
}

describe('GameGateway handlers', () => {
  let gateway: GameGateway;
  let gameService: jest.Mocked<Partial<GameService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let roomEmit: jest.Mock;

  beforeEach(() => {
    gameService = {
      applyChessMove: jest.fn().mockResolvedValue({ ok: true }),
      chessResign: jest.fn().mockResolvedValue({ ok: true }),
      chessDrawOffer: jest.fn().mockResolvedValue({ ok: true }),
      chessDrawResponse: jest.fn().mockResolvedValue({ ok: true }),
      chessRejoin: jest.fn(),
      chessSpectate: jest.fn(),
      chessRemoveSpectator: jest.fn(),
      photoboothCapture: jest.fn().mockReturnValue({ ok: true }),
      getGameIdForLobby: jest.fn().mockReturnValue('game-1'),
      ludoRollDice: jest.fn().mockReturnValue({
        ok: true,
        dice: 4,
        turnSkipped: true,
        turnCanceled: false,
      }),
      unoChooseOpeningColor: jest.fn().mockResolvedValue({ ok: true }),
    };
    jwtService = {
      verify: jest.fn(),
    };
    gateway = new GameGateway(
      gameService as unknown as GameService,
      jwtService as unknown as JwtService,
    );
    roomEmit = jest.fn();
    (gateway as unknown as { server: unknown }).server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    };
  });

  it('broadcasts every accepted Ludo roll even when the turn is skipped', () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });

    gateway.handleLudoRollDice(sock as never, {
      gameId: 'game-1',
      lobbyCode: '123456',
    });

    expect(gameService.ludoRollDice).toHaveBeenCalledWith('game-1', 'user1', '123456');
    expect(roomEmit).toHaveBeenCalledWith(LUDO_EVENTS.DICE_ROLLED, {
      gameId: 'game-1',
      playerId: 'user1',
      dice: 4,
      turnSkipped: true,
      turnCanceled: false,
    });
  });

  it('rejects a Ludo roll when the game does not belong to the lobby', () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    (gameService.getGameIdForLobby as jest.Mock).mockReturnValue('another-game');

    gateway.handleLudoRollDice(sock as never, {
      gameId: 'game-1',
      lobbyCode: '123456',
    });

    expect(gameService.ludoRollDice).not.toHaveBeenCalled();
    expect(roomEmit).not.toHaveBeenCalled();
    expect(sock.emit).toHaveBeenCalledWith(GAME_EVENTS.ERROR, {
      message: 'Game does not belong to this lobby',
    });
  });

  it('silently drops chess:move without auth (no emit, no service call)', async () => {
    const sock = mkSocket();
    await gateway.handleChessMove(
      sock as never,
      {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        from: 'e2',
        to: 'e4',
      } as ChessMoveDto,
    );
    expect(gameService.applyChessMove).not.toHaveBeenCalled();
  });

  it('forwards a valid chess:move to GameService.applyChessMove', async () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    await gateway.handleChessMove(
      sock as never,
      {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
        from: 'e2',
        to: 'e4',
      } as ChessMoveDto,
    );
    expect(gameService.applyChessMove).toHaveBeenCalledTimes(1);
  });

  it('forwards an authenticated UNO Flip opening color choice', async () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    await gateway.handleUnoChooseOpeningColor(sock as never, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      chosenColor: 'blue',
    });

    expect(gameService.unoChooseOpeningColor).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      'user1',
      'blue',
      '123456',
    );
    expect(sock.emit).not.toHaveBeenCalledWith(UNO_EVENTS.ERROR, expect.anything());
  });

  it('emits an UNO error when an opening color choice is rejected', async () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    (gameService.unoChooseOpeningColor as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'No opening colour to choose',
    });

    await gateway.handleUnoChooseOpeningColor(sock as never, {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      chosenColor: 'blue',
    });

    expect(sock.emit).toHaveBeenCalledWith(UNO_EVENTS.ERROR, {
      message: 'No opening colour to choose',
    });
  });

  it('emits chess:move_rejected with code=rate_limited after bucket exhaustion', async () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    const dto = {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      from: 'e2',
      to: 'e4',
    } as ChessMoveDto;
    // Capacity is 10 — the 11th burst within the same tick should be throttled.
    for (let i = 0; i < 11; i++) {
      await gateway.handleChessMove(sock as never, dto);
    }
    const rejections = sock.emit.mock.calls.filter(
      (c) => c[0] === CHESS_EVENTS.MOVE_REJECTED && c[1]?.code === 'rate_limited',
    );
    expect(rejections.length).toBeGreaterThanOrEqual(1);
  });

  it('forwards a valid chess:resign to GameService.chessResign', async () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    await gateway.handleChessResign(
      sock as never,
      {
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        lobbyCode: '123456',
      } as ChessResignDto,
    );
    expect(gameService.chessResign).toHaveBeenCalledTimes(1);
  });

  it('rate-limits repeated photobooth capture payloads per socket', async () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    const dto = {
      gameId: '123e4567-e89b-12d3-a456-426614174000',
      lobbyCode: '123456',
      image: 'data:image/png;base64,AAAA',
    } as PhotoboothCaptureDto;

    for (let index = 0; index < 5; index += 1) {
      await gateway.handlePhotoboothCapture(sock as never, dto);
    }

    expect(gameService.photoboothCapture).toHaveBeenCalledTimes(4);
    expect(sock.emit).toHaveBeenCalledWith(GAME_EVENTS.ERROR, {
      message: 'Capture rate limit exceeded',
    });
  });

  it('drops chess:rejoin without auth', () => {
    const sock = mkSocket();
    gateway.handleChessRejoin(sock as never, { lobbyCode: '123456' } as ChessRejoinDto);
    expect(gameService.chessRejoin).not.toHaveBeenCalled();
  });

  it('emits chess:state on successful rejoin', () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    (gameService.chessRejoin as jest.Mock).mockReturnValue({
      ok: true,
      gameId: 'gid',
      view: { role: 'white' },
    });
    gateway.handleChessRejoin(sock as never, { lobbyCode: '123456' } as ChessRejoinDto);
    expect(sock.join).toHaveBeenCalledWith('game:123456');
    expect(sock.emit).toHaveBeenCalledWith(
      CHESS_EVENTS.STATE,
      expect.objectContaining({ gameId: 'gid', role: 'white' }),
    );
  });

  it('emits chess:move_rejected with code=game_not_active when rejoin fails', () => {
    const sock = mkSocket({ sub: 'user1', username: 'A' });
    (gameService.chessRejoin as jest.Mock).mockReturnValue({
      ok: false,
      errorCode: 'no_active_game',
    });
    gateway.handleChessRejoin(sock as never, { lobbyCode: '123456' } as ChessRejoinDto);
    const rejected = sock.emit.mock.calls.find(
      (c) => c[0] === CHESS_EVENTS.MOVE_REJECTED,
    );
    expect(rejected).toBeDefined();
  });
});

import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { ChessMoveDto, ChessResignDto, ChessRejoinDto } from './dto/chess.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CHESS_EVENTS } from '../shared';

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

describe('GameGateway — chess handlers', () => {
  let gateway: GameGateway;
  let gameService: jest.Mocked<Partial<GameService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(() => {
    gameService = {
      applyChessMove: jest.fn().mockResolvedValue({ ok: true }),
      chessResign: jest.fn().mockResolvedValue({ ok: true }),
      chessDrawOffer: jest.fn().mockResolvedValue({ ok: true }),
      chessDrawResponse: jest.fn().mockResolvedValue({ ok: true }),
      chessRejoin: jest.fn(),
      chessSpectate: jest.fn(),
      chessRemoveSpectator: jest.fn(),
    };
    jwtService = {
      verify: jest.fn(),
    };
    gateway = new GameGateway(
      gameService as unknown as GameService,
      jwtService as unknown as JwtService,
    );
    // Stub @WebSocketServer for emit helpers (not exercised here).
    (gateway as unknown as { server: unknown }).server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    };
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

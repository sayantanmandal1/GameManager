import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { CACHE_CLIENT, CacheClient } from '../cache/cache.module';
import { LobbyEntity } from './lobby.entity';
import { UserService } from '../user/user.service';
import {
  Lobby,
  LobbyPlayer,
  LobbyStatus,
  GameType,
  GAME_CONSTANTS,
  TimeControl,
  UnoRules,
  UnoMode,
  UNO_MODES,
  UNO_CONSTANTS,
  TicTacToeMode,
  DistinctGameKey,
  LobbyTeam,
  isPartnershipGameKey,
} from '../shared';
import { GameRegistry } from '../game/game-registry';

@Injectable()
export class LobbyService {
  private readonly lobbyTtl: number;

  constructor(
    @InjectRepository(LobbyEntity)
    private readonly lobbyRepo: Repository<LobbyEntity>,
    @Inject(CACHE_CLIENT) private readonly redis: CacheClient,
    private readonly userService: UserService,
    private readonly config: ConfigService,
    private readonly gameRegistry: GameRegistry = new GameRegistry(),
  ) {
    this.lobbyTtl = this.config.get<number>(
      'LOBBY_TTL_SECONDS',
      GAME_CONSTANTS.LOBBY_TTL_SECONDS,
    );
  }

  async createLobby(
    hostId: string,
    gameType: GameType,
    maxPlayers?: number,
    timeControl?: TimeControl | null,
    unoRules?: UnoRules | null,
    tictactoeMode?: TicTacToeMode | null,
    gameKey?: DistinctGameKey | null,
  ): Promise<Lobby> {
    const host = await this.userService.findById(hostId);
    if (!host) throw new Error('User not found');

    if (!Object.values(GameType).includes(gameType)) {
      throw new Error('invalid_game_type');
    }
    const distinctAdapter =
      gameType === GameType.DISTINCT
        ? this.gameRegistry.getDistinctGame(gameKey ?? '')
        : null;
    if (gameType !== GameType.DISTINCT && gameKey != null) {
      throw new Error('mismatched_game_key');
    }

    const code = this.generateCode();
    // Chess and Photobooth are strictly 2-player; UNO is 2–4; ignore bogus
    // client overrides in every case.
    let requestedMax: number;
    if (distinctAdapter) {
      requestedMax = distinctAdapter.maxPlayers;
    } else if (
      gameType === GameType.CHESS ||
      gameType === GameType.PHOTOBOOTH ||
      gameType === GameType.TICTACTOE ||
      gameType === GameType.CONNECTFOUR
    ) {
      requestedMax = 2;
    } else if (gameType === GameType.UNO) {
      requestedMax = Math.min(
        Math.max(maxPlayers || UNO_CONSTANTS.MAX_PLAYERS, UNO_CONSTANTS.MIN_PLAYERS),
        UNO_CONSTANTS.MAX_PLAYERS,
      );
    } else if (gameType === GameType.LUDO) {
      requestedMax = Math.min(maxPlayers || 4, 4);
    } else {
      requestedMax = Math.min(
        maxPlayers || GAME_CONSTANTS.DEFAULT_MAX_PLAYERS,
        GAME_CONSTANTS.DEFAULT_MAX_PLAYERS,
      );
    }

    // SECURITY_NOTE: validate timeControl shape server-side; only honor it
    // for chess lobbies (design §9, security). Reject bogus values.
    const tc =
      gameType === GameType.CHESS
        ? LobbyService.validateTimeControl(timeControl ?? null)
        : null;
    // SECURITY_NOTE: validate UNO rules against an allow-list (target score,
    // boolean stacking) so a crafted payload can't smuggle arbitrary config.
    const uno =
      gameType === GameType.UNO
        ? LobbyService.validateUnoRules(unoRules ?? null)
        : null;
    const tttMode =
      gameType === GameType.TICTACTOE
        ? LobbyService.validateTicTacToeMode(tictactoeMode)
        : null;

    const hostPlayer: LobbyPlayer = {
      id: host.id,
      username: host.username,
      avatar: host.avatar,
      isReady: false,
      isHost: true,
      team: null,
      joinedAt: new Date(),
    };

    const lobby: Lobby = {
      id: crypto.randomUUID(),
      code,
      hostId,
      gameType,
      players: [hostPlayer],
      status: LobbyStatus.WAITING,
      maxPlayers: requestedMax,
      createdAt: new Date(),
      timeControl: tc,
      unoRules: uno,
      tictactoeMode: tttMode,
      gameKey: distinctAdapter?.key ?? null,
    };

    // Persist to DB
    const entity = this.lobbyRepo.create({
      id: lobby.id,
      code: lobby.code,
      hostId: lobby.hostId,
      gameType: lobby.gameType,
      playerIds: [hostId],
      status: lobby.status,
      maxPlayers: lobby.maxPlayers,
      timeControl: tc,
      tictactoeMode: tttMode,
      gameKey: distinctAdapter?.key ?? null,
    });
    await this.lobbyRepo.save(entity);

    // Cache in memory
    await this.saveLobby(lobby);

    return lobby;
  }

  /**
   * Validate a client-supplied TimeControl. Returns a clean object or null.
   * Rejects negative/non-integer/non-finite values to prevent clock abuse.
   */
  static validateTimeControl(raw: TimeControl | null | undefined): TimeControl | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'object') {
      throw new TypeError('invalid_time_control');
    }
    const { baseMs, incrementMs } = raw as TimeControl;
    if (
      !Number.isInteger(baseMs) ||
      !Number.isInteger(incrementMs) ||
      baseMs < 0 ||
      incrementMs < 0 ||
      baseMs > 7 * 24 * 60 * 60 * 1000 ||
      incrementMs > 60 * 60 * 1000
    ) {
      throw new Error('invalid_time_control');
    }
    return { baseMs, incrementMs };
  }

  static validateTicTacToeMode(raw: TicTacToeMode | null | undefined): TicTacToeMode {
    if (raw === null || raw === undefined) return TicTacToeMode.CLASSIC;
    if (!Object.values(TicTacToeMode).includes(raw)) {
      throw new Error('invalid_tictactoe_mode');
    }
    return raw;
  }

  /**
   * Validate client-supplied UNO rules. Only Custom mode exposes house-rule
   * toggles; Classic runs pure official rules, and No Mercy / Flip apply their
   * own fixed rule-sets in the engine. Target score is allow-listed.
   */
  static validateUnoRules(raw: UnoRules | null | undefined): UnoRules {
    const mode: UnoMode = UNO_MODES.includes(raw?.mode as UnoMode)
      ? (raw!.mode as UnoMode)
      : 'classic';
    const target = raw?.targetScore ?? null;
    if (
      target !== null &&
      (!Number.isInteger(target) || !UNO_CONSTANTS.TARGET_SCORES.includes(target))
    ) {
      throw new Error('invalid_uno_rules');
    }
    const custom = mode === 'custom';
    const on = (v: unknown) => custom && v === true;
    return {
      mode,
      targetScore: mode === 'noMercy' ? null : target,
      stacking: on(raw?.stacking),
      drawToMatch: on(raw?.drawToMatch),
      jumpIn: on(raw?.jumpIn),
      sevenZero: on(raw?.sevenZero),
      forcePlay: on(raw?.forcePlay),
      noBluffing: on(raw?.noBluffing),
    };
  }

  async getLobby(code: string): Promise<Lobby | null> {
    const data = await this.redis.get(`lobby:${code}`);
    if (data) return JSON.parse(data) as Lobby;
    return null;
  }

  async joinLobby(code: string, userId: string): Promise<Lobby> {
    const lobby = await this.getLobby(code);
    if (!lobby) throw new Error('Lobby not found');

    // If player is already in the lobby, return current state (handles reconnect/rejoin)
    if (lobby.players.some((p) => p.id === userId)) return lobby;

    if (lobby.status !== LobbyStatus.WAITING)
      throw new Error('Game already in progress');
    if (lobby.players.length >= lobby.maxPlayers)
      throw new Error('Lobby is full');

    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    const player: LobbyPlayer = {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      isReady: false,
      isHost: false,
      team: null,
      joinedAt: new Date(),
    };

    lobby.players.push(player);
    await this.saveLobby(lobby);

    // Update DB
    await this.lobbyRepo.update(
      { code },
      { playerIds: lobby.players.map((p) => p.id) },
    );

    return lobby;
  }

  async leaveLobby(code: string, userId: string): Promise<Lobby | null> {
    const lobby = await this.getLobby(code);
    if (!lobby) return null;

    lobby.players = lobby.players.filter((p) => p.id !== userId);

    if (lobby.players.length === 0) {
      await this.redis.del(`lobby:${code}`);
      await this.lobbyRepo.update({ code }, { status: LobbyStatus.FINISHED });
      return null;
    }

    // Transfer host if the host left
    if (lobby.hostId === userId) {
      lobby.hostId = lobby.players[0].id;
      lobby.players[0].isHost = true;
    }

    await this.saveLobby(lobby);
    await this.lobbyRepo.update(
      { code },
      {
        playerIds: lobby.players.map((p) => p.id),
        hostId: lobby.hostId,
      },
    );

    return lobby;
  }

  async removePlayer(
    code: string,
    hostId: string,
    targetUserId: string,
  ): Promise<Lobby> {
    const lobby = await this.getLobby(code);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.hostId !== hostId) throw new Error('Only the host can remove players');
    if (lobby.status !== LobbyStatus.WAITING) {
      throw new Error('Players cannot be removed after the game starts');
    }
    if (targetUserId === hostId) throw new Error('The host cannot remove themselves');
    if (!lobby.players.some((player) => player.id === targetUserId)) {
      throw new Error('Player not found');
    }

    lobby.players = lobby.players.filter((player) => player.id !== targetUserId);
    await this.saveLobby(lobby);
    await this.lobbyRepo.update(
      { code },
      { playerIds: lobby.players.map((player) => player.id) },
    );
    return lobby;
  }

  async setReady(
    code: string,
    userId: string,
    ready: boolean,
  ): Promise<Lobby> {
    const lobby = await this.getLobby(code);
    if (!lobby) throw new Error('Lobby not found');

    const player = lobby.players.find((p) => p.id === userId);
    if (!player) throw new Error('Not in lobby');

    player.isReady = ready;
    await this.saveLobby(lobby);
    return lobby;
  }

  async setTeam(code: string, userId: string, team: LobbyTeam): Promise<Lobby> {
    const lobby = await this.getLobby(code);
    if (!lobby) throw new Error('Lobby not found');
    if (!this.isPartnershipLobby(lobby)) throw new Error('Teams are not enabled for this game');
    if (lobby.status !== LobbyStatus.WAITING) throw new Error('Game already in progress');
    if (team !== 0 && team !== 1) throw new Error('Invalid team');

    const player = lobby.players.find((candidate) => candidate.id === userId);
    if (!player) throw new Error('Not in lobby');
    if (player.team === team) return lobby;

    const teamSize = lobby.players.filter((candidate) => candidate.team === team).length;
    if (teamSize >= 2) throw new Error('That team is full');

    player.team = team;
    player.isReady = false;
    await this.saveLobby(lobby);
    return lobby;
  }

  canStartGame(lobby: Lobby, userId: string): { ok: boolean; reason?: string } {
    if (lobby.hostId !== userId)
      return { ok: false, reason: 'Only the host can start the game' };
    const minimumPlayers =
      lobby.gameType === GameType.DISTINCT && lobby.gameKey
        ? this.gameRegistry.getDistinctGame(lobby.gameKey).minPlayers
        : GAME_CONSTANTS.MIN_PLAYERS;
    if (lobby.players.length < minimumPlayers)
      return { ok: false, reason: `Need at least ${minimumPlayers} players` };

    if (this.isPartnershipLobby(lobby)) {
      const teamSizes = [0, 1].map(
        (team) => lobby.players.filter((player) => player.team === team).length,
      );
      if (lobby.players.length !== 4 || teamSizes[0] !== 2 || teamSizes[1] !== 2) {
        return { ok: false, reason: 'Choose two players for each team' };
      }
    }

    const allReady = lobby.players
      .filter((p) => !p.isHost)
      .every((p) => p.isReady);
    if (!allReady)
      return { ok: false, reason: 'Not all players are ready' };

    return { ok: true };
  }

  orderPlayersForGame(lobby: Lobby): LobbyPlayer[] {
    if (!this.isPartnershipLobby(lobby)) return [...lobby.players];
    const team0 = lobby.players.filter((player) => player.team === 0);
    const team1 = lobby.players.filter((player) => player.team === 1);
    if (team0.length !== 2 || team1.length !== 2) {
      throw new Error('invalid_team_selection');
    }
    return [team0[0], team1[0], team0[1], team1[1]];
  }

  async setStatus(code: string, status: LobbyStatus): Promise<void> {
    const lobby = await this.getLobby(code);
    if (!lobby) return;
    lobby.status = status;
    await this.saveLobby(lobby);
    await this.lobbyRepo.update({ code }, { status });
  }

  /** Reset lobby for a new game: set status to WAITING and clear all players' ready flags */
  async resetForNewGame(code: string): Promise<Lobby | null> {
    const lobby = await this.getLobby(code);
    if (!lobby) return null;
    lobby.status = LobbyStatus.WAITING;
    for (const p of lobby.players) {
      p.isReady = false;
    }
    await this.saveLobby(lobby);
    await this.lobbyRepo.update({ code }, { status: LobbyStatus.WAITING });
    return lobby;
  }

  private async saveLobby(lobby: Lobby): Promise<void> {
    await this.redis.set(
      `lobby:${lobby.code}`,
      JSON.stringify(lobby),
      'EX',
      this.lobbyTtl,
    );
  }

  private isPartnershipLobby(lobby: Lobby): boolean {
    return lobby.gameType === GameType.DISTINCT
      && isPartnershipGameKey(lobby.gameKey);
  }

  private generateCode(): string {
    const bytes = crypto.randomBytes(4);
    const num = bytes.readUInt32BE(0) % 1_000_000;
    return num.toString().padStart(GAME_CONSTANTS.LOBBY_CODE_LENGTH, '0');
  }
}

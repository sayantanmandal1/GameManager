import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.module';
import { LobbyEntity } from './lobby.entity';
import { UserService } from '../user/user.service';
import {
  Lobby,
  LobbyPlayer,
  LobbyStatus,
  GameType,
  GAME_CONSTANTS,
} from '../shared';

@Injectable()
export class LobbyService {
  private readonly lobbyTtl: number;

  constructor(
    @InjectRepository(LobbyEntity)
    private readonly lobbyRepo: Repository<LobbyEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly userService: UserService,
    private readonly config: ConfigService,
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
  ): Promise<Lobby> {
    const host = await this.userService.findById(hostId);
    if (!host) throw new Error('User not found');

    const code = this.generateCode();
    const max = Math.min(
      maxPlayers || GAME_CONSTANTS.DEFAULT_MAX_PLAYERS,
      GAME_CONSTANTS.DEFAULT_MAX_PLAYERS,
    );

    const hostPlayer: LobbyPlayer = {
      id: host.id,
      username: host.username,
      avatar: host.avatar,
      isReady: false,
      isHost: true,
      joinedAt: new Date(),
    };

    const lobby: Lobby = {
      id: crypto.randomUUID(),
      code,
      hostId,
      gameType,
      players: [hostPlayer],
      status: LobbyStatus.WAITING,
      maxPlayers: max,
      createdAt: new Date(),
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
    });
    await this.lobbyRepo.save(entity);

    // Cache in Redis
    await this.saveLobby(lobby);

    return lobby;
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

  canStartGame(lobby: Lobby, userId: string): { ok: boolean; reason?: string } {
    if (lobby.hostId !== userId)
      return { ok: false, reason: 'Only the host can start the game' };
    if (lobby.players.length < GAME_CONSTANTS.MIN_PLAYERS)
      return { ok: false, reason: `Need at least ${GAME_CONSTANTS.MIN_PLAYERS} players` };

    const allReady = lobby.players
      .filter((p) => !p.isHost)
      .every((p) => p.isReady);
    if (!allReady)
      return { ok: false, reason: 'Not all players are ready' };

    return { ok: true };
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

  private generateCode(): string {
    const bytes = crypto.randomBytes(4);
    const num = bytes.readUInt32BE(0) % 1_000_000;
    return num.toString().padStart(GAME_CONSTANTS.LOBBY_CODE_LENGTH, '0');
  }
}

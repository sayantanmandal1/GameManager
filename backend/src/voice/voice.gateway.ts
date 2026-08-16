import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { getSocketUser } from '../auth/ws-jwt.guard';
import { VOICE_EVENTS, getCorsOrigins } from '../shared';

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly socketVoiceRoomMap = new Map<string, string>();

  constructor(private readonly jwtService: JwtService) {}

  handleDisconnect(client: Socket): void {
    this.leaveTrackedRoom(client);
  }

  @SubscribeMessage(VOICE_EVENTS.JOIN)
  async handleVoiceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user || !this.isValidRoomId(data?.roomId)) return;

    const voiceRoom = `voice:${data.roomId}`;
    const priorRoom = this.socketVoiceRoomMap.get(client.id);
    if (priorRoom && priorRoom !== voiceRoom) {
      client.leave(priorRoom);
      client.to(priorRoom).emit(VOICE_EVENTS.PEER_LEFT, {
        socketId: client.id,
      });
    }

    // Get existing peers before joining the room
    const sockets = await this.server.in(voiceRoom).fetchSockets();
    const existingPeers = sockets
      .filter((s) => s.id !== client.id)
      .map((s) => ({
        socketId: s.id,
        userId: s.data?.user?.sub,
        username: s.data?.user?.username,
      }));

    client.join(voiceRoom);
  this.socketVoiceRoomMap.set(client.id, voiceRoom);

    // Send existing peers to the new joiner — they will initiate offers
    client.emit(VOICE_EVENTS.PEER_JOINED, {
      peers: existingPeers,
      shouldInitiate: true,
    });

    // Notify existing peers about the new joiner — they should wait for offers
    client.to(voiceRoom).emit(VOICE_EVENTS.PEER_JOINED, {
      peers: [
        {
          socketId: client.id,
          userId: user.sub,
          username: user.username,
        },
      ],
      shouldInitiate: false,
    });
  }

  @SubscribeMessage(VOICE_EVENTS.LEAVE)
  handleVoiceLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: { roomId: string },
  ): void {
    this.leaveTrackedRoom(client);
  }

  @SubscribeMessage(VOICE_EVENTS.OFFER)
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; offer: RTCSessionDescriptionInit },
  ): void {
    if (!getSocketUser(client, this.jwtService) || !this.canSignal(client, data?.targetSocketId)) return;
    this.server.to(data.targetSocketId).emit(VOICE_EVENTS.OFFER, {
      socketId: client.id,
      offer: data.offer,
    });
  }

  @SubscribeMessage(VOICE_EVENTS.ANSWER)
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; answer: RTCSessionDescriptionInit },
  ): void {
    if (!getSocketUser(client, this.jwtService) || !this.canSignal(client, data?.targetSocketId)) return;
    this.server.to(data.targetSocketId).emit(VOICE_EVENTS.ANSWER, {
      socketId: client.id,
      answer: data.answer,
    });
  }

  @SubscribeMessage(VOICE_EVENTS.ICE_CANDIDATE)
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; candidate: RTCIceCandidateInit },
  ): void {
    if (!getSocketUser(client, this.jwtService) || !this.canSignal(client, data?.targetSocketId)) return;
    this.server.to(data.targetSocketId).emit(VOICE_EVENTS.ICE_CANDIDATE, {
      socketId: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage(VOICE_EVENTS.TOGGLE_MUTE)
  handleToggleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isMuted: boolean },
  ): void {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const voiceRoom = this.socketVoiceRoomMap.get(client.id);
    if (!voiceRoom) return;

    client.to(voiceRoom).emit(VOICE_EVENTS.MUTE_STATUS, {
      socketId: client.id,
      userId: user.sub,
      isMuted: data.isMuted === true,
    });
  }

  private leaveTrackedRoom(client: Socket): void {
    const voiceRoom = this.socketVoiceRoomMap.get(client.id);
    if (!voiceRoom) return;

    this.socketVoiceRoomMap.delete(client.id);
    client.to(voiceRoom).emit(VOICE_EVENTS.PEER_LEFT, {
      socketId: client.id,
    });
    client.leave(voiceRoom);
  }

  private canSignal(client: Socket, targetSocketId: unknown): targetSocketId is string {
    if (typeof targetSocketId !== 'string' || targetSocketId.length > 128) return false;
    const voiceRoom = this.socketVoiceRoomMap.get(client.id);
    return !!voiceRoom && this.server.sockets.adapter.rooms.get(voiceRoom)?.has(targetSocketId) === true;
  }

  private isValidRoomId(roomId: unknown): roomId is string {
    return typeof roomId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(roomId);
  }
}

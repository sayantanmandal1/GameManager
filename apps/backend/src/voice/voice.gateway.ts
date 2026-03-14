import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { getSocketUser } from '../auth/ws-jwt.guard';
import { VOICE_EVENTS } from '@multiplayer-games/shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class VoiceGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  @SubscribeMessage(VOICE_EVENTS.JOIN)
  async handleVoiceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const user = getSocketUser(client, this.jwtService);
    if (!user) return;

    const voiceRoom = `voice:${data.roomId}`;

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
    @MessageBody() data: { roomId: string },
  ): void {
    const voiceRoom = `voice:${data.roomId}`;
    client.leave(voiceRoom);
    client.to(voiceRoom).emit(VOICE_EVENTS.PEER_LEFT, {
      socketId: client.id,
    });
  }

  @SubscribeMessage(VOICE_EVENTS.OFFER)
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; offer: RTCSessionDescriptionInit },
  ): void {
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

    client.to(`voice:${data.roomId}`).emit(VOICE_EVENTS.MUTE_STATUS, {
      socketId: client.id,
      userId: user.sub,
      isMuted: data.isMuted,
    });
  }
}

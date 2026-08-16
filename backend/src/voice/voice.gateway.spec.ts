import { VoiceGateway } from './voice.gateway';
import { JwtService } from '@nestjs/jwt';
import { VOICE_EVENTS } from '../shared';

interface MockSocket {
  id: string;
  data: { user?: { sub: string; username: string } };
  handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  to: jest.Mock;
}

const makeSocket = (id: string): MockSocket => {
  const roomEmit = jest.fn();
  return {
    id,
    data: { user: { sub: `user-${id}`, username: id } },
    handshake: { auth: {}, headers: {} },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: roomEmit }),
  };
};

describe('VoiceGateway', () => {
  let gateway: VoiceGateway;
  let roomMembers: Map<string, Set<string>>;
  let targetedEmit: jest.Mock;
  let existingSockets: unknown[];

  beforeEach(() => {
    gateway = new VoiceGateway({} as JwtService);
    roomMembers = new Map();
    targetedEmit = jest.fn();
    existingSockets = [];
    gateway.server = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn(() => Promise.resolve(existingSockets)),
      }),
      to: jest.fn().mockReturnValue({ emit: targetedEmit }),
      sockets: { adapter: { rooms: roomMembers } },
    } as never;
  });

  it('joins a validated room and returns its existing peers', async () => {
    const client = makeSocket('new');
    existingSockets = [
      { id: 'existing', data: { user: { sub: 'user-existing', username: 'Alice' } } },
    ];

    await gateway.handleVoiceJoin(client as never, { roomId: '123456' });

    expect(client.join).toHaveBeenCalledWith('voice:123456');
    expect(client.emit).toHaveBeenCalledWith(VOICE_EVENTS.PEER_JOINED, {
      peers: [{ socketId: 'existing', userId: 'user-existing', username: 'Alice' }],
      shouldInitiate: true,
    });
  });

  it('rejects malformed room identifiers', async () => {
    const client = makeSocket('new');

    await gateway.handleVoiceJoin(client as never, { roomId: '../other-room' });

    expect(client.join).not.toHaveBeenCalled();
  });

  it('relays signaling only when the target is in the sender voice room', async () => {
    const client = makeSocket('sender');
    await gateway.handleVoiceJoin(client as never, { roomId: '123456' });
    roomMembers.set('voice:123456', new Set(['sender', 'same-room']));

    gateway.handleOffer(client as never, {
      targetSocketId: 'same-room',
      offer: { type: 'offer', sdp: 'safe-sdp' },
    });
    gateway.handleOffer(client as never, {
      targetSocketId: 'other-room',
      offer: { type: 'offer', sdp: 'safe-sdp' },
    });

    expect(targetedEmit).toHaveBeenCalledTimes(1);
    expect(targetedEmit).toHaveBeenCalledWith(VOICE_EVENTS.OFFER, {
      socketId: 'sender',
      offer: { type: 'offer', sdp: 'safe-sdp' },
    });
  });

  it('notifies the tracked room when a socket disconnects', async () => {
    const client = makeSocket('leaver');
    await gateway.handleVoiceJoin(client as never, { roomId: '123456' });

    gateway.handleDisconnect(client as never);

    expect(client.to).toHaveBeenLastCalledWith('voice:123456');
    expect(client.to.mock.results.at(-1)?.value.emit).toHaveBeenCalledWith(
      VOICE_EVENTS.PEER_LEFT,
      { socketId: 'leaver' },
    );
    expect(client.leave).toHaveBeenCalledWith('voice:123456');
  });
});
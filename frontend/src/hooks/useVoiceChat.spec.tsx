import { act, cleanup, renderHook } from '@testing-library/react';
import { getSocket } from '@/lib/socket';
import { VOICE_EVENTS } from '@/shared';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceChat } from './useVoiceChat';

jest.mock('@/lib/socket', () => ({
  getSocket: jest.fn(),
}));

type SocketHandler = (data?: unknown) => void | Promise<void>;

class FakeSocket {
  connected = true;
  id = 'voice-z';
  emit = jest.fn();
  private readonly handlers = new Map<string, Set<SocketHandler>>();

  on(event: string, handler: SocketHandler): void {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }

  off(event: string, handler: SocketHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  async dispatch(event: string, data?: unknown): Promise<void> {
    await Promise.all(
      Array.from(this.handlers.get(event) ?? [], (handler) => handler(data)),
    );
  }
}

function createTrack(id: string) {
  return {
    id,
    kind: 'audio',
    enabled: true,
    readyState: 'live',
    stop: jest.fn(),
  } as unknown as MediaStreamTrack;
}

function createStream(track: MediaStreamTrack) {
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];

  readonly configuration: RTCConfiguration;
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  iceGatheringState: RTCIceGatheringState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  private readonly senders: RTCRtpSender[] = [];

  addTrack = jest.fn((track: MediaStreamTrack) => {
    const sender = { track } as RTCRtpSender;
    this.senders.push(sender);
    return sender;
  });
  addIceCandidate = jest.fn(async () => undefined);
  createOffer = jest.fn(async (options?: RTCOfferOptions) => ({
    type: 'offer' as RTCSdpType,
    sdp: options?.iceRestart ? 'restart' : 'offer',
  }));
  createAnswer = jest.fn(async () => ({
    type: 'answer' as RTCSdpType,
    sdp: 'answer',
  }));
  restartIce = jest.fn();
  close = jest.fn(() => {
    this.connectionState = 'closed';
  });

  constructor(configuration: RTCConfiguration) {
    this.configuration = configuration;
    FakePeerConnection.instances.push(this);
  }

  getSenders(): RTCRtpSender[] {
    return this.senders;
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
}

describe('useVoiceChat', () => {
  let socket: FakeSocket;
  let localTrack: MediaStreamTrack;
  let localStream: MediaStream;
  let getUserMedia: jest.Mock;

  beforeEach(() => {
    socket = new FakeSocket();
    localTrack = createTrack('local-track');
    localStream = createStream(localTrack);
    getUserMedia = jest.fn().mockResolvedValue(localStream);
    (getSocket as jest.Mock).mockReturnValue(socket);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(globalThis, 'RTCPeerConnection', {
      configurable: true,
      value: FakePeerConnection,
    });
    Object.defineProperty(globalThis, 'RTCSessionDescription', {
      configurable: true,
      value: class {
        constructor(description: RTCSessionDescriptionInit) {
          Object.assign(this, description);
        }
      },
    });
    Object.defineProperty(globalThis, 'RTCIceCandidate', {
      configurable: true,
      value: class {
        constructor(candidate: RTCIceCandidateInit) {
          Object.assign(this, candidate);
        }
      },
    });
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    FakePeerConnection.instances = [];
    useVoiceStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('joins with a live track and creates STUN-only offers', async () => {
    const { result } = renderHook(() => useVoiceChat('room-1'));

    await act(async () => {
      expect(await result.current.joinVoice()).toBe(true);
      await socket.dispatch(VOICE_EVENTS.PEER_JOINED, {
        peers: [{ socketId: 'voice-a', userId: 'user-a', username: 'Alex' }],
        shouldInitiate: true,
      });
    });

    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
    expect(socket.emit).toHaveBeenCalledWith(VOICE_EVENTS.JOIN, { roomId: 'room-1' });
    const pc = FakePeerConnection.instances[0];
    const urls = pc.configuration.iceServers?.flatMap((server) =>
      typeof server.urls === 'string' ? [server.urls] : server.urls,
    );
    expect(urls).toHaveLength(3);
    expect(urls?.every((url) => url.startsWith('stun:'))).toBe(true);
    expect(pc.addTrack).toHaveBeenCalledWith(localTrack, localStream);
    expect(socket.emit).toHaveBeenCalledWith(
      VOICE_EVENTS.OFFER,
      expect.objectContaining({ targetSocketId: 'voice-a' }),
    );
  });

  it('buffers early candidates and attaches playable remote audio', async () => {
    const { result } = renderHook(() => useVoiceChat('room-1'));
    await act(async () => {
      await result.current.joinVoice();
      await socket.dispatch(VOICE_EVENTS.ICE_CANDIDATE, {
        socketId: 'voice-a',
        candidate: { candidate: 'candidate-before-offer' },
      });
      await socket.dispatch(VOICE_EVENTS.OFFER, {
        socketId: 'voice-a',
        offer: { type: 'offer', sdp: 'remote-offer' },
      });
    });

    const pc = FakePeerConnection.instances[0];
    expect(pc.addIceCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: 'candidate-before-offer' }),
    );

    const remoteStream = createStream(createTrack('remote-track'));
    await act(async () => {
      pc.ontrack?.({ streams: [remoteStream] } as unknown as RTCTrackEvent);
    });

    const audio = document.querySelector('#voice-audio-container audio');
    expect(audio).toBeInstanceOf(HTMLAudioElement);
    expect((audio as HTMLAudioElement).srcObject).toBe(remoteStream);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    act(() => useVoiceStore.getState().toggleSpeaker());
    expect((audio as HTMLAudioElement).muted).toBe(true);
    act(() => useVoiceStore.getState().toggleMute());
    expect(localTrack.enabled).toBe(false);
    expect(socket.emit).toHaveBeenCalledWith(VOICE_EVENTS.TOGGLE_MUTE, {
      roomId: 'room-1',
      isMuted: true,
    });
  });

  it('leaves cleanly and can acquire a fresh stream on rejoin', async () => {
    const nextTrack = createTrack('next-track');
    const nextStream = createStream(nextTrack);
    getUserMedia.mockResolvedValueOnce(localStream).mockResolvedValueOnce(nextStream);
    const { result } = renderHook(() => useVoiceChat('room-1'));

    await act(async () => {
      await result.current.joinVoice();
      await socket.dispatch(VOICE_EVENTS.PEER_JOINED, {
        peers: [{ socketId: 'voice-a', userId: 'user-a', username: 'Alex' }],
        shouldInitiate: true,
      });
      result.current.leaveVoice();
    });

    expect(FakePeerConnection.instances[0].close).toHaveBeenCalled();
    expect(localTrack.stop).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(VOICE_EVENTS.LEAVE, { roomId: 'room-1' });
    expect(useVoiceStore.getState().activePeers.size).toBe(0);

    await act(async () => {
      expect(await result.current.joinVoice()).toBe(true);
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(nextTrack.enabled).toBe(true);
  });

  it('performs a bounded ICE restart from the deterministic peer', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useVoiceChat('room-1'));
    await act(async () => {
      await result.current.joinVoice();
      await socket.dispatch(VOICE_EVENTS.PEER_JOINED, {
        peers: [{ socketId: 'voice-a', userId: 'user-a', username: 'Alex' }],
        shouldInitiate: true,
      });
    });

    const pc = FakePeerConnection.instances[0];
    pc.connectionState = 'failed';
    await act(async () => {
      pc.onconnectionstatechange?.();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pc.restartIce).toHaveBeenCalledTimes(1);
    expect(pc.createOffer).toHaveBeenCalledWith({ iceRestart: true });
    expect(socket.emit).toHaveBeenCalledWith(
      VOICE_EVENTS.OFFER,
      expect.objectContaining({ targetSocketId: 'voice-a' }),
    );
  });
});
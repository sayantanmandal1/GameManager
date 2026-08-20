'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { useVoiceStore } from '@/stores/voiceStore';
import { VOICE_EVENTS } from '@/shared';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  bundlePolicy: 'max-bundle',
};

function getMediaErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone permission was denied. Allow microphone access and try again.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found on this device.';
  }
  return 'Unable to start voice chat.';
}

function addMissingAudioTracks(pc: RTCPeerConnection, stream: MediaStream): void {
  const existingTrackIds = new Set(
    pc.getSenders().map((sender) => sender.track?.id).filter(Boolean),
  );
  for (const track of stream.getAudioTracks()) {
    if (!existingTrackIds.has(track.id)) pc.addTrack(track, stream);
  }
}

export function useVoiceChat(roomId: string) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  /**
   * Buffer ICE candidates that arrive before remoteDescription is set.
   * This is the primary fix for the silent-drop race condition.
   */
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const restartAttempts = useRef<Map<string, number>>(new Map());
  const restartTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Keep audio elements attached to the DOM for autoplay policy compliance */
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    isInVoice,
    isMuted,
    isSpeakerOff,
    addPeer,
    removePeer,
    setPeerMuted,
    clearPeers,
    setVoiceActive,
    setVoiceJoining,
    setConnectionError,
    setAudioResumeRequired,
  } = useVoiceStore();

  // Create a hidden container for audio elements on mount
  useEffect(() => {
    if (!audioContainerRef.current) {
      const container = document.createElement('div');
      container.id = 'voice-audio-container';
      container.style.position = 'fixed';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);
      audioContainerRef.current = container;
    }
    return () => {
      // Cleanup all audio elements
      audioElements.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });
      audioElements.current.clear();
      restartTimers.current.forEach((timer) => clearTimeout(timer));
      restartTimers.current.clear();
      if (audioContainerRef.current) {
        audioContainerRef.current.remove();
        audioContainerRef.current = null;
      }
    };
  }, []);

  // Speaker toggle: mute/unmute all remote audio elements
  useEffect(() => {
    audioElements.current.forEach((audio) => {
      audio.muted = isSpeakerOff;
    });
  }, [isSpeakerOff]);

  const createAudioElement = useCallback((socketId: string, stream: MediaStream) => {
    // Remove existing audio for this peer if any
    const existing = audioElements.current.get(socketId);
    if (existing) {
      existing.pause();
      existing.srcObject = null;
      existing.remove();
    }

    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.volume = 1;
    audio.setAttribute('playsinline', 'true');
    audio.muted = useVoiceStore.getState().isSpeakerOff;
    audio.srcObject = stream;

    // Attach to DOM container (critical for autoplay in most browsers)
    if (audioContainerRef.current) {
      audioContainerRef.current.appendChild(audio);
    }

    audio.play().then(
      () => setAudioResumeRequired(false),
      () => {
        setAudioResumeRequired(true);
        setConnectionError('Remote audio is paused by the browser. Enable audio to continue.');
      },
    );

    audioElements.current.set(socketId, audio);
  }, [setAudioResumeRequired, setConnectionError]);

  const resumeAudio = useCallback(async () => {
    const results = await Promise.allSettled(
      Array.from(audioElements.current.values(), (audio) => audio.play()),
    );
    const failed = results.some((result) => result.status === 'rejected');
    setAudioResumeRequired(failed);
    setConnectionError(
      failed ? 'Audio playback is still blocked. Check this site\'s sound permission.' : null,
    );
  }, [setAudioResumeRequired, setConnectionError]);

  const cleanupPeer = useCallback((socketId: string) => {
    const pc = peerConnections.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(socketId);
    }
    pendingCandidates.current.delete(socketId);
    restartAttempts.current.delete(socketId);
    const restartTimer = restartTimers.current.get(socketId);
    if (restartTimer) clearTimeout(restartTimer);
    restartTimers.current.delete(socketId);
    const audio = audioElements.current.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElements.current.delete(socketId);
    }
    useVoiceStore.getState().removePeer(socketId);
  }, []);

  /**
   * Flush any ICE candidates that were buffered while waiting for
   * remoteDescription to be set. Must be called immediately after
   * every setRemoteDescription() call.
   */
  const flushPendingCandidates = useCallback(async (socketId: string) => {
    const pc = peerConnections.current.get(socketId);
    if (!pc) return;
    const candidates = pendingCandidates.current.get(socketId) ?? [];
    pendingCandidates.current.delete(socketId);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Voice: failed to add buffered ICE candidate', err);
      }
    }
  }, []);

  const scheduleIceRestart = useCallback((
    pc: RTCPeerConnection,
    targetSocketId: string,
  ): void => {
    if (restartTimers.current.has(targetSocketId)) return;
    const delay = pc.connectionState === 'failed' ? 0 : 1500;
    const timer = setTimeout(async () => {
      restartTimers.current.delete(targetSocketId);
      if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
      const socket = getSocket();
      const shouldRestart = !!socket?.id && socket.id.localeCompare(targetSocketId) > 0;
      const attempts = restartAttempts.current.get(targetSocketId) ?? 0;
      if (!shouldRestart || attempts >= 2) {
        setConnectionError('Peer-to-peer voice could not connect on this network.');
        return;
      }
      restartAttempts.current.set(targetSocketId, attempts + 1);
      try {
        pc.restartIce();
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit(VOICE_EVENTS.OFFER, { targetSocketId, offer });
        setConnectionError('Restoring peer-to-peer voice…');
      } catch {
        setConnectionError('Unable to restore peer-to-peer voice.');
      }
    }, delay);
    restartTimers.current.set(targetSocketId, timer);
  }, [setConnectionError]);

  const createPeerConnection = useCallback(
    (targetSocketId: string): RTCPeerConnection => {
      const socket = getSocket();
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit(VOICE_EVENTS.ICE_CANDIDATE, {
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          createAudioElement(targetSocketId, event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          restartAttempts.current.delete(targetSocketId);
          const timer = restartTimers.current.get(targetSocketId);
          if (timer) clearTimeout(timer);
          restartTimers.current.delete(targetSocketId);
          setConnectionError(null);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          scheduleIceRestart(pc, targetSocketId);
        }
      };

      // Add local tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStream.current!);
        });
      }

      peerConnections.current.set(targetSocketId, pc);
      return pc;
    },
    [createAudioElement, scheduleIceRestart, setConnectionError],
  );

  const joinVoice = useCallback(async (): Promise<boolean> => {
    const socket = getSocket();
    if (!socket?.connected) {
      setConnectionError('Game connection is not ready. Please try again.');
      return false;
    }

    setVoiceJoining(true);
    setConnectionError(null);
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Apply current mute state
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !useVoiceStore.getState().isMuted;
      });

      // A signaling event can create a peer before getUserMedia resolves.
      // Backfill the microphone track and renegotiate those existing peers.
      for (const [targetSocketId, pc] of peerConnections.current) {
        addMissingAudioTracks(pc, localStream.current);
        if (socket.id && socket.id.localeCompare(targetSocketId) > 0) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit(VOICE_EVENTS.OFFER, { targetSocketId, offer });
        }
      }

      socket.emit(VOICE_EVENTS.JOIN, { roomId });
      setVoiceActive(true);
      setVoiceJoining(false);
      return true;
    } catch (err) {
      localStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current = null;
      setConnectionError(getMediaErrorMessage(err));
      setVoiceJoining(false);
      setVoiceActive(false);
      return false;
    }
  }, [roomId, setConnectionError, setVoiceActive, setVoiceJoining]);

  const leaveVoice = useCallback(() => {
    const socket = getSocket();

    // Close all peer connections and audio
    peerConnections.current.forEach((pc, socketId) => {
      pc.close();
      const audio = audioElements.current.get(socketId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      }
    });
    peerConnections.current.clear();
    audioElements.current.clear();
    pendingCandidates.current.clear();
    restartTimers.current.forEach((timer) => clearTimeout(timer));
    restartTimers.current.clear();
    restartAttempts.current.clear();

    // Stop local stream
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;

    // Clear peer list from the store so there are no ghost entries on rejoin
    clearPeers();
    setVoiceActive(false);
    setVoiceJoining(false);
    setConnectionError(null);
    setAudioResumeRequired(false);

    if (socket) {
      socket.emit(VOICE_EVENTS.LEAVE, { roomId });
    }
  }, [roomId, clearPeers, setAudioResumeRequired, setConnectionError, setVoiceActive, setVoiceJoining]);

  // Toggle mute for local mic
  useEffect(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      const socket = getSocket();
      if (socket) {
        socket.emit(VOICE_EVENTS.TOGGLE_MUTE, { roomId, isMuted });
      }
    }
  }, [isMuted, roomId]);

  // Set up signaling listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPeerJoined = async (data: {
      peers: Array<{ socketId: string; userId: string; username: string }>;
      shouldInitiate?: boolean;
    }) => {
      setVoiceJoining(false);
      setConnectionError(null);
      for (const peer of data.peers) {
        addPeer(peer);

        if (!peerConnections.current.has(peer.socketId)) {
          const pc = createPeerConnection(peer.socketId);

          if (data.shouldInitiate) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit(VOICE_EVENTS.OFFER, {
                targetSocketId: peer.socketId,
                offer,
              });
            } catch (err) {
              console.warn('Voice: failed to create offer', err);
            }
          }
        }
      }
    };

    const onPeerLeft = (data: { socketId: string }) => {
      cleanupPeer(data.socketId);
      removePeer(data.socketId);
    };

    const onOffer = async (data: {
      socketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        const pc = peerConnections.current.get(data.socketId)
          ?? createPeerConnection(data.socketId);

        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        // Flush any ICE candidates that arrived before remoteDescription was set
        await flushPendingCandidates(data.socketId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(VOICE_EVENTS.ANSWER, {
          targetSocketId: data.socketId,
          answer,
        });
      } catch (err) {
        console.warn('Voice: failed to handle offer', err);
      }
    };

    const onAnswer = async (data: {
      socketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        const pc = peerConnections.current.get(data.socketId);
        if (pc?.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          // Flush any ICE candidates that arrived before remoteDescription was set
          await flushPendingCandidates(data.socketId);
        }
      } catch (err) {
        console.warn('Voice: failed to handle answer', err);
      }
    };

    const onIceCandidate = async (data: {
      socketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      try {
        const pc = peerConnections.current.get(data.socketId);
        if (!pc) {
          const buffered = pendingCandidates.current.get(data.socketId) ?? [];
          buffered.push(data.candidate);
          pendingCandidates.current.set(data.socketId, buffered);
          return;
        }
        if (pc.remoteDescription) {
          // Remote description already set — add immediately
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          // Buffer the candidate until setRemoteDescription is called
          const buf = pendingCandidates.current.get(data.socketId) ?? [];
          buf.push(data.candidate);
          pendingCandidates.current.set(data.socketId, buf);
        }
      } catch (err) {
        console.warn('Voice: failed to add ICE candidate', err);
      }
    };

    const onMuteStatus = (data: {
      socketId: string;
      isMuted: boolean;
    }) => {
      setPeerMuted(data.socketId, data.isMuted);
    };

    const onConnect = () => {
      if (!localStream.current) return;
      peerConnections.current.forEach((_, socketId) => cleanupPeer(socketId));
      clearPeers();
      setVoiceJoining(true);
      setConnectionError(null);
      socket.emit(VOICE_EVENTS.JOIN, { roomId });
    };

    const onDisconnect = () => {
      if (!localStream.current) return;
      peerConnections.current.forEach((_, socketId) => cleanupPeer(socketId));
      clearPeers();
      setVoiceJoining(true);
      setConnectionError('Voice signaling disconnected. Reconnecting…');
    };

    socket.on(VOICE_EVENTS.PEER_JOINED, onPeerJoined);
    socket.on(VOICE_EVENTS.PEER_LEFT, onPeerLeft);
    socket.on(VOICE_EVENTS.OFFER, onOffer);
    socket.on(VOICE_EVENTS.ANSWER, onAnswer);
    socket.on(VOICE_EVENTS.ICE_CANDIDATE, onIceCandidate);
    socket.on(VOICE_EVENTS.MUTE_STATUS, onMuteStatus);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off(VOICE_EVENTS.PEER_JOINED, onPeerJoined);
      socket.off(VOICE_EVENTS.PEER_LEFT, onPeerLeft);
      socket.off(VOICE_EVENTS.OFFER, onOffer);
      socket.off(VOICE_EVENTS.ANSWER, onAnswer);
      socket.off(VOICE_EVENTS.ICE_CANDIDATE, onIceCandidate);
      socket.off(VOICE_EVENTS.MUTE_STATUS, onMuteStatus);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId, createPeerConnection, cleanupPeer, addPeer, removePeer, setPeerMuted, clearPeers, flushPendingCandidates, setConnectionError, setVoiceJoining]);

  useEffect(() => () => {
    if (!localStream.current) return;
    getSocket()?.emit(VOICE_EVENTS.LEAVE, { roomId });
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    restartTimers.current.forEach((timer) => clearTimeout(timer));
    restartTimers.current.clear();
    restartAttempts.current.clear();
    localStream.current.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    useVoiceStore.getState().clearPeers();
    useVoiceStore.getState().setVoiceActive(false);
    useVoiceStore.getState().setVoiceJoining(false);
  }, [roomId]);

  return { joinVoice, leaveVoice, resumeAudio, isInVoice };
}

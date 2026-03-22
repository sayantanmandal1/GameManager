'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { useVoiceStore } from '@/stores/voiceStore';
import { VOICE_EVENTS } from '@/shared';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat(roomId: string) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  /** Keep audio elements attached to the DOM for autoplay policy compliance */
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const { isInVoice, isMuted, isSpeakerOff, addPeer, removePeer, setPeerMuted } =
    useVoiceStore();

  // Create a hidden container for audio elements on mount
  useEffect(() => {
    if (!audioContainerRef.current) {
      const container = document.createElement('div');
      container.id = 'voice-audio-container';
      container.style.display = 'none';
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
    audio.playsInline = true;
    audio.muted = useVoiceStore.getState().isSpeakerOff;
    audio.srcObject = stream;

    // Attach to DOM container (critical for autoplay in most browsers)
    if (audioContainerRef.current) {
      audioContainerRef.current.appendChild(audio);
    }

    // Force play with retry on autoplay failure
    const playAudio = () => {
      audio.play().catch(() => {
        // Retry after a short delay — user may need to interact first
        setTimeout(() => audio.play().catch(() => {}), 1000);
      });
    };
    playAudio();

    audioElements.current.set(socketId, audio);
  }, []);

  const cleanupPeer = useCallback((socketId: string) => {
    const pc = peerConnections.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(socketId);
    }
    const audio = audioElements.current.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElements.current.delete(socketId);
    }
  }, []);

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
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          cleanupPeer(targetSocketId);
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
    [createAudioElement, cleanupPeer],
  );

  const joinVoice = useCallback(async () => {
    const socket = getSocket();
    if (!socket) return;

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

      socket.emit(VOICE_EVENTS.JOIN, { roomId });
    } catch (err) {
      console.error('Failed to get microphone access:', err);
    }
  }, [roomId]);

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

    // Stop local stream
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;

    if (socket) {
      socket.emit(VOICE_EVENTS.LEAVE, { roomId });
    }
  }, [roomId]);

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
        let pc = peerConnections.current.get(data.socketId);
        if (!pc) {
          pc = createPeerConnection(data.socketId);
        }

        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
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
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
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
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
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

    socket.on(VOICE_EVENTS.PEER_JOINED, onPeerJoined);
    socket.on(VOICE_EVENTS.PEER_LEFT, onPeerLeft);
    socket.on(VOICE_EVENTS.OFFER, onOffer);
    socket.on(VOICE_EVENTS.ANSWER, onAnswer);
    socket.on(VOICE_EVENTS.ICE_CANDIDATE, onIceCandidate);
    socket.on(VOICE_EVENTS.MUTE_STATUS, onMuteStatus);

    return () => {
      socket.off(VOICE_EVENTS.PEER_JOINED, onPeerJoined);
      socket.off(VOICE_EVENTS.PEER_LEFT, onPeerLeft);
      socket.off(VOICE_EVENTS.OFFER, onOffer);
      socket.off(VOICE_EVENTS.ANSWER, onAnswer);
      socket.off(VOICE_EVENTS.ICE_CANDIDATE, onIceCandidate);
      socket.off(VOICE_EVENTS.MUTE_STATUS, onMuteStatus);
    };
  }, [createPeerConnection, cleanupPeer, addPeer, removePeer, setPeerMuted]);

  return { joinVoice, leaveVoice, isInVoice };
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { useVoiceStore } from '@/stores/voiceStore';
import { VOICE_EVENTS } from '@multiplayer-games/shared';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat(roomId: string) {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const { isInVoice, isMuted, addPeer, removePeer, setPeerMuted } =
    useVoiceStore();

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
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {});
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
    [],
  );

  const joinVoice = useCallback(async () => {
    const socket = getSocket();
    if (!socket) return;

    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      socket.emit(VOICE_EVENTS.JOIN, { roomId });
    } catch (err) {
      console.error('Failed to get microphone access:', err);
    }
  }, [roomId]);

  const leaveVoice = useCallback(() => {
    const socket = getSocket();

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    // Stop local stream
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;

    if (socket) {
      socket.emit(VOICE_EVENTS.LEAVE, { roomId });
    }
  }, [roomId]);

  // Toggle mute
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

          // Only create an offer if we are the initiator (new joiner → existing peers)
          // Existing peers wait for the offer from the new joiner
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
      const pc = peerConnections.current.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.socketId);
      }
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

        // Handle glare: if we already sent an offer, roll back first
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
        // Only apply the answer if we're waiting for one
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
  }, [createPeerConnection, addPeer, removePeer, setPeerMuted]);

  return { joinVoice, leaveVoice, isInVoice };
}

import { create } from 'zustand';

interface VoicePeer {
  socketId: string;
  userId: string;
  username: string;
  isMuted: boolean;
}

interface VoiceState {
  isInVoice: boolean;
  isJoining: boolean;
  isMuted: boolean;
  isSpeakerOff: boolean;
  connectionError: string | null;
  needsAudioResume: boolean;
  activePeers: Map<string, VoicePeer>;
  toggleVoice: () => void;
  setVoiceActive: (active: boolean) => void;
  setVoiceJoining: (joining: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setAudioResumeRequired: (required: boolean) => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  addPeer: (peer: Omit<VoicePeer, 'isMuted'>) => void;
  removePeer: (socketId: string) => void;
  setPeerMuted: (socketId: string, isMuted: boolean) => void;
  clearPeers: () => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>()((set) => ({
  isInVoice: false,
  isJoining: false,
  isMuted: false,
  isSpeakerOff: false,
  connectionError: null,
  needsAudioResume: false,
  activePeers: new Map(),

  toggleVoice: () =>
    set((state) => ({ isInVoice: !state.isInVoice })),

  setVoiceActive: (active) => set({ isInVoice: active }),
  setVoiceJoining: (joining) => set({ isJoining: joining }),
  setConnectionError: (error) => set({ connectionError: error }),
  setAudioResumeRequired: (required) => set({ needsAudioResume: required }),

  toggleMute: () =>
    set((state) => ({ isMuted: !state.isMuted })),

  toggleSpeaker: () =>
    set((state) => ({ isSpeakerOff: !state.isSpeakerOff })),

  addPeer: (peer) =>
    set((state) => {
      const peers = new Map(state.activePeers);
      peers.set(peer.socketId, { ...peer, isMuted: false });
      return { activePeers: peers };
    }),

  removePeer: (socketId) =>
    set((state) => {
      const peers = new Map(state.activePeers);
      peers.delete(socketId);
      return { activePeers: peers };
    }),

  setPeerMuted: (socketId, isMuted) =>
    set((state) => {
      const peers = new Map(state.activePeers);
      const peer = peers.get(socketId);
      if (peer) peers.set(socketId, { ...peer, isMuted });
      return { activePeers: peers };
    }),

  clearPeers: () => set({ activePeers: new Map() }),

  reset: () =>
    set({
      isInVoice: false,
      isJoining: false,
      isMuted: false,
      isSpeakerOff: false,
      connectionError: null,
      needsAudioResume: false,
      activePeers: new Map(),
    }),
}));

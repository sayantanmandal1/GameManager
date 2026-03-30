import { create } from 'zustand';

interface VoicePeer {
  socketId: string;
  userId: string;
  username: string;
  isMuted: boolean;
}

interface VoiceState {
  isInVoice: boolean;
  isMuted: boolean;
  isSpeakerOff: boolean;
  activePeers: Map<string, VoicePeer>;
  toggleVoice: () => void;
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
  isMuted: false,
  isSpeakerOff: false,
  activePeers: new Map(),

  toggleVoice: () =>
    set((state) => ({ isInVoice: !state.isInVoice })),

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
    set({ isInVoice: false, isMuted: false, isSpeakerOff: false, activePeers: new Map() }),
}));

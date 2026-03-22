/**
 * Tests for stores/voiceStore.ts
 */
import { useVoiceStore } from './voiceStore';

describe('VoiceStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useVoiceStore.setState({
      isInVoice: false,
      isMuted: false,
      isSpeakerOff: false,
      activePeers: new Map(),
    });
  });

  describe('initial state', () => {
    it('should start not in voice', () => {
      expect(useVoiceStore.getState().isInVoice).toBe(false);
    });

    it('should start unmuted', () => {
      expect(useVoiceStore.getState().isMuted).toBe(false);
    });

    it('should start with speaker on', () => {
      expect(useVoiceStore.getState().isSpeakerOff).toBe(false);
    });

    it('should start with no active peers', () => {
      expect(useVoiceStore.getState().activePeers.size).toBe(0);
    });
  });

  describe('toggleVoice', () => {
    it('should toggle isInVoice', () => {
      useVoiceStore.getState().toggleVoice();
      expect(useVoiceStore.getState().isInVoice).toBe(true);
      useVoiceStore.getState().toggleVoice();
      expect(useVoiceStore.getState().isInVoice).toBe(false);
    });
  });

  describe('toggleMute', () => {
    it('should toggle isMuted', () => {
      useVoiceStore.getState().toggleMute();
      expect(useVoiceStore.getState().isMuted).toBe(true);
      useVoiceStore.getState().toggleMute();
      expect(useVoiceStore.getState().isMuted).toBe(false);
    });
  });

  describe('toggleSpeaker', () => {
    it('should toggle isSpeakerOff', () => {
      useVoiceStore.getState().toggleSpeaker();
      expect(useVoiceStore.getState().isSpeakerOff).toBe(true);
      useVoiceStore.getState().toggleSpeaker();
      expect(useVoiceStore.getState().isSpeakerOff).toBe(false);
    });
  });

  describe('addPeer', () => {
    it('should add a peer with isMuted=false', () => {
      useVoiceStore.getState().addPeer({
        socketId: 's1',
        userId: 'u1',
        username: 'Alice',
      });
      const peers = useVoiceStore.getState().activePeers;
      expect(peers.size).toBe(1);
      expect(peers.get('s1')).toEqual({
        socketId: 's1',
        userId: 'u1',
        username: 'Alice',
        isMuted: false,
      });
    });

    it('should add multiple peers', () => {
      useVoiceStore.getState().addPeer({ socketId: 's1', userId: 'u1', username: 'Alice' });
      useVoiceStore.getState().addPeer({ socketId: 's2', userId: 'u2', username: 'Bob' });
      expect(useVoiceStore.getState().activePeers.size).toBe(2);
    });
  });

  describe('removePeer', () => {
    it('should remove a peer by socketId', () => {
      useVoiceStore.getState().addPeer({ socketId: 's1', userId: 'u1', username: 'Alice' });
      useVoiceStore.getState().removePeer('s1');
      expect(useVoiceStore.getState().activePeers.size).toBe(0);
    });

    it('should do nothing when removing non-existent peer', () => {
      useVoiceStore.getState().removePeer('nonexistent');
      expect(useVoiceStore.getState().activePeers.size).toBe(0);
    });
  });

  describe('setPeerMuted', () => {
    it('should set mute status for a peer', () => {
      useVoiceStore.getState().addPeer({ socketId: 's1', userId: 'u1', username: 'Alice' });
      useVoiceStore.getState().setPeerMuted('s1', true);
      expect(useVoiceStore.getState().activePeers.get('s1')?.isMuted).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      useVoiceStore.getState().toggleVoice();
      useVoiceStore.getState().toggleMute();
      useVoiceStore.getState().toggleSpeaker();
      useVoiceStore.getState().addPeer({ socketId: 's1', userId: 'u1', username: 'Alice' });
      
      useVoiceStore.getState().reset();
      
      const state = useVoiceStore.getState();
      expect(state.isInVoice).toBe(false);
      expect(state.isMuted).toBe(false);
      expect(state.isSpeakerOff).toBe(false);
      expect(state.activePeers.size).toBe(0);
    });
  });
});

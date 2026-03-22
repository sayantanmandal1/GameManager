import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceChat } from './VoiceChat';
import { useVoiceStore } from '@/stores/voiceStore';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
      button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button ref={ref} {...props}>{children}</button>
      )),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const mockJoinVoice = jest.fn().mockResolvedValue(undefined);
const mockLeaveVoice = jest.fn();

jest.mock('@/hooks/useVoiceChat', () => ({
  useVoiceChat: () => ({
    joinVoice: mockJoinVoice,
    leaveVoice: mockLeaveVoice,
  }),
}));

describe('VoiceChat Component', () => {
  beforeEach(() => {
    useVoiceStore.setState({
      isInVoice: false,
      isMuted: false,
      isSpeakerOff: false,
      activePeers: new Map(),
    });
    mockJoinVoice.mockClear();
    mockLeaveVoice.mockClear();
  });

  it('renders Voice Chat heading', () => {
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByText('Voice Chat')).toBeInTheDocument();
  });

  it('shows Join button when not in voice', () => {
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByText('Join')).toBeInTheDocument();
    expect(screen.getByText('Click Join to start voice chat')).toBeInTheDocument();
  });

  it('calls joinVoice when Join is clicked', async () => {
    render(<VoiceChat roomId="room1" />);
    fireEvent.click(screen.getByText('Join'));
    expect(mockJoinVoice).toHaveBeenCalled();
  });

  it('shows Leave button and controls when in voice', () => {
    useVoiceStore.setState({ isInVoice: true });
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByTitle('Mute Mic')).toBeInTheDocument();
    expect(screen.getByTitle('Disable Speaker')).toBeInTheDocument();
  });

  it('shows "No one else" when in voice with no peers', () => {
    useVoiceStore.setState({ isInVoice: true });
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByText('No one else in voice yet…')).toBeInTheDocument();
  });

  it('shows peers when in voice with active peers', () => {
    const peers = new Map([
      ['s1', { socketId: 's1', userId: 'u1', username: 'Bob', isMuted: false }],
    ]);
    useVoiceStore.setState({ isInVoice: true, activePeers: peers });
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows muted mic icon when muted', () => {
    useVoiceStore.setState({ isInVoice: true, isMuted: true });
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByTitle('Unmute Mic')).toBeInTheDocument();
    expect(screen.getByText('🎙️❌')).toBeInTheDocument();
  });

  it('shows speaker off icon when speaker is off', () => {
    useVoiceStore.setState({ isInVoice: true, isSpeakerOff: true });
    render(<VoiceChat roomId="room1" />);
    expect(screen.getByTitle('Enable Speaker')).toBeInTheDocument();
    expect(screen.getByText('🔇')).toBeInTheDocument();
  });

  it('calls leaveVoice when Leave is clicked', () => {
    useVoiceStore.setState({ isInVoice: true });
    render(<VoiceChat roomId="room1" />);
    fireEvent.click(screen.getByText('Leave'));
    expect(mockLeaveVoice).toHaveBeenCalled();
  });
});

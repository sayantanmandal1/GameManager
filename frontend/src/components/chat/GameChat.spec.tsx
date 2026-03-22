/**
 * Tests for components/chat/GameChat.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameChat } from './GameChat';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// Mock socket
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('@/lib/socket', () => ({
  getSocket: jest.fn(() => mockSocket),
}));

// Mock auth store
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'u1', username: 'Alice', avatar: '🦊' },
  })),
}));

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockSessionStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockSessionStorage[key];
    }),
  },
  writable: true,
});

describe('GameChat Component', () => {
  beforeEach(() => {
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
  });

  it('should render collapsed chat box initially', () => {
    render(<GameChat lobbyCode="123456" />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('should show "Click to chat…" when no messages', () => {
    render(<GameChat lobbyCode="123456" />);
    expect(screen.getByText('Click to chat…')).toBeInTheDocument();
  });

  it('should expand when clicked', () => {
    render(<GameChat lobbyCode="123456" />);
    // Click the collapsed box to expand
    fireEvent.click(screen.getByText('Chat'));
    expect(screen.getByText('Team Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
  });

  it('should show input field when expanded', () => {
    render(<GameChat lobbyCode="123456" />);
    fireEvent.click(screen.getByText('Chat'));
    expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
  });

  it('should emit chat message on Enter', () => {
    render(<GameChat lobbyCode="123456" />);
    fireEvent.click(screen.getByText('Chat'));
    
    const input = screen.getByPlaceholderText(/Type a message/);
    fireEvent.change(input, { target: { value: 'Hello!' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSocket.emit).toHaveBeenCalledWith('lobby:chat_message', {
      message: 'Hello!',
    });
  });

  it('should not emit empty messages', () => {
    render(<GameChat lobbyCode="123456" />);
    fireEvent.click(screen.getByText('Chat'));
    
    const input = screen.getByPlaceholderText(/Type a message/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('should subscribe to chat events on mount', () => {
    render(<GameChat lobbyCode="123456" />);
    expect(mockSocket.on).toHaveBeenCalledWith('lobby:chat_message', expect.any(Function));
  });

  it('should collapse when ESC is pressed', () => {
    render(<GameChat lobbyCode="123456" />);
    fireEvent.click(screen.getByText('Chat'));
    
    expect(screen.getByText('Team Chat')).toBeInTheDocument();
    
    const input = screen.getByPlaceholderText(/Type a message/);
    fireEvent.keyDown(input, { key: 'Escape' });

    // After ESC, should see collapsed view
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('should show ESC button when expanded', () => {
    render(<GameChat lobbyCode="123456" />);
    fireEvent.click(screen.getByText('Chat'));
    expect(screen.getByText('ESC')).toBeInTheDocument();
  });
});

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { LOBBY_EVENTS } from '@/shared';

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface LobbyChatProps {
  lobbyCode: string;
}

const STORAGE_KEY = (code: string) => `lobby-chat-${code}`;

export function LobbyChat({ lobbyCode }: LobbyChatProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY(lobbyCode));
      if (stored) {
        setMessages(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [lobbyCode]);

  // Save to sessionStorage when messages change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY(lobbyCode), JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, lobbyCode]);

  // Listen for chat messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (data: ChatMessage) => {
      setMessages((prev) => [...prev, data]);
      if (!isOpen && data.userId !== user?.id) {
        setUnread((prev) => prev + 1);
      }
    };

    socket.on(LOBBY_EVENTS.CHAT_MESSAGE, onMessage);
    return () => {
      socket.off(LOBBY_EVENTS.CHAT_MESSAGE, onMessage);
    };
  }, [isOpen, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Clear chat from sessionStorage when game starts
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onGameStarting = () => {
      try {
        sessionStorage.removeItem(STORAGE_KEY(lobbyCode));
      } catch {
        // ignore
      }
    };

    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    return () => {
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    };
  }, [lobbyCode]);

  const sendMessage = () => {
    const socket = getSocket();
    const trimmed = input.trim();
    if (!socket || !trimmed) return;

    socket.emit(LOBBY_EVENTS.CHAT_MESSAGE, { message: trimmed });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setUnread(0);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Chat toggle button */}
      <button
        onClick={handleOpen}
        aria-label={isOpen ? 'Close lobby chat' : 'Open lobby chat'}
        aria-expanded={isOpen}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-game-blue text-game-bg shadow-lg transition-colors hover:bg-game-blue/90 active:scale-95"
      >
        💬
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="premium-panel absolute bottom-14 right-0 flex h-96 max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Lobby Chat</h3>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-xs text-game-muted">
                No messages yet. Say hi! 👋
              </p>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.userId === user?.id;
              return (
                <div
                  key={`${msg.timestamp}-${i}`}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="mb-0.5 text-[11px] text-game-muted">
                    {isMe ? 'You' : msg.username}
                  </span>
                  <div
                    className={`px-3 py-1.5 rounded-xl text-sm max-w-[80%] break-words ${
                      isMe
                        ? 'bg-white text-black rounded-br-sm'
                        : 'bg-black text-white/90 border border-white/[0.06] rounded-bl-sm'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-white/[0.06] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              aria-label="Lobby chat message"
              maxLength={500}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-game-border bg-game-bg px-3 py-2 text-sm text-game-text placeholder-game-muted focus:border-game-blue focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="min-h-11 rounded-xl bg-game-blue px-3 py-2 text-sm font-semibold text-game-bg transition-colors hover:bg-game-blue/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

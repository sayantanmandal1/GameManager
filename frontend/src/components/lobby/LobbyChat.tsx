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
        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-white/90 transition-colors relative"
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
        <div className="absolute bottom-14 right-0 w-80 h-96 bg-white/[0.03] border border-white/[0.06] rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Lobby Chat</h3>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-white/40 text-center mt-8">
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
                  <span className="text-[10px] text-white/40 mb-0.5">
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
              maxLength={500}
              className="flex-1 px-3 py-2 bg-black border border-white/[0.06] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-white/90 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

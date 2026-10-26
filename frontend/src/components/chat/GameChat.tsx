'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { LOBBY_EVENTS } from '@/shared';

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface GameChatProps {
  lobbyCode: string;
}

const STORAGE_KEY = (code: string) => `lobby-chat-${code}`;

export function GameChat({ lobbyCode }: GameChatProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (!isExpanded && data.userId !== user?.id) {
        setUnread((prev) => prev + 1);
      }
    };

    socket.on(LOBBY_EVENTS.CHAT_MESSAGE, onMessage);
    return () => {
      socket.off(LOBBY_EVENTS.CHAT_MESSAGE, onMessage);
    };
  }, [isExpanded, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

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
    if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
    setUnread(0);
  };

  // Last 3 messages for collapsed preview
  const previewMessages = messages.slice(-3);

  return (
    <div className="w-full max-w-sm">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          /* ─── Expanded full chat ─── */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="premium-panel flex flex-col overflow-hidden"
            style={{ height: '360px' }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Team Chat
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="min-h-11 rounded-xl px-3 text-xs text-game-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                ESC
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {messages.length === 0 && (
                <p className="text-xs text-white/40 text-center mt-8 opacity-60">
                  No messages yet
                </p>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.userId === user?.id;
                return (
                  <div key={`${msg.timestamp}-${i}`} className="text-sm leading-snug">
                    <span className={`font-semibold ${isMe ? 'text-white' : 'text-yellow-400'}`}>
                      {isMe ? 'You' : msg.username}
                    </span>
                    <span className="text-white/40 mx-1">:</span>
                    <span className="text-white/90 break-words">{msg.message}</span>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-white/[0.06]">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Esc to close)"
                maxLength={500}
                aria-label="Chat message"
                className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-base text-white placeholder:text-game-muted focus:border-game-blue focus:outline-none transition-colors"
              />
            </div>
          </motion.div>
        ) : (
          /* ─── Collapsed chat box ─── */
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleExpand}
            role="button"
            tabIndex={0}
            aria-label="Open team chat"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleExpand();
              }
            }}
            className="premium-panel group cursor-pointer transition-colors hover:border-white/25"
          >
            {/* Mini header */}
            <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/65 uppercase tracking-wider group-hover:text-white transition-colors">
                Chat
              </span>
              {unread > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[11px] rounded-full flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>

            {/* Preview messages */}
            <div className="px-3 py-2 min-h-[52px]">
              {previewMessages.length === 0 ? (
                <p className="text-xs text-white/60 italic">Tap to chat…</p>
              ) : (
                previewMessages.map((msg, i) => {
                  const isMe = msg.userId === user?.id;
                  return (
                    <div key={`${msg.timestamp}-${i}`} className="text-xs leading-relaxed truncate">
                      <span className={`font-semibold ${isMe ? 'text-white/80' : 'text-yellow-300/90'}`}>
                        {isMe ? 'You' : msg.username}
                      </span>
                      <span className="text-white/50 mx-0.5">:</span>
                      <span className="text-white/75">{msg.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

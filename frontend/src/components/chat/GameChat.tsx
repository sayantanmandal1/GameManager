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
            className="bg-game-card/95 backdrop-blur-sm border border-game-border rounded-xl flex flex-col overflow-hidden"
            style={{ height: '360px' }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-game-border flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Team Chat
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-game-muted hover:text-white text-xs px-2 py-1 rounded hover:bg-game-bg transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {messages.length === 0 && (
                <p className="text-xs text-game-muted text-center mt-8 opacity-60">
                  No messages yet
                </p>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.userId === user?.id;
                return (
                  <div key={`${msg.timestamp}-${i}`} className="text-sm leading-snug">
                    <span className={`font-semibold ${isMe ? 'text-primary' : 'text-yellow-400'}`}>
                      {isMe ? 'You' : msg.username}
                    </span>
                    <span className="text-game-muted mx-1">:</span>
                    <span className="text-white/90 break-words">{msg.message}</span>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-game-border">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Esc to close)"
                maxLength={500}
                className="w-full px-3 py-2 bg-game-bg/80 border border-game-border rounded-lg text-sm text-white placeholder-game-muted/60 focus:outline-none focus:border-primary transition-colors"
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
            className="bg-game-card/80 backdrop-blur-sm border border-game-border rounded-xl cursor-pointer hover:border-primary/50 transition-all group"
          >
            {/* Mini header */}
            <div className="px-3 py-1.5 border-b border-game-border/50 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-game-muted uppercase tracking-wider group-hover:text-primary transition-colors">
                Chat
              </span>
              {unread > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>

            {/* Preview messages */}
            <div className="px-3 py-2 min-h-[52px]">
              {previewMessages.length === 0 ? (
                <p className="text-[11px] text-game-muted/40 italic">Click to chat…</p>
              ) : (
                previewMessages.map((msg, i) => {
                  const isMe = msg.userId === user?.id;
                  return (
                    <div key={`${msg.timestamp}-${i}`} className="text-[11px] leading-relaxed truncate">
                      <span className={`font-semibold ${isMe ? 'text-primary/70' : 'text-yellow-400/70'}`}>
                        {isMe ? 'You' : msg.username}
                      </span>
                      <span className="text-game-muted/40 mx-0.5">:</span>
                      <span className="text-white/50">{msg.message}</span>
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

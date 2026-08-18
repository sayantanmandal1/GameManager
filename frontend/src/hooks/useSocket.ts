'use client';

import { useEffect, useState } from 'react';
import { connectSocket, isSocketConnected } from '@/lib/socket';
import { isTokenExpired, useAuthStore } from '@/stores/authStore';
import { AUTH_EVENTS, GAME_EVENTS, LOBBY_EVENTS } from '@/shared';

interface UseSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
}

export function useSocket(): UseSocketReturn {
  const { token, isAuthenticated, hasHydrated, renewSession } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !token) {
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    if (isTokenExpired(token)) {
      setIsConnected(false);
      setIsConnecting(true);
      void renewSession();
      return;
    }

    // Check if already connected
    if (isSocketConnected()) {
      setIsConnected(true);
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    const socket = connectSocket(token);

    const onConnect = () => {
      setIsConnected(true);
      setIsConnecting(false);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = () => {
      setIsConnecting(false);
      setIsConnected(false);
    };

    const onSessionInvalid = () => {
      setIsConnected(false);
      setIsConnecting(true);
      void renewSession();
    };

    const onGameStarting = (payload: { lobbyCode?: string }) => {
      if (/^\d{6}$/.test(payload.lobbyCode ?? '')) {
        socket.emit(GAME_EVENTS.REQUEST_STATE, { lobbyCode: payload.lobbyCode });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(AUTH_EVENTS.SESSION_INVALID, onSessionInvalid);
    socket.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);

    // If already connected immediately
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(AUTH_EVENTS.SESSION_INVALID, onSessionInvalid);
      socket.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
      // Don't disconnect on unmount — keep socket alive across pages
    };
  }, [hasHydrated, isAuthenticated, renewSession, token]);

  return { isConnected, isConnecting };
}

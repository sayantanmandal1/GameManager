'use client';

import { useEffect, useState, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket, isSocketConnected } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';

interface UseSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
}

export function useSocket(): UseSocketReturn {
  const { token, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setIsConnected(false);
      setIsConnecting(false);
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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // If already connected immediately
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      // Don't disconnect on unmount — keep socket alive across pages
    };
  }, [isAuthenticated, token]);

  return { isConnected, isConnecting };
}

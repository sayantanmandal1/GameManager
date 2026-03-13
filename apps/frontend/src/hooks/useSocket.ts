'use client';

import { useEffect } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';

export function useSocket() {
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && token && !getSocket()?.connected) {
      connectSocket(token);
    }

    return () => {
      // Don't disconnect on unmount — keep socket alive across pages
    };
  }, [isAuthenticated, token]);

  return getSocket();
}

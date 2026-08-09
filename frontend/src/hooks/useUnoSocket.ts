'use client';

import { useEffect } from 'react';
import { useUnoStore } from '@/stores/unoStore';

/**
 * Binds all uno:* socket events to the store for the given lobby and requests a
 * rejoin (or spectate) on mount. Components read state via useUnoStore(selector)
 * and mutate only through the store's typed actions.
 */
export function useUnoSocket(lobbyCode: string): void {
  const setLobbyCode = useUnoStore((s) => s.setLobbyCode);
  const initListeners = useUnoStore((s) => s.initListeners);

  useEffect(() => {
    if (!lobbyCode) return;
    setLobbyCode(lobbyCode);
    const cleanup = initListeners();
    return cleanup;
  }, [lobbyCode, setLobbyCode, initListeners]);
}

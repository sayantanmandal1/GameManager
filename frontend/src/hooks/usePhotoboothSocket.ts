'use client';

import { useEffect } from 'react';
import { usePhotoboothStore } from '@/stores/photoboothStore';

/**
 * Binds all photobooth:* socket events to the store for the given lobby and
 * requests fresh state on mount. Components read state via
 * `usePhotoboothStore(selector)` and mutate only through the store's typed
 * actions.
 */
export function usePhotoboothSocket(lobbyCode: string): void {
  const setLobbyCode = usePhotoboothStore((s) => s.setLobbyCode);
  const initListeners = usePhotoboothStore((s) => s.initListeners);

  useEffect(() => {
    if (!lobbyCode) return;
    setLobbyCode(lobbyCode);
    const cleanup = initListeners();
    return cleanup;
  }, [lobbyCode, setLobbyCode, initListeners]);
}

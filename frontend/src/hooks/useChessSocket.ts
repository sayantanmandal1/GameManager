'use client';

import { useEffect } from 'react';
import { useChessStore } from '@/stores/chessStore';

/**
 * Binds all chess:* socket events to the chess store for the given lobby,
 * and requests a rejoin on mount. Returns nothing — components read state
 * via `useChessStore(selector)`.
 *
 * SECURITY_NOTE: components MUST NOT call `socket.emit` directly. Use the
 * typed actions returned from `useChessStore` (sendResign / offerDraw / etc.).
 */
export function useChessSocket(lobbyCode: string): void {
  const setLobbyCode = useChessStore((s) => s.setLobbyCode);
  const initListeners = useChessStore((s) => s.initListeners);

  useEffect(() => {
    if (!lobbyCode) return;
    setLobbyCode(lobbyCode);
    const cleanup = initListeners();
    return cleanup;
  }, [lobbyCode, setLobbyCode, initListeners]);
}

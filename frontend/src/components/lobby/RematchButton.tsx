'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { LOBBY_EVENTS } from '@/shared';

interface RematchState {
  requestedBy: string[];
  required: number;
  starting?: boolean;
}

export function RematchButton({
  lobbyCode,
  className = '',
}: Readonly<{ lobbyCode: string; className?: string }>) {
  const userId = useAuthStore((state) => state.user?.id);
  const [state, setState] = useState<RematchState>({ requestedBy: [], required: 0 });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onState = (nextState: RematchState) => setState(nextState);
    socket.on(LOBBY_EVENTS.REMATCH_STATE, onState);
    return () => {
      socket.off(LOBBY_EVENTS.REMATCH_STATE, onState);
    };
  }, []);

  const requested = !!userId && state.requestedBy.includes(userId);
  const label = state.starting
    ? 'Starting rematch…'
    : requested
      ? `Waiting for players (${state.requestedBy.length}/${state.required})`
      : state.requestedBy.length > 0
        ? `Accept rematch (${state.requestedBy.length}/${state.required})`
        : 'Play again';

  return (
    <Button
      className={className}
      disabled={requested || state.starting}
      onClick={() => getSocket()?.emit(LOBBY_EVENTS.REMATCH_REQUEST, { lobbyCode })}
    >
      {label}
    </Button>
  );
}

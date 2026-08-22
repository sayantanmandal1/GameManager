'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { RematchButton } from '@/components/lobby/RematchButton';
import { useAuthStore } from '@/stores/authStore';
import { useDistinctGameStore } from '@/stores/distinctGameStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { DISTINCT_GAME_UI } from '@/lib/distinctGames';
import { LOBBY_EVENTS, isPartnershipGameKey, type DistinctGameKey } from '@/shared';
import { DistinctGameRenderer } from './DistinctGameRenderer';

interface DistinctGamePlayClientProps {
  readonly gameKey: DistinctGameKey;
  readonly code: string;
}

export function DistinctGamePlayClient({ gameKey, code }: DistinctGamePlayClientProps) {
  const router = useRouter();
  const ui = DISTINCT_GAME_UI[gameKey];
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { isConnected } = useSocket();
  const view = useDistinctGameStore((state) => state.view);
  const result = useDistinctGameStore((state) => state.result);
  const error = useDistinctGameStore((state) => state.error);
  const setSession = useDistinctGameStore((state) => state.setSession);
  const initListeners = useDistinctGameStore((state) => state.initListeners);
  const act = useDistinctGameStore((state) => state.act);
  const surrender = useDistinctGameStore((state) => state.surrender);
  const reset = useDistinctGameStore((state) => state.reset);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const isBridge = gameKey === 'contract-bridge';
  const hasIntegratedCardTable = isPartnershipGameKey(gameKey) || gameKey === 'hearts';

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push(`/games/${gameKey}`);
      return;
    }
    if (!isConnected) return;
    setSession(code, gameKey);
    return initListeners();
  }, [code, gameKey, hasHydrated, initListeners, isAuthenticated, isConnected, router, setSession]);
  useEffect(() => () => reset(), [reset]);

  if (!view) {
    return <main className="flex min-h-screen items-center justify-center"><p className="text-game-muted">{isConnected ? 'Restoring match...' : 'Reconnecting...'}</p></main>;
  }

  const finished = view.phase === 'finished' || !!result;
  let currentTurnId: string | null = null;
  if ('currentActorId' in view) currentTurnId = view.currentActorId;
  else if ('currentTurnId' in view) currentTurnId = view.currentTurnId;
  const current = view.players.find((player) => player.id === currentTurnId);
  const winnerId = result?.winnerId ?? view.winnerId;
  const winner = view.players.find((player) => player.id === winnerId);
  let statusText = current ? `Waiting for ${current.name}...` : 'Waiting for other players...';
  let statusClass = 'text-game-muted';
  if (view.canAct) {
    statusText = ui.prompt;
    statusClass = 'font-semibold';
  }
  if (finished) {
    const isDraw = result?.isDraw || ('isDraw' in view && view.isDraw);
    statusText = isDraw ? 'Draw game' : `${winner?.name ?? 'Player'} wins`;
    statusClass = 'text-lg font-bold';
  }

  const leaveTable = () => {
    const socket = getSocket();
    useLobbyStore.getState().reset();
    if (finished) {
      socket?.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
      reset();
      router.push(`/lobby/${code}`);
      return;
    }
    socket?.emit(LOBBY_EVENTS.LEAVE);
    reset();
    router.push(`/games/${gameKey}`);
  };

  return (
    <main className="min-h-screen px-4 py-4 text-white sm:px-6" style={{ backgroundColor: ui.surface }}>
      <div className={`mx-auto grid max-w-7xl gap-5 ${isBridge ? '' : 'lg:grid-cols-[minmax(0,1fr)_20rem]'}`}>
        <section className="flex min-w-0 flex-col items-center">
          <div className="mb-4 flex w-full max-w-[52rem] items-center justify-between gap-3 border-b border-white/10 pb-4">
            <button type="button" onClick={leaveTable} className="text-sm font-semibold text-game-muted hover:text-white">{finished ? 'Lobby' : 'Exit table'}</button>
            <div className="text-center"><p className="text-xs font-bold" style={{ color: ui.accent }}>{ui.name.toUpperCase()}</p><p className="text-sm text-game-muted">Room {code}</p></div>
            {!isBridge && <Button variant="ghost" size="sm" onClick={() => setConfirmSurrender(true)}>Resign</Button>}
          </div>

          {!hasIntegratedCardTable && <div className="mb-4 grid w-full max-w-[52rem] grid-cols-2 gap-3">
            {view.players.map((player) => (
              <div key={player.id} className={`border-b-2 px-3 py-2 ${player.id === currentTurnId && !finished ? 'border-white/55 bg-white/5' : 'border-white/10'}`}>
                <p className="truncate text-sm font-semibold">{player.name}{player.id === view.youId ? ' (you)' : ''}</p>
              </div>
            ))}
          </div>}

          <DistinctGameRenderer gameKey={gameKey} view={view} disabled={finished} onAction={act} />

          <div className="mt-5 min-h-16 text-center">
            <p className={statusClass}>{statusText}</p>
            {error && <p role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
            {finished && <RematchButton lobbyCode={code} className="mt-4" />}
          </div>
        </section>
        {!isBridge && <aside className="space-y-4"><VoiceChat roomId={code} /><GameChat lobbyCode={code} /></aside>}
      </div>

      {confirmSurrender && !isBridge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/12 bg-[#1c1f1b] p-6 text-center">
            <h2 className="text-xl font-bold">Resign this match?</h2>
            <p className="mt-2 text-sm text-game-muted">Your opponent will be awarded the win.</p>
            <div className="mt-5 flex justify-center gap-3"><Button variant="secondary" onClick={() => setConfirmSurrender(false)}>Cancel</Button><Button variant="danger" onClick={() => { surrender(); setConfirmSurrender(false); }}>Resign</Button></div>
          </div>
        </div>
      )}
    </main>
  );
}
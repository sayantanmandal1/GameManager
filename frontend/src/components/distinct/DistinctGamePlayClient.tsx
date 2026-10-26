'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PlayerName } from '@/components/ui/PlayerName';
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
  const isMonopoly = gameKey === 'monopoly';
  const hasIntegratedCardTable = isPartnershipGameKey(gameKey) || gameKey === 'hearts' || isMonopoly;
  const hasIntegratedWideSurface = isBridge || isMonopoly;

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
  const yourPlayerId = 'youId' in view ? view.youId : null;
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
  let gameLayoutClass = 'max-w-7xl lg:grid-cols-[minmax(0,1fr)_20rem]';
  if (hasIntegratedWideSurface) gameLayoutClass = isMonopoly ? 'max-w-[112rem]' : 'max-w-[100rem]';
  if (isBridge) gameLayoutClass = 'max-w-[100rem] lg:h-full';

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
    <main data-monopoly-play-shell={isMonopoly ? 'true' : undefined} className={`game-play-shell min-h-screen text-game-text ${isBridge ? 'px-3 py-3 sm:px-6 sm:py-4 lg:h-dvh lg:overflow-hidden lg:py-2' : isMonopoly ? 'px-0 py-0 sm:px-6 sm:py-3' : 'px-3 py-3 sm:px-6 sm:py-4'}`} style={{ '--table-accent': ui.accent } as CSSProperties}>
      <div className={`mx-auto grid gap-5 ${gameLayoutClass}`}>
        <section className={`flex min-w-0 flex-col items-center ${isBridge ? 'lg:h-full lg:min-h-0' : ''}`}>
          <div data-monopoly-game-header={isMonopoly ? 'true' : undefined} className={`glass-chrome flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 ${isMonopoly ? 'mb-0 max-w-[112rem] px-2 py-1.5 sm:mb-2 sm:px-3 sm:py-2' : `max-w-[56rem] px-3 py-2 ${isBridge ? 'mb-2' : 'mb-3 sm:mb-4'}`}`}>
            <button type="button" onClick={leaveTable} className="-ml-2 min-h-11 rounded-md px-2 text-sm font-semibold text-game-muted hover:bg-white/5 hover:text-white lg:min-h-0">{finished ? 'Lobby' : 'Exit table'}</button>
            <div className="min-w-0 text-center"><p className="truncate text-xs font-bold" style={{ color: ui.accent }}>{ui.name.toUpperCase()}</p><p className={`${isMonopoly ? 'text-[11px] uppercase' : 'text-sm'} text-game-muted`}>Room {code}</p></div>
            {!isBridge && <Button variant="ghost" size="sm" className="-mr-2 min-h-11 lg:min-h-9" onClick={() => setConfirmSurrender(true)}>Resign</Button>}
          </div>

          {!hasIntegratedCardTable && <div aria-label="Players" className="mb-3 flex w-full max-w-[52rem] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:mb-4 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0">
            {view.players.map((player) => (
              <div key={player.id} className={`min-w-[8.5rem] flex-1 shrink-0 rounded-2xl border px-4 py-3 sm:min-w-0 ${player.id === currentTurnId && !finished ? 'border-game-blue/40 bg-game-blue/10' : 'border-white/10 bg-game-card'}`}>
                <PlayerName name={player.name} isYou={player.id === yourPlayerId} className="text-sm font-semibold" />
              </div>
            ))}
          </div>}

          <div className={isBridge ? 'flex min-h-0 w-full flex-1 justify-center' : hasIntegratedCardTable || gameKey === 'bluff' ? 'contents' : 'premium-panel flex w-full min-w-0 justify-center p-3 sm:p-5'}>
            <DistinctGameRenderer gameKey={gameKey} view={view} disabled={finished} onAction={act} />
          </div>

          <div data-monopoly-game-status={isMonopoly ? 'true' : undefined} className={isBridge ? 'mt-1 min-h-6 text-center' : isMonopoly ? 'mt-2 min-h-7 text-center' : 'mt-3 min-h-10 text-center sm:mt-5 sm:min-h-16'}>
            {!isMonopoly && <p className={statusClass}>{statusText}</p>}
            {error && <p role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
            {finished && <RematchButton lobbyCode={code} className="mt-4" />}
          </div>
        </section>
        {!hasIntegratedWideSurface && <aside className="space-y-4"><VoiceChat roomId={code} /><GameChat lobbyCode={code} /></aside>}
      </div>

      <Modal isOpen={confirmSurrender && !isBridge} onClose={() => setConfirmSurrender(false)} title="Resign this match?">
        <p className="mt-2 text-sm text-game-muted">Your opponent will be awarded the win.</p>
        <div className="mt-5 flex justify-center gap-3"><Button variant="secondary" onClick={() => setConfirmSurrender(false)}>Cancel</Button><Button variant="danger" onClick={() => { surrender(); setConfirmSurrender(false); }}>Resign</Button></div>
      </Modal>
    </main>
  );
}
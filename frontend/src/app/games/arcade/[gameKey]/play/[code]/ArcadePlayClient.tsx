'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArcadeBoard } from '@/components/arcade/ArcadeBoard';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { Button } from '@/components/ui/Button';
import { RematchButton } from '@/components/lobby/RematchButton';
import { useAuthStore } from '@/stores/authStore';
import { useArcadeStore } from '@/stores/arcadeStore';
import { useSocket } from '@/hooks/useSocket';
import { useGameCatalog } from '@/hooks/useGameCatalog';
import { getSocket } from '@/lib/socket';
import { ArcadePhase, LOBBY_EVENTS } from '@/shared';

export default function ArcadePlayClient({ gameKey, code }: { gameKey: string; code: string }) {
  const router = useRouter();
  const { games } = useGameCatalog();
  const game = games.find((candidate) => candidate.key === gameKey);
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const { isConnected } = useSocket();
  const view = useArcadeStore((state) => state.view);
  const result = useArcadeStore((state) => state.result);
  const error = useArcadeStore((state) => state.error);
  const setLobbyCode = useArcadeStore((state) => state.setLobbyCode);
  const initListeners = useArcadeStore((state) => state.initListeners);
  const action = useArcadeStore((state) => state.action);
  const surrender = useArcadeStore((state) => state.surrender);
  const reset = useArcadeStore((state) => state.reset);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated || !code) {
      router.push('/games');
      return;
    }
    if (!isConnected) return;
    setLobbyCode(code);
    return initListeners();
  }, [code, hasHydrated, initListeners, isAuthenticated, isConnected, router, setLobbyCode]);

  useEffect(() => () => reset(), [reset]);

  const backToLobby = () => {
    getSocket()?.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
    reset();
    router.push(`/lobby/${code}`);
  };

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-game-mint border-t-transparent" />
          <p className="text-game-muted">{isConnected ? 'Restoring match…' : 'Reconnecting…'}</p>
        </div>
      </main>
    );
  }

  const finished = view.phase === ArcadePhase.FINISHED || !!result;
  const current = view.players.find((player) => player.id === view.currentTurn);
  const winner = view.players.find((player) => player.id === (result?.winnerId ?? view.winnerId));

  return (
    <main className="min-h-screen bg-[#111a17] px-4 py-4 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-w-0 flex-col items-center">
          <header className="mb-5 flex w-full items-center justify-between gap-4 border-b border-white/10 pb-4">
            <button onClick={backToLobby} className="text-sm font-semibold text-game-muted hover:text-white">Back to lobby</button>
            <div className="text-center">
              <p className="text-xs font-black uppercase text-game-mint">{view.family}</p>
              <h1 className="mt-1 text-xl font-black">{game?.name ?? gameKey}</h1>
              <p className="text-xs text-game-muted">Room {code}</p>
            </div>
            <Button size="sm" variant="ghost" disabled={finished} onClick={surrender}>Resign</Button>
          </header>

          <div className="mb-5 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            {view.players.map((player, index) => (
              <div key={player.id} className={`rounded-lg border p-3 ${player.id === view.currentTurn && !finished ? 'border-game-mint bg-game-mint/10' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="mb-2 h-2 rounded-full" style={{ backgroundColor: ['#ff795f', '#63d5a4', '#65aaf6', '#f2c94c'][index] }} />
                <p className="truncate text-sm font-bold">{player.name}{player.id === user?.id ? ' (you)' : ''}</p>
                {view.family === 'memory' && <p className="mt-1 text-xs text-game-muted">{player.score} pairs</p>}
              </div>
            ))}
          </div>

          <ArcadeBoard view={view} onAction={action} />

          <div className="mt-5 min-h-14 text-center">
            {finished ? (
              <p className="text-lg font-bold">{result?.isDraw || view.isDraw ? 'Draw game' : `${winner?.name ?? 'Player'} wins`}</p>
            ) : view.canAct ? (
              <p className="font-semibold">Your turn</p>
            ) : (
              <p className="text-game-muted">Waiting for {current?.name ?? 'opponent'}…</p>
            )}
            {error && <p role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
            {finished && <RematchButton lobbyCode={code} className="mt-4" />}
          </div>
        </section>

        <aside className="space-y-4">
          <VoiceChat roomId={code} />
          <GameChat lobbyCode={code} />
        </aside>
      </div>
    </main>
  );
}

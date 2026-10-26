'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { DISTINCT_GAME_UI } from '@/lib/distinctGames';
import { GameType, type DistinctGameKey } from '@/shared';
import { DistinctGamePreview } from './DistinctGamePreview';

export function DistinctGameLanding({ gameKey }: { gameKey: DistinctGameKey }) {
  const router = useRouter();
  const ui = DISTINCT_GAME_UI[gameKey];
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { lobby, createLobby, joinLobby, initListeners, reset, error, isLoading } = useLobbyStore();
  const { isConnected } = useSocket();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!isConnected) return;
    return initListeners();
  }, [hasHydrated, initListeners, isAuthenticated, isConnected, router]);
  useEffect(() => {
    if (lobby) router.push(`/lobby/${lobby.code}`);
  }, [lobby, router]);
  useEffect(() => () => reset(), [reset]);

  return (
    <main className="tabletop-scene flex min-h-[calc(100svh-4.5rem)] items-center px-5 py-12 sm:px-8 sm:py-20">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center">
        <section className="min-w-0 [overflow-wrap:anywhere]">
          <p className="eyebrow" style={{ color: ui.accent }}>{ui.eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] text-white sm:text-6xl">{ui.name}</h1>
          <p className="mt-5 max-w-2xl text-2xl font-medium leading-tight text-white/85">{ui.headline}</p>
          <p className="mt-5 max-w-xl text-base leading-8 text-game-muted">{ui.description}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button onClick={() => createLobby(GameType.DISTINCT, gameKey)} isLoading={isLoading}>Create online match</Button>
            <Button variant="secondary" onClick={() => setShowJoin(true)}>Join with code</Button>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        </section>
        <div className="premium-panel flex min-w-0 justify-center overflow-hidden bg-white/[0.025] p-5 sm:p-8"><DistinctGamePreview gameKey={gameKey} /></div>
      </div>

      <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title={`Join ${ui.name}`}>
        <div className="space-y-4">
          <Input label="Lobby code" inputMode="numeric" value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus />
          <Button className="w-full" disabled={joinCode.length !== 6} onClick={() => joinLobby(joinCode)}>Join match</Button>
        </div>
      </Modal>
    </main>
  );
}
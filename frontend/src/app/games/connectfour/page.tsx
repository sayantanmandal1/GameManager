'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { GameType } from '@/shared';

export default function ConnectFourLandingPage() {
  const router = useRouter();
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
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_25rem] lg:items-center">
        <section>
          <p className="text-sm font-bold text-game-sun">CONNECT FOUR</p>
          <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">Own the drop. Build the line.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-game-muted">
            A fast two-player strategy game with server-checked gravity and wins. Play online or challenge the local bot.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => createLobby(GameType.CONNECTFOUR)} isLoading={isLoading}>Create online match</Button>
            <Button variant="secondary" onClick={() => setShowJoin(true)}>Join with code</Button>
            <Button variant="ghost" onClick={() => router.push('/games/connectfour/bot')}>Play bot</Button>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        </section>

        <div className="grid aspect-[7/6] grid-cols-7 gap-2 rounded-lg border border-[#72a6ff] bg-[#315fbd] p-3 shadow-2xl" aria-hidden="true">
          {Array.from({ length: 42 }, (_, index) => {
            const red = [35, 37, 39, 30, 24].includes(index);
            const yellow = [36, 38, 31, 32].includes(index);
            return <div key={index} className={`aspect-square rounded-full border-2 ${red ? 'border-[#ff9b87] bg-[#f35f4a]' : yellow ? 'border-[#ffe388] bg-game-sun' : 'border-[#254d9e] bg-[#13241f]'}`} />;
          })}
        </div>
      </div>

      <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title="Join Connect Four">
        <div className="space-y-4">
          <Input
            label="Lobby code"
            inputMode="numeric"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            autoFocus
          />
          <Button className="w-full" disabled={joinCode.length !== 6} onClick={() => joinLobby(joinCode)}>Join match</Button>
        </div>
      </Modal>
    </main>
  );
}
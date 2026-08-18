'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { useGameCatalog } from '@/hooks/useGameCatalog';
import { GameType, type GameCatalogEntry } from '@/shared';

function ruleSummary(game: GameCatalogEntry): string {
  if (game.family === 'chess') {
    const timeControl = game.rules.timeControl as { baseMs: number; incrementMs: number } | null;
    if (!timeControl) return 'Untimed standard rules';
    const minutes = Math.floor(timeControl.baseMs / 60000);
    const increment = Math.floor(timeControl.incrementMs / 1000);
    return `${minutes} minute${minutes === 1 ? '' : 's'} + ${increment} second increment`;
  }
  if (game.family === 'uno') {
    const rules = game.rules.unoRules as { mode?: string; stacking?: boolean; sevenZero?: boolean };
    const details = [rules.mode ?? 'classic'];
    if (rules.stacking) details.push('stacking');
    if (rules.sevenZero) details.push('seven-zero');
    return details.join(' · ');
  }
  return `${game.minPlayers}-${game.maxPlayers} player table`;
}

export default function PresetGamePage() {
  const params = useParams<{ gameKey: string }>();
  const router = useRouter();
  const { games, isLoading: catalogLoading, error: catalogError } = useGameCatalog();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { isConnected } = useSocket();
  const lobby = useLobbyStore((state) => state.lobby);
  const lobbyError = useLobbyStore((state) => state.error);
  const isCreating = useLobbyStore((state) => state.isLoading);
  const createLobby = useLobbyStore((state) => state.createLobby);
  const initListeners = useLobbyStore((state) => state.initListeners);
  const reset = useLobbyStore((state) => state.reset);
  const [joinCode, setJoinCode] = useState('');
  const game = useMemo(
    () => games.find((candidate) => candidate.key === params.gameKey),
    [games, params.gameKey],
  );

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!isConnected) return;
    return initListeners();
  }, [initListeners, isConnected]);

  useEffect(() => {
    if (lobby) router.push(`/lobby/${lobby.code}`);
  }, [lobby, router]);

  useEffect(() => () => reset(), [reset]);

  const join = () => {
    if (/^\d{6}$/.test(joinCode)) router.push(`/lobby/${joinCode}`);
  };

  if (catalogLoading) {
    return <main className="flex min-h-[70vh] items-center justify-center text-game-muted">Loading game…</main>;
  }
  if (!game || game.gameType === GameType.ARCADE || game.gameType === GameType.SUDOKU) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white">Game unavailable</h1>
          <p className="mt-2 text-game-muted">{catalogError ?? 'This preset does not exist.'}</p>
          <Button className="mt-5" onClick={() => router.push('/games')}>Back to games</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <button type="button" className="text-sm font-semibold text-game-muted hover:text-white" onClick={() => router.push('/games')}>Back to catalog</button>
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-lg border border-white/12 p-6 sm:p-8" style={{ backgroundColor: game.surface }}>
            <div className="flex h-16 min-w-16 w-fit items-center justify-center rounded-lg px-3 text-2xl font-black text-[#141712]" style={{ backgroundColor: game.accent }}>{game.mark}</div>
            <p className="mt-8 text-xs font-black uppercase text-white/50">{game.category} · {game.minPlayers}-{game.maxPlayers} players</p>
            <h1 className="mt-2 text-4xl font-black text-white">{game.name}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-white/70">{game.description}</p>
            <div className="mt-6 rounded-lg border border-white/10 bg-black/15 p-4">
              <p className="text-xs font-black uppercase text-white/45">Locked preset</p>
              <p className="mt-1 font-semibold text-white">{ruleSummary(game)}</p>
            </div>
            <Button
              className="mt-8"
              disabled={!isConnected}
              isLoading={isCreating}
              onClick={() => void createLobby(game.gameType, game.key)}
            >
              Create multiplayer room
            </Button>
            {(game.family === 'chess' || game.family === 'uno') && (
              <button
                type="button"
                className="ml-4 mt-8 text-sm font-bold text-white/60 hover:text-white"
                onClick={() => router.push(`/games/${game.family}`)}
              >
                Customize rules
              </button>
            )}
            {!isConnected && <p className="mt-3 text-sm text-game-muted">Connecting to the game server…</p>}
            {lobbyError && <p role="alert" className="mt-3 text-sm text-red-300">{lobbyError}</p>}
          </section>

          <Card className="self-start">
            <p className="text-xs font-black text-game-coral">JOIN ANY GAME</p>
            <h2 className="mt-2 text-xl font-bold text-white">Enter a room code</h2>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && join()}
              inputMode="numeric"
              aria-label="Six digit room code"
              placeholder="000000"
              className="mt-5 h-14 w-full rounded-lg border border-white/15 bg-black/20 px-4 font-mono text-2xl font-black tracking-[0.2em] text-white outline-none focus:border-game-mint"
            />
            <Button className="mt-3 w-full" variant="secondary" disabled={joinCode.length !== 6} onClick={join}>Join room</Button>
          </Card>
        </div>
      </div>
    </main>
  );
}

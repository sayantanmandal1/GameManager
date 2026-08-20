'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { apiGet } from '@/lib/api';
import { parseGameCatalog } from '@/lib/gameCatalog';
import type { GameCatalogEntry } from '@/shared';

export default function GamesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const { isConnected } = useSocket();
  const [joinCode, setJoinCode] = useState('');
  const [games, setGames] = useState<GameCatalogEntry[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const controller = new AbortController();
    apiGet<unknown>('/games/catalog', controller.signal)
      .then((response) => {
        const catalog = parseGameCatalog(response);
        setGames(catalog.games);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(error instanceof Error ? error.message : 'Game catalog unavailable');
      });
    return () => controller.abort();
  }, [hasHydrated, isAuthenticated]);

  const join = () => {
    if (/^\d{6}$/.test(joinCode)) router.push(`/lobby/${joinCode}`);
  };
  const visibleGames = deferredSearch
    ? games.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(deferredSearch))
    : games;

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-game-coral">GAME ROOM</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Choose a table</h1>
            <p className="mt-2 text-game-muted">{user?.username}, your {games.length || 23} games are ready.</p>
          </div>
          <div className="flex w-full max-w-lg items-center gap-2 rounded-lg border border-white/12 bg-[#1b211d] p-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && join()}
              inputMode="numeric"
              aria-label="Join lobby code"
              placeholder="Enter 6-digit room code"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-lg font-bold text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-white/35"
            />
            <button
              type="button"
              disabled={joinCode.length !== 6}
              onClick={join}
              className="h-11 rounded-lg bg-[#f4f1e8] px-5 font-bold text-[#171912] disabled:opacity-35"
            >
              Join
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 text-xs text-game-muted">
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-game-mint' : 'bg-game-coral'}`} />
          {isConnected ? 'Connected' : 'Reconnecting'}
        </div>

        <div className="mb-6 flex items-center border-b border-white/15">
          <label htmlFor="game-search" className="sr-only">Search games</label>
          <input id="game-search" type="search" value={search} onChange={(event) => setSearch(event.target.value.slice(0, 60))} placeholder="Search the game shelf" className="h-12 w-full bg-transparent px-1 text-base font-semibold text-white outline-none placeholder:text-white/35" />
          <span className="text-xs font-bold text-game-muted">{visibleGames.length}/{games.length || 23}</span>
        </div>

        {catalogError && <p role="alert" className="mb-5 border-l-2 border-game-coral pl-3 text-sm text-red-200">{catalogError}</p>}
        {!catalogError && games.length === 0 && <p className="text-sm text-game-muted">Loading game library...</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleGames.map((game, index) => (
            <motion.button
              key={game.key}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.055 }}
              onClick={() => router.push(game.route)}
              className="group relative flex min-h-72 flex-col overflow-hidden rounded-lg border border-white/14 p-5 text-left shadow-xl shadow-black/15 transition-transform hover:-translate-y-1"
              style={{ backgroundColor: game.surface }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: game.accent }} />
              <div className="flex h-16 w-16 items-center justify-center rounded-lg text-3xl font-black text-[#141712]" style={{ backgroundColor: game.accent }}>
                {game.mark}
              </div>
              <div className="mt-auto pt-8">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-white">{game.name}</h2>
                  <span className="text-lg text-white/50" aria-hidden="true">→</span>
                </div>
                <p className="text-sm leading-5 text-white/65">{game.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </main>
  );
}

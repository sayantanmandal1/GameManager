'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { useGameCatalog } from '@/hooks/useGameCatalog';
import type { GameCategory } from '@/shared';

const CATEGORIES: Array<{ id: 'all' | GameCategory; label: string }> = [
  { id: 'all', label: 'All games' },
  { id: 'board', label: 'Board' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'cards', label: 'Cards' },
  { id: 'race', label: 'Race' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'party', label: 'Party' },
];

export default function GamesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const { isConnected } = useSocket();
  const { games, isLoading, error } = useGameCatalog();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | GameCategory>('all');
  const [joinCode, setJoinCode] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const multiplayerCount = games.filter((game) => game.minPlayers >= 2).length;

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);

  const filteredGames = useMemo(() => games.filter((game) => {
    if (category !== 'all' && game.category !== category) return false;
    if (!deferredSearch) return true;
    return `${game.name} ${game.description} ${game.family} ${game.category}`
      .toLowerCase()
      .includes(deferredSearch);
  }), [category, deferredSearch, games]);

  const join = () => {
    if (/^\d{6}$/.test(joinCode)) router.push(`/lobby/${joinCode}`);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-7 sm:px-6 md:py-10">
      <div className="mx-auto max-w-[90rem]">
        <header className="border-b border-white/10 pb-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-black text-game-coral">MULTIPLAYER LIBRARY</p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Choose a game</h1>
              <p className="mt-2 text-game-muted">
                {user?.username}, search {multiplayerCount || 100} multiplayer games plus solo Sudoku.
              </p>
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

          <div className="mt-7 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value.slice(0, 80))}
              aria-label="Search games"
              placeholder="Search by title, family, or description"
              className="h-12 w-full rounded-lg border border-white/12 bg-black/20 px-4 text-white outline-none focus:border-game-mint xl:max-w-md"
            />
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Game categories">
              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={category === item.id}
                  onClick={() => setCategory(item.id)}
                  className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-bold ${category === item.id ? 'border-game-mint bg-game-mint/15 text-white' : 'border-white/10 bg-white/[0.03] text-game-muted hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-5 flex items-center justify-between text-sm text-game-muted">
          <span>{isLoading ? 'Loading catalog…' : `${filteredGames.length} games`}</span>
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-game-mint' : 'bg-game-coral'}`} />
            {isConnected ? 'Connected' : 'Reconnecting'}
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-red-200">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredGames.map((game, index) => (
            <motion.button
              key={game.key}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 15) * 0.025 }}
              onClick={() => router.push(game.route)}
              className="group relative flex min-h-56 flex-col overflow-hidden rounded-lg border border-white/12 p-4 text-left shadow-lg shadow-black/15 transition enabled:hover:-translate-y-0.5 enabled:hover:border-white/25"
              style={{ backgroundColor: game.surface }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: game.accent }} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 min-w-12 items-center justify-center rounded-lg px-2 text-lg font-black text-[#141712]" style={{ backgroundColor: game.accent }}>
                  {game.mark}
                </div>
                <span className="rounded border border-white/10 bg-black/15 px-2 py-1 text-[10px] font-black uppercase text-white/55">
                  {game.category}
                </span>
              </div>
              <div className="mt-auto pt-6">
                <h2 className="text-lg font-black text-white">{game.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/62">{game.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-white/45">
                  <span>{game.minPlayers === 1 ? 'Solo' : `${game.minPlayers}-${game.maxPlayers} players`}</span>
                  <span className="font-bold text-white/70 group-hover:text-white">Open</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {!isLoading && filteredGames.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-xl font-bold text-white">No matching games</p>
            <button
              className="mt-3 text-sm font-semibold text-game-mint"
              onClick={() => {
                setSearch('');
                setCategory('all');
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

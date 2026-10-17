'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, Smartphone, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { apiGet } from '@/lib/api';
import { parseGameCatalog } from '@/lib/gameCatalog';
import { useIsNativeApp } from '@/lib/nativeApp';
import type { GameCatalogEntry } from '@/shared';

const APP_BANNER_DISMISSED_KEY = 'gameverse-app-banner-dismissed';

function playersLabel(game: GameCatalogEntry): string {
  if (game.maxPlayers <= 1) return 'Solo';
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} players`
    : `${game.minPlayers}–${game.maxPlayers} players`;
}

export default function GamesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const { isConnected } = useSocket();
  const inNativeApp = useIsNativeApp();
  const [joinCode, setJoinCode] = useState('');
  const [games, setGames] = useState<GameCatalogEntry[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    try {
      setBannerDismissed(window.localStorage.getItem(APP_BANNER_DISMISSED_KEY) === '1');
    } catch {
      setBannerDismissed(false);
    }
  }, []);

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
  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      window.localStorage.setItem(APP_BANNER_DISMISSED_KEY, '1');
    } catch {
      // Storage may be unavailable (private mode); dismissal still applies for this visit.
    }
  };
  const visibleGames = deferredSearch
    ? games.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(deferredSearch))
    : games;

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        {!inNativeApp && !bannerDismissed && (
          <section aria-label="GameVerse Android app" className="relative mb-6 flex items-center gap-3 overflow-hidden rounded-xl border border-game-mint/30 bg-[linear-gradient(110deg,#183a2c,#1b211d_55%,#2a2016)] p-3 pr-12 sm:gap-4 sm:p-4 sm:pr-14">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-game-mint text-[#11251b]" aria-hidden="true">
              <Smartphone className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-white sm:text-base">GameVerse is on Android</p>
              <p className="text-xs text-white/75 sm:text-sm">Every game, voice chat and live crossplay in one app.</p>
            </div>
            <Link href="/download" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-game-mint px-3 text-sm font-bold text-[#11251b] hover:bg-[#7ee0b7] sm:px-4">
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Get app</span>
            </Link>
            <button type="button" onClick={dismissBanner} aria-label="Dismiss app banner" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-white/65 hover:bg-white/5 hover:text-white">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        )}

        <div className="mb-6 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 sm:mb-8 sm:pb-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-game-coral">GAME ROOM</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Choose a table</h1>
            <p className="mt-2 text-game-muted">
              {games.length > 0 ? `${user?.username}, your ${games.length} games are ready.` : `${user?.username ?? 'Player'}, loading your games…`}
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

        <div className="mb-5 flex items-center gap-2 text-xs text-game-muted">
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-game-mint' : 'bg-game-coral'}`} />
          {isConnected ? 'Connected' : 'Reconnecting'}
        </div>

        <div className="mb-6 flex items-center border-b border-white/15">
          <label htmlFor="game-search" className="sr-only">Search games</label>
          <input id="game-search" type="search" value={search} onChange={(event) => setSearch(event.target.value.slice(0, 60))} placeholder="Search the game shelf" className="h-12 w-full bg-transparent px-1 text-base font-semibold text-white outline-none placeholder:text-white/50" />
          <span className="text-xs font-bold text-game-muted">{games.length > 0 ? `${visibleGames.length}/${games.length}` : '…'}</span>
        </div>

        {catalogError && <p role="alert" className="mb-5 border-l-2 border-game-coral pl-3 text-sm text-red-200">{catalogError}</p>}
        {!catalogError && games.length === 0 && <p className="text-sm text-game-muted">Loading game library...</p>}
        {games.length > 0 && visibleGames.length === 0 && <p className="text-sm text-game-muted">No games match “{search.trim()}”.</p>}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {visibleGames.map((game, index) => (
            <motion.button
              key={game.key}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.04 }}
              onClick={() => router.push(game.route)}
              className="group relative flex min-h-48 flex-col overflow-hidden rounded-lg border border-white/14 p-3.5 text-left shadow-xl shadow-black/15 transition-transform hover:-translate-y-1 sm:min-h-72 sm:p-5"
              style={{ backgroundColor: game.surface }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: game.accent }} />
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-black text-[#141712] sm:h-16 sm:w-16 sm:text-3xl" style={{ backgroundColor: game.accent }}>
                  {game.mark}
                </div>
                <span className="mt-1 text-right text-[11px] font-bold text-white/80 sm:text-xs">{playersLabel(game)}</span>
              </div>
              <div className="mt-auto pt-5 sm:pt-8">
                <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
                  <h2 className="text-base font-bold leading-tight text-white sm:text-xl">{game.name}</h2>
                  <span className="hidden text-lg text-white/60 sm:inline" aria-hidden="true">→</span>
                </div>
                <p className="line-clamp-3 text-xs leading-5 text-white/80 sm:text-sm">{game.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </main>
  );
}

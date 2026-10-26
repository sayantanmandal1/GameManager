'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Download, Globe, Mic, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { AppShowcase } from '@/components/download/AppShowcase';
import { useAuthStore } from '@/stores/authStore';
import { FEATURED_APP_GAMES, GAME_COUNT } from '@/lib/gameShowcase';
import { useIsNativeApp } from '@/lib/nativeApp';

const APP_HIGHLIGHTS = [
  { icon: Globe, text: 'Crossplay with friends on the web' },
  { icon: Mic, text: 'Built-in voice chat at every table' },
  { icon: RefreshCw, text: 'Rejoin your seat after a dropped signal' },
] as const;

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, login, isLoading, error } = useAuthStore();
  const inNativeApp = useIsNativeApp();
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [destination, setDestination] = useState('/games');

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.push(destination);
    }
  }, [destination, hasHydrated, isAuthenticated, router]);

  const handleLogin = async () => {
    if (!username.trim()) return;
    await login(username.trim());
  };

  const joinRoom = () => {
    if (!/^\d{6}$/.test(joinCode)) return;
    setDestination(`/lobby/${joinCode}`);
    setShowLogin(true);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-game-bg">
      <nav aria-label="Main navigation" className="glass-chrome relative z-20">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5">
            <Image src="/gameverse-mark.svg" alt="" width={32} height={32} priority />
            <span className="text-base font-semibold tracking-tight text-white">GameVerse</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-5">
            {!inNativeApp && <Link href="/download" aria-label="Get the Android app" className="hidden min-h-11 items-center gap-2 rounded-full px-3 text-sm text-game-muted transition-colors hover:text-white sm:inline-flex"><Smartphone className="h-4 w-4" aria-hidden="true" /><span>Get the Android app</span></Link>}
            <Button size="sm" variant="secondary" className="whitespace-nowrap text-xs sm:text-sm" onClick={() => setShowLogin(true)}>Enter GameVerse <ArrowUpRight className="hidden h-4 w-4 sm:block" aria-hidden="true" /></Button>
          </div>
        </div>
      </nav>
      <section className="tabletop-scene relative border-b border-white/[0.08]">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-6 pb-10 pt-16 sm:py-20 lg:min-h-[42rem] lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <motion.div className="min-w-0" initial={false} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-xs font-medium text-game-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-game-mint" aria-hidden="true" />{GAME_COUNT} multiplayer games
          </div>
          <h1 className="max-w-3xl text-[2.75rem] font-semibold leading-[1.02] text-white sm:text-6xl lg:text-[clamp(4rem,7vw,6.5rem)]">
            GameVerse
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-game-muted sm:text-xl">
            {GAME_COUNT} multiplayer games — Contract Bridge, Monopoly, UNO, Chess and more — around one live table on the web and Android.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() => setShowLogin(true)}
            >
              Enter GameVerse
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            {!inNativeApp && (
              <Link
                href="/download"
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.035] px-5 text-sm font-medium text-game-text transition-colors hover:bg-white/[0.08]"
              >
                <Smartphone className="h-5 w-5" aria-hidden="true" />
                Get the Android app
              </Link>
            )}
          </div>
          <div className="room-entry mt-6 max-w-md">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
              inputMode="numeric"
              aria-label="Join lobby code"
              placeholder="Enter room code"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-lg font-medium text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-game-muted"
            />
            <button
              type="button"
              disabled={joinCode.length !== 6}
              onClick={joinRoom}
              className="h-11 rounded-xl bg-white/[0.08] px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Join
            </button>
          </div>
        </motion.div>
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="hero-scene pointer-events-none" aria-hidden="true">
          <div className="hero-board">
            {Array.from({ length: 64 }, (_, index) => <span key={index} data-dark={(Math.floor(index / 8) + index % 8) % 2 === 0} />)}
          </div>
          <div className="hero-playing-card left-[7%] top-[12%] -rotate-[18deg] bg-[#f3eee5] text-[#1e2530]">♠</div>
          <div className="hero-playing-card bottom-[6%] right-[8%] rotate-[16deg] bg-[#597ab1] text-white">7</div>
          <div className="absolute right-[15%] top-[17%] flex h-16 w-16 rotate-12 items-center justify-center rounded-2xl border border-white/60 bg-[#f3eee5] text-5xl text-[#1e2530] shadow-2xl">⚄</div>
          <div className="absolute bottom-[13%] left-[14%] h-14 w-14 rounded-full border-[5px] border-[#c5f2e0] bg-[#6cbfa0] shadow-[0_12px_0_#397c65,0_25px_30px_#0008]" />
        </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20" aria-labelledby="game-shelf-title">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">LIVE TABLES</p>
            <h2 id="game-shelf-title" className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Pick your next game</h2>
          </div>
          <button onClick={() => setShowLogin(true)} className="min-h-11 text-sm font-semibold text-game-muted hover:text-white">
            View all {GAME_COUNT} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {FEATURED_APP_GAMES.map((game) => (
            <motion.button
              key={game.key}
              type="button"
              initial={false}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLogin(true)}
              className="game-tile group min-h-48 justify-between p-5"
              style={{ '--tile-accent': game.accent } as CSSProperties}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold text-[#171912] shadow-lg shadow-black/20"
                style={{ backgroundColor: game.accent }}
              >
                {game.mark}
              </span>
              <span>
                <span className="block font-display text-base font-semibold leading-tight text-white">{game.name}</span>
                <span className="mt-1.5 block text-xs text-game-muted">{game.players}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {!inNativeApp && (
        <section aria-labelledby="app-section-title" className="relative overflow-hidden border-t border-white/[0.08] bg-game-card/50">
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-game-mint/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-game-mint/35 bg-game-mint/10 px-3 py-1.5 text-xs font-black uppercase text-game-mint">
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> New · Android app
              </p>
              <h2 id="app-section-title" className="mt-5 max-w-md text-4xl font-semibold leading-[1.1] text-white sm:text-5xl">
                Take the whole table with you.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-white/80">
                Every GameVerse game in one free Android app — no ads, no sign-up, and the same rooms your friends play in on the web.
              </p>
              <ul className="mt-6 space-y-3">
                {APP_HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-white/85">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-game-mint/15 text-game-mint" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              <Link
                href="/download"
                className="mt-8 inline-flex min-h-14 items-center gap-2.5 rounded-2xl bg-game-mint px-6 text-sm font-semibold text-[#0f241a] transition-colors hover:bg-[#b1efd8]"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Download for Android
              </Link>
            </div>
            <AppShowcase />
          </div>
        </section>
      )}

      {/* Login Modal */}
      <Modal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        title="Choose your player name"
      >
        <div className="space-y-4">
          <Input
            label="Player name"
            placeholder="e.g. Alex"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            maxLength={20}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            className="w-full"
            onClick={handleLogin}
            isLoading={isLoading}
            disabled={!username.trim()}
          >
            Continue
          </Button>
        </div>
      </Modal>
    </main>
  );
}

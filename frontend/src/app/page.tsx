'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Download, Globe, Mic, RefreshCw, Smartphone } from 'lucide-react';
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
    <main className="min-h-screen overflow-hidden bg-[#101310]">
      <section className="tabletop-scene relative flex min-h-[82svh] items-center overflow-hidden border-b border-white/10 px-6 py-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <motion.div
            initial={{ opacity: 0, rotate: -18, x: 60 }}
            animate={{ opacity: 0.92, rotate: -12, x: 0 }}
            transition={{ duration: 0.8 }}
            className="tabletop-board absolute -right-20 top-12 hidden h-96 w-96 rounded-lg border-[10px] border-[#d7cfbc] lg:block"
          />
          <motion.div
            initial={{ opacity: 0, y: 60, rotate: 20 }}
            animate={{ opacity: 1, y: 0, rotate: 13 }}
            transition={{ delay: 0.2, duration: 0.65 }}
            className="scene-card absolute bottom-16 right-[24%] hidden h-44 w-28 rounded-lg border-[7px] border-white bg-[#e34242] p-3 text-center text-5xl font-black text-white md:block"
          >
            7
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.55 }}
            className="absolute bottom-24 left-[48%] hidden h-16 w-16 rounded-full border-[6px] border-[#fffdf8] bg-[#f2c94c] shadow-2xl md:block"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="relative z-10 mx-auto w-full max-w-7xl"
        >
          <img src="/gameverse-mark.svg" alt="" className="mb-6 h-14 w-14" />
          <h1 className="max-w-3xl text-5xl font-black leading-none text-white sm:text-6xl md:text-7xl">
            GameVerse
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-[#c9cec6]">
            {GAME_COUNT} multiplayer games — Contract Bridge, Monopoly, UNO, Chess and more — around one live table on the web and Android.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="bg-game-sun text-[#171912] hover:bg-[#ffdc63]"
              onClick={() => setShowLogin(true)}
            >
              Enter GameVerse
            </Button>
            {!inNativeApp && (
              <Link
                href="/download"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-game-mint/45 bg-game-mint/10 px-5 text-base font-bold text-game-mint transition-colors hover:bg-game-mint/20"
              >
                <Smartphone className="h-5 w-5" aria-hidden="true" />
                Get the Android app
              </Link>
            )}
          </div>
          <div className="mt-4 flex w-full max-w-md items-center gap-2 rounded-lg border border-white/12 bg-black/20 p-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
              inputMode="numeric"
              aria-label="Join lobby code"
              placeholder="Enter room code"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-lg font-bold text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-white/55"
            />
            <button
              type="button"
              disabled={joinCode.length !== 6}
              onClick={joinRoom}
              className="h-11 rounded-lg bg-white/10 px-4 text-sm font-bold text-white disabled:opacity-35"
            >
              Join
            </button>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12" aria-labelledby="game-shelf-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-game-mint">LIVE TABLES</p>
            <h2 id="game-shelf-title" className="mt-1 text-2xl font-bold text-white">Pick your next game</h2>
          </div>
          <button onClick={() => setShowLogin(true)} className="min-h-11 text-sm font-semibold text-game-muted hover:text-white">
            View all {GAME_COUNT} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {FEATURED_APP_GAMES.map((game, index) => (
            <motion.button
              key={game.key}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06 }}
              onClick={() => setShowLogin(true)}
              className="group flex min-h-36 flex-col justify-between rounded-lg border border-white/12 p-4 text-left shadow-xl shadow-black/10 hover:border-white/25"
              style={{ backgroundColor: game.surface }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-lg text-xl font-black text-[#171912]"
                style={{ backgroundColor: game.accent }}
              >
                {game.mark}
              </span>
              <span>
                <span className="block font-display text-lg font-bold leading-tight text-white">{game.name}</span>
                <span className="mt-0.5 block text-xs font-semibold text-white/75">{game.players}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {!inNativeApp && (
        <section aria-labelledby="app-section-title" className="relative overflow-hidden border-t border-white/10 bg-[#141813]">
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-game-mint/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-game-mint/35 bg-game-mint/10 px-3 py-1.5 text-xs font-black uppercase text-game-mint">
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> New · Android app
              </p>
              <h2 id="app-section-title" className="mt-4 text-3xl font-black text-white sm:text-4xl">
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
                className="mt-8 inline-flex min-h-14 items-center gap-2.5 rounded-xl bg-game-mint px-6 text-base font-black text-[#0f241a] shadow-[0_16px_40px_rgba(99,213,164,0.3)] transition hover:-translate-y-0.5 hover:bg-[#7ee0b7]"
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

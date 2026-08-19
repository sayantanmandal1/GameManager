'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

const GAME_PREVIEWS = [
  { name: 'Bingo', mark: '75', color: '#ff684d' },
  { name: 'Chess', mark: '♞', color: '#65aaf6' },
  { name: 'Ludo', mark: '●', color: '#63d5a4' },
  { name: 'UNO', mark: '7', color: '#f2c94c' },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, login, isLoading, error } = useAuthStore();
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
          <h1 className="max-w-3xl text-6xl font-black leading-none text-white md:text-7xl">
            GameVerse
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-[#c9cec6]">
            Bingo, chess, ludo, UNO and shared moments around one live table.
          </p>
          <Button
            size="lg"
            className="mt-9 bg-game-sun text-[#171912] hover:bg-[#ffdc63]"
            onClick={() => setShowLogin(true)}
          >
            Enter GameVerse
          </Button>
          <div className="mt-4 flex w-full max-w-md items-center gap-2 rounded-lg border border-white/12 bg-black/20 p-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
              inputMode="numeric"
              aria-label="Join lobby code"
              placeholder="Enter room code"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-lg font-bold text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-white/35"
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
          <button onClick={() => setShowLogin(true)} className="text-sm font-semibold text-game-muted hover:text-white">
            View all games <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {GAME_PREVIEWS.map((game, index) => (
            <motion.button
              key={game.name}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06 }}
              onClick={() => setShowLogin(true)}
              className="group flex min-h-36 flex-col justify-between rounded-lg border border-white/12 bg-[#1c1f1b] p-4 text-left shadow-xl shadow-black/10 hover:border-white/25"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-lg text-xl font-black text-[#171912]"
                style={{ backgroundColor: game.color }}
              >
                {game.mark}
              </span>
              <span className="font-display text-lg font-bold text-white">{game.name}</span>
            </motion.button>
          ))}
        </div>
      </section>

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

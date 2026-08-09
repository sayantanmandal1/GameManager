'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { GameType } from '@/shared';
import { photoboothStrings as S } from '@/components/photobooth';

export default function PhotoboothLandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { lobby, isLoading, createLobby, joinLobby, initListeners, error, reset } =
    useLobbyStore();
  const { isConnected } = useSocket();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!isConnected) return;
    const cleanup = initListeners();
    return cleanup;
  }, [isAuthenticated, isConnected, router, initListeners]);

  useEffect(() => {
    if (lobby) router.push(`/lobby/${lobby.code}`);
  }, [lobby, router]);

  useEffect(() => () => reset(), [reset]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50 p-6 text-zinc-700">
      {/* floating hearts */}
      {[...Array(6)].map((_, i) => (
        <span
          key={i}
          className="pb-heart pointer-events-none absolute text-2xl"
          style={{
            left: `${8 + i * 15}%`,
            bottom: '10%',
            animationDelay: `${i * 1.1}s`,
          }}
        >
          {['💗', '💕', '💞', '🩷', '💓', '💖'][i]}
        </span>
      ))}

      <div className="relative mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <span className="mb-3 block text-6xl">📸</span>
          <h1 className="font-serif text-5xl font-black text-rose-500">
            {S.landing.title}
          </h1>
          <p className="mt-2 text-zinc-500">{S.landing.subtitle}</p>
        </motion.div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            onClick={() => createLobby(GameType.PHOTOBOOTH)}
            className="flex flex-col items-center gap-2 rounded-3xl border border-rose-200/70 bg-white/70 p-8 text-center shadow-lg backdrop-blur transition hover:shadow-rose-200/60 disabled:opacity-60"
          >
            <span className="text-4xl">{isLoading ? '⏳' : '🏠'}</span>
            <h3 className="text-lg font-bold text-rose-500">
              {isLoading ? S.landing.creating : S.landing.createLobby}
            </h3>
            <p className="text-xs text-zinc-500">{S.landing.createDescription}</p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowJoin(true)}
            className="flex flex-col items-center gap-2 rounded-3xl border border-sky-200/70 bg-white/70 p-8 text-center shadow-lg backdrop-blur transition hover:shadow-sky-200/60"
          >
            <span className="text-4xl">🔗</span>
            <h3 className="text-lg font-bold text-sky-500">
              {S.landing.joinLobby}
            </h3>
            <p className="text-xs text-zinc-500">{S.landing.joinDescription}</p>
          </motion.button>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={() => router.push('/games')}
          className="mt-8 text-sm text-zinc-400 transition hover:text-zinc-600"
        >
          {S.landing.back}
        </button>
      </div>

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowJoin(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="mb-4 text-xl font-bold text-rose-500">
              {S.landing.joinModalTitle}
            </h2>
            <label className="mb-1 block text-sm font-medium text-zinc-500">
              {S.landing.joinCodeLabel}
            </label>
            <input
              autoFocus
              inputMode="numeric"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinCode.length === 6) joinLobby(joinCode);
              }}
              placeholder={S.landing.joinCodePlaceholder}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-zinc-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowJoin(false)}
                className="rounded-full px-5 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-600"
              >
                Cancel
              </button>
              <button
                disabled={joinCode.length !== 6}
                onClick={() => joinLobby(joinCode)}
                className="rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-6 py-2 text-sm font-bold text-white shadow-md transition hover:from-rose-500 hover:to-pink-500 disabled:opacity-50"
              >
                {S.landing.join}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

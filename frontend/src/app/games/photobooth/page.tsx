'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { GameType } from '@/shared';
import { photoboothStrings as S } from '@/components/photobooth';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function PhotoboothLandingPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { lobby, isLoading, createLobby, joinLobby, initListeners, error, reset } =
    useLobbyStore();
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
    const cleanup = initListeners();
    return cleanup;
  }, [hasHydrated, isAuthenticated, isConnected, router, initListeners]);

  useEffect(() => {
    if (lobby) router.push(`/lobby/${lobby.code}`);
  }, [lobby, router]);

  useEffect(() => () => reset(), [reset]);

  return (
    <main className="tabletop-scene relative flex min-h-[calc(100svh-4.5rem)] items-center overflow-hidden px-5 py-12 sm:py-20">
      {/* floating hearts */}
      {[...Array(6)].map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute text-2xl opacity-15"
          style={{
            left: `${8 + i * 15}%`,
            bottom: '10%',
            animationDelay: `${i * 1.1}s`,
          }}
        >
          {['💗', '💕', '💞', '🩷', '💓', '💖'][i]}
        </span>
      ))}

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <span className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-game-card text-5xl shadow-xl">📸</span>
          <h1 className="text-5xl font-semibold text-white sm:text-6xl">
            {S.landing.title}
          </h1>
          <p className="mt-4 text-game-muted">{S.landing.subtitle}</p>
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
            className="premium-panel flex flex-col items-center gap-3 p-8 text-center transition-colors hover:border-rose-300/40 disabled:opacity-60"
          >
            <span className="text-4xl">{isLoading ? '⏳' : '🏠'}</span>
            <h3 className="text-lg font-semibold text-rose-200">
              {isLoading ? S.landing.creating : S.landing.createLobby}
            </h3>
            <p className="text-sm leading-6 text-game-muted">{S.landing.createDescription}</p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowJoin(true)}
            className="premium-panel flex flex-col items-center gap-3 p-8 text-center transition-colors hover:border-game-blue/40"
          >
            <span className="text-4xl">🔗</span>
            <h3 className="text-lg font-semibold text-game-blue">
              {S.landing.joinLobby}
            </h3>
            <p className="text-sm leading-6 text-game-muted">{S.landing.joinDescription}</p>
          </motion.button>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={() => router.push('/games')}
          className="mt-8 inline-flex min-h-11 items-center rounded-xl px-4 text-sm text-game-muted transition-colors hover:bg-white/5 hover:text-white"
        >
          {S.landing.back}
        </button>
      </div>

      <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title={S.landing.joinModalTitle}>
        <Input
          label={S.landing.joinCodeLabel}
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
          className="text-center font-mono text-2xl tracking-[0.3em]"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setShowJoin(false)} variant="ghost">
            Cancel
          </Button>
          <Button disabled={joinCode.length !== 6} onClick={() => joinLobby(joinCode)}>
            {S.landing.join}
          </Button>
        </div>
      </Modal>
    </main>
  );
}

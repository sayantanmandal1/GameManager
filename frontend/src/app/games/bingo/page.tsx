'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { GameType } from '@/shared';

export default function BingoEntryPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { lobby, isLoading, createLobby, joinLobby, initListeners, error } = useLobbyStore();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const { isConnected } = useSocket();

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

  // Navigate to lobby when created/joined
  useEffect(() => {
    if (lobby) {
      router.push(`/lobby/${lobby.code}`);
    }
  }, [lobby, router]);

  return (
    <main className="tabletop-scene flex min-h-[calc(100svh-4.5rem)] items-center justify-center px-5 py-12 sm:py-20">
      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <span className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-game-card text-5xl shadow-xl">🎰</span>
          <h1 className="mb-4 text-5xl font-semibold text-white sm:text-6xl">Bingo</h1>
          <p className="text-game-muted">
            Classic number-calling game — be first to complete a pattern!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card
              hoverable
              glowing
              className="text-center"
              onClick={() => !isLoading && createLobby(GameType.BINGO)}
            >
              <div className="text-3xl mb-2">{isLoading ? '⏳' : '🏠'}</div>
              <h3 className="font-bold text-white mb-1">
                {isLoading ? 'Creating…' : 'Create Lobby'}
              </h3>
              <p className="text-xs text-white/40">
                Host a game and invite friends
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card
              hoverable
              className="text-center"
              onClick={() => setShowJoinModal(true)}
            >
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="font-bold text-white mb-1">Join Lobby</h3>
              <p className="text-xs text-white/40">
                Enter a code to join a game
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card
              hoverable
              className="text-center"
              onClick={() => router.push('/games/bingo/offline')}
            >
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-bold text-white mb-1">Play Offline</h3>
              <p className="text-xs text-white/40">
                Practice solo against auto-draw
              </p>
            </Card>
          </motion.div>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/games')}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            ← Back to Games
          </button>
        </div>

        {/* Join Modal */}
        <Modal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          title="Join a Lobby"
        >
          <div className="space-y-4">
            <Input
              label="Lobby Code"
              placeholder="Enter 6-digit code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinCode.length === 6) {
                  joinLobby(joinCode);
                  setShowJoinModal(false);
                }
              }}
              maxLength={6}
              autoFocus
            />
            <Button
              className="w-full"
              disabled={joinCode.length !== 6}
              onClick={() => {
                joinLobby(joinCode);
                setShowJoinModal(false);
              }}
            >
              Join Game
            </Button>
          </div>
        </Modal>
      </div>
    </main>
  );
}

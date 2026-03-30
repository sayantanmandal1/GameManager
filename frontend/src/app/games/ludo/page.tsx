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

export default function LudoEntryPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { lobby, isLoading, createLobby, joinLobby, initListeners, error } = useLobbyStore();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const { isConnected } = useSocket();

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
    if (lobby) {
      router.push(`/lobby/${lobby.code}`);
    }
  }, [lobby, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <span className="text-6xl mb-4 block">🎲</span>
          <h1 className="text-4xl font-black text-white mb-2">Ludo</h1>
          <p className="text-white/40">
            Race your tokens to the finish — strategy meets luck!
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
              onClick={() => !isLoading && createLobby(GameType.LUDO)}
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
              onClick={() => router.push('/games/ludo/offline')}
            >
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="font-bold text-white mb-1">Play Offline</h3>
              <p className="text-xs text-white/40">
                Play against AI bots
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
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            ← Back to Games
          </button>
        </div>

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

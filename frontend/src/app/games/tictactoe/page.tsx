'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { GameType, LOBBY_EVENTS, TicTacToeMode } from '@/shared';

const MODES = [
  {
    mode: TicTacToeMode.CLASSIC,
    name: 'Classic',
    description: 'Place marks until someone completes a row.',
  },
  {
    mode: TicTacToeMode.LIMITED,
    name: 'Three-piece',
    description: 'Place three marks, then move one each turn.',
  },
];

export default function TicTacToeLandingPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { lobby, joinLobby, initListeners, reset, error, isLoading } = useLobbyStore();
  const { isConnected } = useSocket();
  const [mode, setMode] = useState(TicTacToeMode.CLASSIC);
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!isConnected) return;
    return initListeners();
  }, [hasHydrated, isAuthenticated, isConnected, initListeners, router]);

  useEffect(() => {
    if (lobby) router.push(`/lobby/${lobby.code}`);
  }, [lobby, router]);

  useEffect(() => () => reset(), [reset]);

  const createOnline = () => {
    if (creating || isLoading) return;
    const socket = getSocket();
    if (!socket) return;
    setCreating(true);
    socket.emit(LOBBY_EVENTS.CREATE, {
      gameType: GameType.TICTACTOE,
      maxPlayers: 2,
      tictactoeMode: mode,
    });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_24rem] lg:items-center">
        <section>
          <p className="text-sm font-bold text-[#d7a7ff]">TIC TAC TOE</p>
          <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">Three cells. Two ways to play.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-game-muted">
            Challenge a friend online or play a local bot. Every online turn is checked by the server.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {MODES.map((option) => (
              <button
                key={option.mode}
                type="button"
                aria-pressed={mode === option.mode}
                onClick={() => setMode(option.mode)}
                className={`min-h-32 rounded-lg border p-4 text-left transition-colors ${
                  mode === option.mode
                    ? 'border-[#d7a7ff] bg-[#d7a7ff]/10'
                    : 'border-white/12 bg-[#1c1f1b] hover:border-white/25'
                }`}
              >
                <span className="font-display text-lg font-bold text-white">{option.name}</span>
                <span className="mt-2 block text-sm leading-5 text-game-muted">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={createOnline} isLoading={creating || isLoading}>
              Create online match
            </Button>
            <Button variant="secondary" onClick={() => setShowJoin(true)}>
              Join with code
            </Button>
            <Button variant="ghost" onClick={() => router.push(`/games/tictactoe/bot?mode=${mode}`)}>
              Play bot
            </Button>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        </section>

        <motion.div
          initial={{ opacity: 0, rotate: 3, y: 16 }}
          animate={{ opacity: 1, rotate: 0, y: 0 }}
          className="grid aspect-square grid-cols-3 gap-2 rounded-lg border border-white/12 bg-[#0d1715] p-3 shadow-2xl shadow-black/30"
          aria-hidden="true"
        >
          {['X', '', 'O', '', 'X', '', 'O', '', 'X'].map((value, index) => (
            <div key={index} className="flex items-center justify-center rounded-md bg-[#1b2925] text-5xl font-black text-[#ff795f]">
              <span className={value === 'O' ? 'text-game-mint' : ''}>{value}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title="Join Tic Tac Toe">
        <div className="space-y-4">
          <Input
            label="Lobby code"
            inputMode="numeric"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && joinCode.length === 6) joinLobby(joinCode);
            }}
            placeholder="000000"
            autoFocus
          />
          <Button className="w-full" disabled={joinCode.length !== 6} onClick={() => joinLobby(joinCode)}>
            Join match
          </Button>
        </div>
      </Modal>
    </main>
  );
}
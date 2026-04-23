'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { GameType, LOBBY_EVENTS, type TimeControl } from '@/shared';
import { getSocket } from '@/lib/socket';
import { chessStrings } from '@/components/chess/strings';

type TimeControlOption = {
  key: 'untimed' | 'blitz' | 'rapid' | 'classical';
  label: string;
  value: TimeControl | null;
};

const TIME_CONTROLS: TimeControlOption[] = [
  { key: 'untimed', label: chessStrings.timeControl.untimed, value: null },
  {
    key: 'blitz',
    label: chessStrings.timeControl.blitz,
    value: { baseMs: 5 * 60_000, incrementMs: 0 },
  },
  {
    key: 'rapid',
    label: chessStrings.timeControl.rapid,
    value: { baseMs: 10 * 60_000, incrementMs: 0 },
  },
  {
    key: 'classical',
    label: chessStrings.timeControl.classical,
    value: { baseMs: 15 * 60_000, incrementMs: 10_000 },
  },
];

export default function ChessLandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { lobby, isLoading, joinLobby, initListeners, error, reset } = useLobbyStore();
  const { isConnected } = useSocket();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [tcKey, setTcKey] = useState<TimeControlOption['key']>('rapid');
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    return () => reset();
  }, [reset]);

  const selectedTc = TIME_CONTROLS.find((t) => t.key === tcKey)!;

  // Chess lobbies require the timeControl to be forwarded; the lobby store's
  // generic `createLobby` doesn't accept it, so we emit directly via the
  // typed LOBBY_EVENTS.CREATE payload.
  const handleCreate = () => {
    if (creating || isLoading) return;
    const socket = getSocket();
    if (!socket) return;
    setCreating(true);
    socket.emit(LOBBY_EVENTS.CREATE, {
      gameType: GameType.CHESS,
      maxPlayers: 2,
      timeControl: selectedTc.value,
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <span className="text-6xl mb-4 block">♟️</span>
          <h1 className="text-4xl font-black text-white mb-2">{chessStrings.landing.title}</h1>
          <p className="text-white/40">{chessStrings.landing.subtitle}</p>
        </motion.div>

        {/* Time-control segmented control */}
        <fieldset
          className="mb-6 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl"
          data-testid="time-control-picker"
        >
          <legend className="px-2 text-xs uppercase tracking-wider text-white/40">
            {chessStrings.timeControl.pickerLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {TIME_CONTROLS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={tcKey === opt.key}
                data-testid={`tc-${opt.key}`}
                onClick={() => setTcKey(opt.key)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  tcKey === opt.key
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.03] text-white border-white/[0.06] hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card
              hoverable
              glowing
              className="text-center"
              onClick={handleCreate}
            >
              <div className="text-3xl mb-2">{creating || isLoading ? '⏳' : '🏠'}</div>
              <h3 className="font-bold text-white mb-1">
                {creating || isLoading
                  ? chessStrings.landing.creating
                  : chessStrings.landing.createLobby}
              </h3>
              <p className="text-xs text-white/40">{selectedTc.label}</p>
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
              <h3 className="font-bold text-white mb-1">{chessStrings.landing.joinLobby}</h3>
              <p className="text-xs text-white/40">{chessStrings.landing.joinDescription}</p>
            </Card>
          </motion.div>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/games')}
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            {chessStrings.landing.back}
          </button>
        </div>

        <Modal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          title={chessStrings.landing.joinModalTitle}
        >
          <div className="space-y-4">
            <Input
              label={chessStrings.landing.joinCodeLabel}
              placeholder={chessStrings.landing.joinCodePlaceholder}
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
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
              {chessStrings.landing.joinButton}
            </Button>
          </div>
        </Modal>
      </div>
    </main>
  );
}

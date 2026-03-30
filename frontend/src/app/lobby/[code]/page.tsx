'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LobbyPlayerCard } from '@/components/lobby/LobbyPlayer';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useGameStore } from '@/stores/gameStore';
import { useLudoStore } from '@/stores/ludoStore';
import { useSocket } from '@/hooks/useSocket';
import { LOBBY_EVENTS, GameType } from '@/shared';
import { getSocket } from '@/lib/socket';

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { isAuthenticated, user } = useAuthStore();
  const { lobby, joinLobby, leaveLobby, setReady, startGame, initListeners } =
    useLobbyStore();
  const { initListeners: initGameListeners, reset: resetGame } = useGameStore();
  const { initListeners: initLudoListeners, reset: resetLudo } = useLudoStore();
  const [copied, setCopied] = useState(false);
  const { isConnected } = useSocket();

  // Set up listeners and auto-rejoin lobby when socket is connected
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!isConnected) return;

    resetGame();
    resetLudo();

    const cleanupLobby = initListeners();
    const cleanupGame = initGameListeners();
    const cleanupLudo = initLudoListeners();

    // Re-join lobby to ensure socket is in the room (handles page refresh)
    joinLobby(code);

    // Listen for game starting to navigate
    const socket = getSocket();
    const onGameStarting = () => {
      const gameType = lobby?.gameType;
      if (gameType === GameType.LUDO) {
        router.push(`/games/ludo/play?lobby=${code}`);
      } else {
        router.push(`/games/bingo/play?lobby=${code}`);
      }
    };
    socket?.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);

    return () => {
      cleanupLobby();
      cleanupGame();
      cleanupLudo();
      socket?.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    };
  }, [isAuthenticated, isConnected, router, code, initListeners, initGameListeners, initLudoListeners, resetGame, resetLudo, joinLobby, lobby?.gameType]);

  const isHost = lobby?.hostId === user?.id;
  const currentPlayer = lobby?.players.find((p) => p.id === user?.id);
  const allReady = lobby?.players
    .filter((p) => !p.isHost)
    .every((p) => p.isReady);
  const canStart =
    isHost && allReady && (lobby?.players.length ?? 0) >= 2;

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    leaveLobby();
    const gameType = lobby?.gameType;
    if (gameType === GameType.LUDO) {
      router.push('/games/ludo');
    } else {
      router.push('/games/bingo');
    }
  };

  if (!lobby) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-game-muted">Connecting to lobby…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-game-muted text-sm mb-2">LOBBY CODE</p>
          <button
            onClick={copyCode}
            className="text-4xl font-mono font-black text-white tracking-[0.3em] hover:text-white transition-colors"
            title="Click to copy"
          >
            {code}
          </button>
          <p className="text-xs text-game-muted mt-1">
            {copied ? '✓ Copied!' : 'Click to copy'}
          </p>
        </motion.div>

        <div className="grid gap-6">
          {/* Players */}
          <Card>
            <h2 className="text-sm font-semibold text-game-muted uppercase tracking-wider mb-4">
              Players ({lobby.players.length}/{lobby.maxPlayers})
            </h2>
            <div className="space-y-2">
              <AnimatePresence>
                {lobby.players.map((player) => (
                  <LobbyPlayerCard
                    key={player.id}
                    player={player}
                    isCurrentUser={player.id === user?.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          </Card>

          {/* Voice Chat */}
          <VoiceChat roomId={code} />

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            {!isHost && currentPlayer && (
              <Button
                variant={currentPlayer.isReady ? 'secondary' : 'primary'}
                onClick={() => setReady(!currentPlayer.isReady)}
              >
                {currentPlayer.isReady ? 'Not Ready' : "I'm Ready"}
              </Button>
            )}

            {isHost && (
              <Button
                disabled={!canStart}
                onClick={startGame}
                className={canStart ? 'animate-pulse-glow' : ''}
              >
                {canStart ? '🚀 Start Game' : 'Waiting for players…'}
              </Button>
            )}

            <Button variant="danger" onClick={handleLeave}>
              Leave
            </Button>
          </div>

          {/* Team Chat */}
          <GameChat lobbyCode={code} />
        </div>
      </div>
    </main>
  );
}

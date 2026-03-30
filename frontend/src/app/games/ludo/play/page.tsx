'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { LudoBoard } from '@/components/ludo/LudoBoard';
import { LudoDice } from '@/components/ludo/LudoDice';
import { LudoPlayerPanel } from '@/components/ludo/LudoPlayerPanel';
import { LudoMoveSelector } from '@/components/ludo/LudoMoveSelector';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useLudoStore } from '@/stores/ludoStore';
import { useSocket } from '@/hooks/useSocket';
import { LudoGamePhase } from '@/shared';
import type { LudoMoveAction } from '@/shared';

function LudoPlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyCode = searchParams.get('lobby') || '';

  const { isAuthenticated, user } = useAuthStore();
  const {
    gameId,
    view,
    result,
    error,
    diceRolling,
    rollDice,
    moveToken,
    setLobbyCode,
    initListeners,
    reset,
  } = useLudoStore();
  const { isConnected } = useSocket();
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!lobbyCode || !isConnected) return;

    setLobbyCode(lobbyCode);
    const cleanup = initListeners();

    return () => {
      cleanup();
    };
  }, [isAuthenticated, isConnected, lobbyCode, router, setLobbyCode, initListeners]);

  // Win confetti
  useEffect(() => {
    if (result && result.winnerId === user?.id) {
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
    }
  }, [result, user?.id]);

  const handleMoveSelect = useCallback(
    (moves: LudoMoveAction[]) => {
      moveToken(moves);
      setSelectedTokenId(null);
    },
    [moveToken],
  );

  const handleBackToLobby = () => {
    reset();
    router.push(`/lobby/${lobbyCode}`);
  };

  if (!view) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading game…</p>
        </div>
      </main>
    );
  }

  const isMyTurn = view.isMyTurn;
  const isRollingPhase = view.phase === LudoGamePhase.ROLLING;
  const isMovingPhase = view.phase === LudoGamePhase.MOVING;
  const isFinished = view.phase === LudoGamePhase.FINISHED;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left: Game Board */}
        <div className="flex-1 flex flex-col items-center">
          {/* Turn indicator */}
          <motion.div
            key={view.currentTurn}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                isMyTurn
                  ? 'bg-white/20 text-white border border-white/50'
                  : 'bg-white/[0.03] text-white/40 border border-white/[0.06]'
              }`}
            >
              {isMyTurn
                ? isRollingPhase
                  ? '🎲 Your turn — Roll the dice!'
                  : '🎯 Pick a token to move'
                : `⏳ ${view.playerNames[view.currentTurn]}'s turn…`}
            </span>
          </motion.div>

          {/* Board */}
          <div className="relative">
            <LudoBoard
              players={view.players}
              myColor={view.myColor}
              currentTurn={view.currentTurn}
              availableMoves={isMovingPhase && isMyTurn ? view.availableMoves : null}
              onMoveSelect={handleMoveSelect}
              disabled={!isMyTurn || isRollingPhase || isFinished}
              selectedTokenId={selectedTokenId}
              onTokenSelect={setSelectedTokenId}
            />

            {/* Move selector popup */}
            <AnimatePresence>
              {selectedTokenId != null && view.availableMoves && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <LudoMoveSelector
                    moves={view.availableMoves}
                    tokenId={selectedTokenId}
                    onSelect={handleMoveSelect}
                    onCancel={() => setSelectedTokenId(null)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="w-full lg:w-80 space-y-4">
          {/* Dice */}
          <Card>
            <LudoDice
              dice={view.dice}
              isRolling={diceRolling}
              onRoll={rollDice}
              disabled={!isMyTurn || isFinished}
              isMyTurn={isMyTurn}
              showRollButton={isRollingPhase && !isFinished}
            />
          </Card>

          {/* Players */}
          <Card>
            <LudoPlayerPanel
              players={view.players}
              currentTurn={view.currentTurn}
              rankings={view.rankings}
              myPlayerId={user?.id}
            />
          </Card>

          {/* Voice */}
          <VoiceChat roomId={lobbyCode} />

          {/* Chat */}
          <GameChat lobbyCode={lobbyCode} />
        </div>
      </div>

      {/* Winner overlay */}
      <AnimatePresence>
        {isFinished && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center max-w-md mx-4"
            >
              <div className="text-6xl mb-4">
                {result.winnerId === user?.id ? '🏆' : '🎮'}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {result.winnerId === user?.id
                  ? 'You Win!'
                  : `${result.winnerName} Wins!`}
              </h2>

              {/* Rankings */}
              <div className="mt-4 space-y-1">
                {result.rankings.map((pid, idx) => (
                  <div
                    key={pid}
                    className={`text-sm ${
                      idx === 0 ? 'text-yellow-400 font-bold' : 'text-white/40'
                    }`}
                  >
                    {['🏆', '🥈', '🥉', '4th'][idx]} {view.playerNames[pid]}
                    {pid === user?.id ? ' (you)' : ''}
                  </div>
                ))}
              </div>

              <Button
                className="mt-6"
                onClick={handleBackToLobby}
              >
                Back to Lobby
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function LudoPlayPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading game…</p>
        </div>
      </main>
    }>
      <LudoPlayContent />
    </Suspense>
  );
}

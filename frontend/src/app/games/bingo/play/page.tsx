'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { BingoBoard } from '@/components/bingo/BingoBoard';
import { NumberDisplay } from '@/components/bingo/NumberDisplay';
import { Button } from '@/components/ui/Button';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';
import { BingoGamePhase } from '@/shared';

function BingoPlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyCode = searchParams.get('lobby') || '';

  const { isAuthenticated, user } = useAuthStore();
  const {
    gameId,
    view,
    result,
    nextPlaceNumber,
    placeNumber,
    chooseNumber,
    backToLobby,
    setLobbyCode,
    initListeners,
    reset,
  } = useGameStore();
  useSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    // Set lobby code first, then init listeners
    setLobbyCode(lobbyCode);
  }, [isAuthenticated, router, lobbyCode, setLobbyCode]);

  useEffect(() => {
    if (!isAuthenticated || !lobbyCode) return;
    const cleanup = initListeners();
    return cleanup;
  }, [isAuthenticated, lobbyCode, initListeners]);

  // Confetti on game result
  useEffect(() => {
    if (result) {
      const isWinner = result.winnerId === user?.id;
      confetti({
        particleCount: isWinner ? 200 : 50,
        spread: isWinner ? 120 : 60,
        origin: { y: 0.6 },
        colors: isWinner
          ? ['#6366f1', '#ec4899', '#fbbf24', '#34d399']
          : ['#6366f1', '#94a3b8'],
      });
    }
  }, [result, user?.id]);

  const handleBackToLobby = () => {
    backToLobby();
    reset();
    router.push(`/lobby/${lobbyCode}`);
  };

  if (!view) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-game-muted">Loading game…</p>
        </div>
      </main>
    );
  }

  const isSetupPhase = view.phase === BingoGamePhase.SETUP;
  const isPlayPhase = view.phase === BingoGamePhase.PLAYING;
  const isFinished = view.phase === BingoGamePhase.FINISHED;
  const isMyTurn = view.currentTurn === user?.id;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* ──────── SETUP PHASE ──────── */}
        {isSetupPhase && (
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-white mb-2"
            >
              Set Up Your Board
            </motion.h1>
            <p className="text-game-muted mb-1">
              Place numbers 1–25 on your board. Click any empty cell to place{' '}
              <span className="text-primary font-bold">{nextPlaceNumber > 25 ? '✓' : nextPlaceNumber}</span>
            </p>
            <p className="text-xs text-game-muted mb-6">
              {view.isSetupDone
                ? 'Waiting for opponent to finish…'
                : view.opponentSetupDone
                  ? 'Opponent is ready! Finish placing your numbers.'
                  : 'Both players are setting up…'}
            </p>

            <BingoBoard
              board={view.board}
              onCellClick={!view.isSetupDone ? (r, c) => placeNumber(r, c) : undefined}
              nextPlaceNumber={nextPlaceNumber <= 25 ? nextPlaceNumber : undefined}
              disabled={view.isSetupDone}
              label="Your Board"
            />
          </div>
        )}

        {/* ──────── PLAY PHASE & FINISHED ──────── */}
        {(isPlayPhase || isFinished) && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px_1fr] gap-6">
            {/* Left: My board */}
            <BingoBoard
              board={view.board}
              disabled
              label="Your Board"
            />

            {/* Center: Number picker & info */}
            <div className="space-y-4">
              <NumberDisplay
                chosenNumbers={view.chosenNumbers}
                isMyTurn={isMyTurn}
                onChooseNumber={(num) => chooseNumber(num)}
                completedLines={view.completedLines}
                userId={user?.id || ''}
                players={view.players}
                disabled={isFinished}
              />

              {/* Voice chat */}
              <VoiceChat roomId={lobbyCode} />
            </div>

            {/* Right: Opponent board */}
            {view.opponentBoard && (
              <BingoBoard
                board={view.opponentBoard}
                disabled
                label="Opponent's Board"
              />
            )}
          </div>
        )}

        {/* ──────── WINNER OVERLAY ──────── */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="text-center p-8 bg-game-card border border-game-border rounded-2xl max-w-sm">
              <div className="text-6xl mb-4">
                {result.winnerId === user?.id ? '🏆' : '😢'}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {result.winnerId === user?.id ? 'YOU WON!' : 'Game Over'}
              </h2>
              <p className="text-game-muted mb-4">
                {result.winnerId === user?.id
                  ? 'You completed BINGO first!'
                  : 'Your opponent completed BINGO first.'}
              </p>
              <div className="mt-4 flex gap-3 justify-center">
                <Button onClick={handleBackToLobby}>
                  🔄 Back to Lobby
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function BingoPlayPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <BingoPlayContent />
    </Suspense>
  );
}

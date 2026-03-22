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
    randomizeBoard,
    chooseNumber,
    backToLobby,
    setLobbyCode,
    initListeners,
    reset,
  } = useGameStore();
  const { isConnected } = useSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    setLobbyCode(lobbyCode);
  }, [isAuthenticated, router, lobbyCode, setLobbyCode]);

  useEffect(() => {
    if (!isAuthenticated || !lobbyCode || !isConnected) return;
    const cleanup = initListeners();
    return cleanup;
  }, [isAuthenticated, lobbyCode, isConnected, initListeners]);

  // Confetti on game result
  useEffect(() => {
    if (result) {
      const isWinner = result.winnerId === user?.id;
      if (isWinner) {
        // Big celebration for winner
        const end = Date.now() + 3000;
        const fire = () => {
          confetti({
            particleCount: 100,
            spread: 120,
            origin: { x: Math.random(), y: Math.random() * 0.6 },
            colors: ['#6366f1', '#ec4899', '#fbbf24', '#34d399'],
          });
          if (Date.now() < end) requestAnimationFrame(fire);
        };
        fire();
      } else {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#94a3b8'],
        });
      }
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
  const lastCalledNumber = view.chosenNumbers.length > 0
    ? view.chosenNumbers[view.chosenNumbers.length - 1]
    : undefined;

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
            <p className="text-xs text-game-muted mb-4">
              {view.isSetupDone
                ? 'Waiting for opponent to finish…'
                : view.opponentSetupDone
                  ? 'Opponent is ready! Finish placing your numbers.'
                  : 'Both players are setting up…'}
            </p>

            {/* Random button */}
            {!view.isSetupDone && (
              <div className="mb-6">
                <Button onClick={randomizeBoard} variant="secondary">
                  🎲 Randomize Board
                </Button>
              </div>
            )}

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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-w-3xl mx-auto">
            {/* Left: My board only */}
            <BingoBoard
              board={view.board}
              disabled
              label="Your Board"
              lastCalledNumber={lastCalledNumber}
            />

            {/* Right: Number picker & info */}
            <div className="space-y-4">
              <NumberDisplay
                chosenNumbers={view.chosenNumbers}
                calledBy={view.calledBy}
                isMyTurn={isMyTurn}
                onChooseNumber={(num) => chooseNumber(num)}
                myCompletedLines={view.myCompletedLines}
                userId={user?.id || ''}
                playerNames={view.playerNames}
                disabled={isFinished}
              />

              {/* Voice chat */}
              <VoiceChat roomId={lobbyCode} />
            </div>
          </div>
        )}

        {/* ──────── WINNER OVERLAY ──────── */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="text-center p-8 bg-game-card border border-game-border rounded-2xl max-w-sm"
            >
              <div className="text-6xl mb-4">
                {result.winnerId === user?.id ? '🏆' : '😢'}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {result.winnerId === user?.id ? 'YOU WON!' : 'Game Over'}
              </h2>
              <p className="text-lg text-game-muted mb-1">
                <span className="text-primary font-bold">{result.winnerName}</span> completed BINGO!
              </p>
              <p className="text-sm text-game-muted mb-6">
                {result.winnerId === user?.id
                  ? 'Amazing strategy! You outsmarted your opponent.'
                  : 'Better luck next time — every loss is a lesson.'}
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleBackToLobby}>
                  🔄 Back to Lobby
                </Button>
              </div>
            </motion.div>
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

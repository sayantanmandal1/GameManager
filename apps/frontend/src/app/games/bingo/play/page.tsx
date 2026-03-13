'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { BingoBoard } from '@/components/bingo/BingoBoard';
import { NumberDisplay } from '@/components/bingo/NumberDisplay';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';

function BingoPlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyCode = searchParams.get('lobby') || '';

  const { isAuthenticated, user } = useAuthStore();
  const { gameId, view, result, claimRejected, markNumber, claimBingo, initListeners, reset } =
    useGameStore();
  useSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    const cleanup = initListeners();
    return () => {
      cleanup();
    };
  }, [isAuthenticated, router, initListeners]);

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

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Left: Board */}
          <div>
            <BingoBoard
              board={view.board}
              currentNumber={view.currentNumber}
              onMarkNumber={(num) => markNumber(num)}
              disabled={!!result}
            />

            {/* Claim BINGO button */}
            {!result && (
              <div className="mt-6 text-center">
                <Button
                  size="lg"
                  className="text-xl px-10"
                  onClick={() => claimBingo(lobbyCode)}
                >
                  🎉 BINGO!
                </Button>
                {claimRejected && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-400"
                  >
                    {claimRejected}
                  </motion.p>
                )}
              </div>
            )}
          </div>

          {/* Right: Number display & info */}
          <div className="space-y-6">
            <NumberDisplay
              currentNumber={view.currentNumber}
              calledNumbers={view.calledNumbers}
            />

            {/* Players */}
            <div className="bg-game-card border border-game-border rounded-xl p-4">
              <h3 className="text-xs text-game-muted uppercase tracking-wider mb-2">
                Players
              </h3>
              <div className="space-y-1">
                {view.players.map((pid) => (
                  <div
                    key={pid}
                    className={`text-sm px-2 py-1 rounded ${
                      pid === user?.id ? 'text-primary font-bold' : 'text-game-muted'
                    }`}
                  >
                    {pid === user?.id ? `${user.username} (you)` : pid.slice(0, 8)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Winner overlay */}
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
              <p className="text-game-muted mb-1">
                {result.winnerId === user?.id
                  ? `Pattern: ${result.pattern}`
                  : `${result.winnerId.slice(0, 8)}… won with ${result.pattern}`}
              </p>
              <div className="mt-6 flex gap-3 justify-center">
                <Button onClick={() => router.push('/games/bingo')}>
                  New Game
                </Button>
                <Button variant="secondary" onClick={() => router.push('/games')}>
                  Games
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

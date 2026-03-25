'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { LudoBoard } from '@/components/ludo/LudoBoard';
import { LudoDice } from '@/components/ludo/LudoDice';
import { LudoPlayerPanel } from '@/components/ludo/LudoPlayerPanel';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  playDiceRoll,
  playTokenMove,
  playWin,
} from '@/lib/sounds';
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
    surrender,
    setLobbyCode,
    initListeners,
    reset,
  } = useLudoStore();
  const { isConnected } = useSocket();
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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

  // Win confetti + sound
  useEffect(() => {
    if (result && result.winnerId === user?.id) {
      playWin();
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
    }
  }, [result, user?.id]);

  // Surrender on browser close / refresh / tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameId && view && view.phase !== LudoGamePhase.FINISHED) {
        surrender();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gameId, view, surrender]);

  const handleRollDice = useCallback(() => {
    playDiceRoll();
    rollDice();
  }, [rollDice]);

  const handleMoveSelect = useCallback(
    (moves: LudoMoveAction[]) => {
      playTokenMove();
      moveToken(moves);
      setSelectedTokenId(null);
    },
    [moveToken],
  );

  const handleBackToLobby = () => {
    reset();
    router.push(`/lobby/${lobbyCode}`);
  };

  // Auto-move when only 1 option available
  useEffect(() => {
    if (!view || !view.isMyTurn || view.phase !== LudoGamePhase.MOVING) return;
    if (!view.availableMoves || view.availableMoves.length !== 1) return;
    const timer = setTimeout(() => {
      handleMoveSelect(view.availableMoves![0]);
    }, 350);
    return () => clearTimeout(timer);
  }, [view?.availableMoves, view?.isMyTurn, view?.phase, handleMoveSelect]);

  const handleSurrenderAndLeave = () => {
    surrender();
    setShowLeaveConfirm(false);
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
                  ? 'bg-primary/20 text-primary border border-primary/50'
                  : 'bg-game-card text-game-muted border border-game-border'
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
              onRoll={handleRollDice}
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

          {/* Leave / Surrender */}
          {!isFinished && (
            <Button
              className="w-full bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30"
              onClick={() => setShowLeaveConfirm(true)}
            >
              🚪 Back to Lobby
            </Button>
          )}
        </div>
      </div>

      {/* Leave confirmation modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-6 text-center max-w-sm mx-4 shadow-2xl"
            >
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Leave Game?</h3>
              <p className="text-game-muted text-sm mb-5">
                Leaving will count as a surrender. Your opponent will be declared the winner.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  className="bg-white/[0.05] border border-white/[0.1] text-white/50 hover:text-white"
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleSurrenderAndLeave}
                >
                  Surrender & Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-8 text-center max-w-md mx-4 shadow-2xl"
            >
              <div className="text-6xl mb-4">
                {result.winnerId === user?.id ? '🏆' : '🎮'}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {result.winnerId === user?.id
                  ? 'You Win!'
                  : `${result.winnerName} Wins!`}
              </h2>
              {result.surrenderedBy && (
                <p className="text-game-muted text-sm mb-1">
                  {result.surrenderedBy === user?.id
                    ? 'You surrendered'
                    : `${view.playerNames[result.surrenderedBy] || 'Opponent'} surrendered`}
                </p>
              )}

              {/* Rankings */}
              <div className="mt-4 space-y-1">
                {result.rankings.map((pid, idx) => (
                  <div
                    key={pid}
                    className={`text-sm ${
                      idx === 0 ? 'text-yellow-400 font-bold' : 'text-game-muted'
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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-game-muted">Loading game…</p>
        </div>
      </main>
    }>
      <LudoPlayContent />
    </Suspense>
  );
}

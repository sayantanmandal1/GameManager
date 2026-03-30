'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { LudoBoard } from '@/components/ludo/LudoBoard';
import { LudoDice } from '@/components/ludo/LudoDice';
import { LudoPlayerPanel } from '@/components/ludo/LudoPlayerPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  playDiceRoll,
  playTokenMove,
  playTokenCapture,
  playTokenHome,
  playWin,
  playSixRoll,
  playTurnSkip,
} from '@/lib/sounds';
import {
  LudoGamePhase,
  LUDO_TOKENS_PER_PLAYER,
} from '@/shared';
import type {
  LudoGameState,
  LudoPlayerView,
  LudoMoveAction,
} from '@/shared';
import { LudoEngine } from '@/lib/ludo/ludo.engine';
import { chooseBestMove } from '@/lib/ludo/ludo.bot';

type SetupConfig = {
  playerCount: 2 | 3 | 4;
  botCount: number;
};

const engine = new LudoEngine();

export default function OfflineLudoPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [state, setState] = useState<LudoGameState | null>(null);
  const [view, setView] = useState<LudoPlayerView | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [surrendered, setSurrendered] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const humanId = 'human-player';

  // Initialize the game when config is set
  useEffect(() => {
    if (!config || state) return;

    const playerIds = [humanId];
    const playerNames: Record<string, string> = { [humanId]: 'You' };
    const botIds: string[] = [];
    const botNames = ['🤖 Bot Alpha', '🤖 Bot Beta', '🤖 Bot Gamma'];

    for (let i = 0; i < config.botCount; i++) {
      const botId = `bot-${i}`;
      playerIds.push(botId);
      playerNames[botId] = botNames[i];
      botIds.push(botId);
    }

    const newState = engine.initGame(playerIds, playerNames, botIds);
    setState(newState);
    setView(engine.getPlayerView(newState, humanId));
  }, [config, state]);

  // Handle bot turns — step-by-step with visible dice animation
  const runBotTurn = useCallback(() => {
    if (!state || state.phase === LudoGamePhase.FINISHED) return;
    const currentPlayer = state.players[state.currentTurn];
    if (!currentPlayer?.isBot) return;
    const botId = currentPlayer.id;

    // Step 1: Show dice rolling animation
    setDiceRolling(true);
    playDiceRoll();

    setTimeout(() => {
      // Step 2: Actually roll the dice
      setState((prev) => {
        if (!prev || prev.phase === LudoGamePhase.FINISHED) return prev;
        const stateCopy: LudoGameState = JSON.parse(JSON.stringify(prev));
        const rollResult = engine.rollDice(stateCopy, botId);
        setDiceRolling(false);
        setView(engine.getPlayerView(stateCopy, humanId));

        if (!rollResult.valid || rollResult.turnCanceled || rollResult.turnSkipped) {
          if (rollResult.turnSkipped || rollResult.turnCanceled) {
            playTurnSkip();
          }
          return stateCopy;
        }

        if (rollResult.dice === 6) {
          playSixRoll();
        }

        // Step 3: After a delay, execute the best move
        setTimeout(() => {
          setState((prev2) => {
            if (!prev2 || prev2.phase === LudoGamePhase.FINISHED) return prev2;
            const stateCopy2: LudoGameState = JSON.parse(JSON.stringify(prev2));
            const bestMove = chooseBestMove(stateCopy2, botId);
            if (bestMove.length === 0) return stateCopy2;

            const moveResult = engine.moveToken(stateCopy2, botId, bestMove);
            if (!moveResult.valid) return stateCopy2;

            playTokenMove();
            if (moveResult.captures && moveResult.captures.length > 0) {
              playTokenCapture();
            }
            if (moveResult.reachedHome) {
              playTokenHome();
            }

            setView(engine.getPlayerView(stateCopy2, humanId));

            if (moveResult.winner) {
              setWinner(moveResult.winner.winnerId);
              if (moveResult.winner.winnerId === humanId) {
                playWin();
                confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
              }
            }

            return stateCopy2;
          });
        }, 500);

        return stateCopy;
      });
    }, 600);
  }, [state]);

  // Check if it's a bot's turn and schedule auto-play
  useEffect(() => {
    if (!state || state.phase === LudoGamePhase.FINISHED) return;
    const currentPlayer = state.players[state.currentTurn];
    if (currentPlayer?.isBot) {
      botTimerRef.current = setTimeout(() => {
        runBotTurn();
      }, 800);
      return () => {
        if (botTimerRef.current) clearTimeout(botTimerRef.current);
      };
    }
  }, [state?.currentTurn, state?.phase, runBotTurn, state]);

  const handleRollDice = useCallback(() => {
    if (!state || state.currentTurn !== humanId) return;
    setDiceRolling(true);
    playDiceRoll();

    setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev;
        const stateCopy: LudoGameState = JSON.parse(JSON.stringify(prev));
        const result = engine.rollDice(stateCopy, humanId);
        setDiceRolling(false);
        setView(engine.getPlayerView(stateCopy, humanId));

        if (result.turnSkipped || result.turnCanceled) {
          playTurnSkip();
        } else if (result.dice === 6) {
          playSixRoll();
        }

        return stateCopy;
      });
    }, 600);
  }, [state]);

  const handleMoveSelect = useCallback(
    (moves: LudoMoveAction[]) => {
      if (!state) return;

      setState((prev) => {
        if (!prev) return prev;
        const stateCopy: LudoGameState = JSON.parse(JSON.stringify(prev));
        const result = engine.moveToken(stateCopy, humanId, moves);

        if (result.valid) {
          setView(engine.getPlayerView(stateCopy, humanId));
          setSelectedTokenId(null);
          playTokenMove();

          if (result.captures && result.captures.length > 0) {
            playTokenCapture();
          }
          if (result.reachedHome) {
            playTokenHome();
          }

          if (result.winner) {
            setWinner(result.winner.winnerId);
            if (result.winner.winnerId === humanId) {
              playWin();
              confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            }
          }
        }

        return stateCopy;
      });
    },
    [state],
  );

  // Auto-move when only 1 option available
  useEffect(() => {
    if (!view || !view.isMyTurn || view.phase !== LudoGamePhase.MOVING) return;
    if (!view.availableMoves || view.availableMoves.length !== 1) return;
    const timer = setTimeout(() => {
      handleMoveSelect(view.availableMoves![0]);
    }, 350);
    return () => clearTimeout(timer);
  }, [view?.availableMoves, view?.isMyTurn, view?.phase, handleMoveSelect]);

  const handleNewGame = () => {
    setConfig(null);
    setState(null);
    setView(null);
    setWinner(null);
    setSelectedTokenId(null);
    setSurrendered(false);
    setShowLeaveConfirm(false);
  };

  const handleSurrenderAndLeave = () => {
    if (state && state.phase !== LudoGamePhase.FINISHED) {
      const stateCopy: LudoGameState = JSON.parse(JSON.stringify(state));
      const result = engine.surrender(stateCopy, humanId);
      if (result.valid && result.winner) {
        setState(stateCopy);
        setView(engine.getPlayerView(stateCopy, humanId));
        setWinner(result.winner.winnerId);
        setSurrendered(true);
      }
    }
    setShowLeaveConfirm(false);
    router.push('/games/ludo');
  };

  // Setup screen — must be AFTER all hooks
  if (!config) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <button
            onClick={() => router.push('/games/ludo')}
            className="text-sm text-white/40 hover:text-white transition-colors mb-6 block"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-black text-white mb-2 text-center">🎲 Offline Ludo</h1>
          <p className="text-white/40 text-center mb-8">
            Play against AI bots
          </p>

          <div className="space-y-4">
            {[2, 3, 4].map((count) => (
              <Card
                key={count}
                hoverable
                className="text-center"
                onClick={() => {
                  setConfig({
                    playerCount: count as 2 | 3 | 4,
                    botCount: count - 1,
                  });
                }}
              >
                <h3 className="font-bold text-white text-lg mb-1">
                  {count} Players
                </h3>
                <p className="text-sm text-white/40">
                  You + {count - 1} Bot{count > 2 ? 's' : ''}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!state || !view) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const isMyTurn = view.isMyTurn;
  const isRollingPhase = view.phase === LudoGamePhase.ROLLING;
  const isMovingPhase = view.phase === LudoGamePhase.MOVING;
  const isFinished = view.phase === LudoGamePhase.FINISHED;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/games/ludo')}
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <Button variant="secondary" size="sm" onClick={handleNewGame}>
            New Game
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Board */}
          <div className="flex-1 flex flex-col items-center">
            <motion.div
              key={view.currentTurn}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <span
                className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                  isMyTurn
                    ? 'bg-white/[0.08] text-white border border-white/20'
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
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
            <Card>
              <LudoDice
                dice={view.dice}
                isRolling={diceRolling}
                onRoll={handleRollDice}
                disabled={!isMyTurn || isFinished}
                isMyTurn={isMyTurn}
                showRollButton={isRollingPhase && isMyTurn && !isFinished}
              />
            </Card>

            <Card>
              <LudoPlayerPanel
                players={view.players}
                currentTurn={view.currentTurn}
                rankings={view.rankings}
                myPlayerId={humanId}
              />
            </Card>

            {/* Leave / Surrender */}
            {!isFinished && (
              <Button
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white/40 hover:bg-white/[0.08] hover:text-white"
                onClick={() => setShowLeaveConfirm(true)}
              >
                🚪 Back to Menu
              </Button>
            )}
          </div>
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
              <p className="text-white/40 text-sm mb-5">
                Leaving will end the current game. Your progress will be lost.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  className="bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white"
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-white hover:bg-white/90 text-black"
                  onClick={handleSurrenderAndLeave}
                >
                  Leave Game
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner overlay */}
      <AnimatePresence>
        {isFinished && winner && (
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
                {winner === humanId ? '🏆' : '🎮'}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {winner === humanId
                  ? 'You Win!'
                  : `${state.players[winner]?.username} Wins!`}
              </h2>

              <div className="mt-4 space-y-1">
                {view.rankings.map((pid, idx) => (
                  <div
                    key={pid}
                    className={`text-sm ${
                      idx === 0 ? 'text-white font-bold' : 'text-white/40'
                    }`}
                  >
                    {['🏆', '🥈', '🥉', '4th'][idx]} {state.players[pid]?.username}
                    {pid === humanId ? ' (you)' : ''}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-center mt-6">
                <Button onClick={handleNewGame}>Play Again</Button>
                <Button variant="secondary" onClick={() => router.push('/games/ludo')}>
                  Back
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

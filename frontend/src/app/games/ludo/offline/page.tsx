'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { LudoBoard } from '@/components/ludo/LudoBoard';
import { LudoDice } from '@/components/ludo/LudoDice';
import { LudoPlayerPanel } from '@/components/ludo/LudoPlayerPanel';
import { LudoMoveSelector } from '@/components/ludo/LudoMoveSelector';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const humanId = 'human-player';

  // Setup screen
  if (!config) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <button
            onClick={() => router.push('/games/ludo')}
            className="text-sm text-game-muted hover:text-white transition-colors mb-6 block"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-black text-white mb-2 text-center">🎲 Offline Ludo</h1>
          <p className="text-game-muted text-center mb-8">
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
                <p className="text-sm text-game-muted">
                  You + {count - 1} Bot{count > 2 ? 's' : ''}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
  }

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

  // Handle bot turns
  const runBotTurn = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.phase === LudoGamePhase.FINISHED) return prev;
      const currentPlayer = prev.players[prev.currentTurn];
      if (!currentPlayer?.isBot) return prev;

      // Deep copy state for mutation
      const stateCopy: LudoGameState = JSON.parse(JSON.stringify(prev));
      engine.executeBotTurn(stateCopy, stateCopy.currentTurn);

      setView(engine.getPlayerView(stateCopy, humanId));

      if (stateCopy.winnerId) {
        setWinner(stateCopy.winnerId);
        if (stateCopy.winnerId === humanId) {
          confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
        }
      }

      return stateCopy;
    });
  }, []);

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

    setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev;
        const stateCopy: LudoGameState = JSON.parse(JSON.stringify(prev));
        const result = engine.rollDice(stateCopy, humanId);
        setDiceRolling(false);
        setView(engine.getPlayerView(stateCopy, humanId));

        if (result.turnSkipped || result.turnCanceled) {
          // Turn was skipped — check if next is bot
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

          if (result.winner) {
            setWinner(result.winner.winnerId);
            if (result.winner.winnerId === humanId) {
              confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            }
          }
        }

        return stateCopy;
      });
    },
    [state],
  );

  const handleNewGame = () => {
    setConfig(null);
    setState(null);
    setView(null);
    setWinner(null);
    setSelectedTokenId(null);
  };

  if (!state || !view) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
            className="text-sm text-game-muted hover:text-white transition-colors"
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
          </div>
        </div>
      </div>

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
              className="bg-game-card border border-game-border rounded-2xl p-8 text-center max-w-md mx-4"
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
                      idx === 0 ? 'text-yellow-400 font-bold' : 'text-game-muted'
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

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TicTacToeBoard } from '@/components/tictactoe/TicTacToeBoard';
import { Button } from '@/components/ui/Button';
import { TicTacToeMode, TicTacToePhase, type TicTacToeGameState } from '@/shared';
import {
  applyLocalTicTacToeAction,
  chooseTicTacToeBotAction,
  createLocalTicTacToe,
} from '@/lib/tictactoe/localGame';

function BotGame() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get('mode') === TicTacToeMode.LIMITED
    ? TicTacToeMode.LIMITED
    : TicTacToeMode.CLASSIC;
  const [game, setGame] = useState<TicTacToeGameState>(() => createLocalTicTacToe(mode));
  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const botTurn = game.currentTurnId === 'bot' && game.phase === TicTacToePhase.PLAYING;

  useEffect(() => {
    setGame(createLocalTicTacToe(mode));
    setSelectedFrom(null);
  }, [mode]);

  useEffect(() => {
    if (!botTurn) return;
    const timer = setTimeout(() => {
      setGame((current) => {
        const action = chooseTicTacToeBotAction(current);
        return action ? applyLocalTicTacToeAction(current, 'bot', action).state : current;
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [botTurn, game.plyCount]);

  const handleCell = (index: number) => {
    if (game.currentTurnId !== 'human' || game.phase !== TicTacToePhase.PLAYING) return;
    const humanMark = 'X';
    const mustMove = mode === TicTacToeMode.LIMITED && game.board.filter((cell) => cell === humanMark).length >= 3;
    if (!mustMove) {
      const next = applyLocalTicTacToeAction(game, 'human', { to: index });
      if (next.valid) setGame(next.state);
      return;
    }
    if (game.board[index] === humanMark) {
      setSelectedFrom(index);
      return;
    }
    if (game.board[index] === null && selectedFrom !== null) {
      const next = applyLocalTicTacToeAction(game, 'human', { from: selectedFrom, to: index });
      if (next.valid) {
        setGame(next.state);
        setSelectedFrom(null);
      }
    }
  };

  const restart = () => {
    setGame(createLocalTicTacToe(mode));
    setSelectedFrom(null);
  };

  const humanMustMove = mode === TicTacToeMode.LIMITED && game.board.filter((cell) => cell === 'X').length >= 3;
  return (
    <main className="min-h-screen bg-[#111a17] px-4 py-6 text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <div className="mb-6 flex w-full max-w-[34rem] items-center justify-between gap-4">
          <button onClick={() => router.push('/games/tictactoe')} className="text-sm font-semibold text-game-muted hover:text-white">← Modes</button>
          <div className="text-center">
            <p className="text-xs font-bold text-[#d7a7ff]">BOT MATCH</p>
            <h1 className="mt-1 text-xl font-bold">{mode === TicTacToeMode.LIMITED ? 'Three-piece' : 'Classic'}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={restart}>Restart</Button>
        </div>

        <div className="mb-4 grid w-full max-w-[34rem] grid-cols-2 gap-3">
          <div className={`rounded-lg border p-3 ${game.currentTurnId === 'human' ? 'border-[#ff795f] bg-[#ff795f]/10' : 'border-white/10'}`}>
            <span className="text-2xl font-black text-[#ff795f]">X</span>
            <p className="text-sm font-semibold">You</p>
          </div>
          <div className={`rounded-lg border p-3 ${game.currentTurnId === 'bot' ? 'border-game-mint bg-game-mint/10' : 'border-white/10'}`}>
            <span className="text-2xl font-black text-game-mint">O</span>
            <p className="text-sm font-semibold">Bot</p>
          </div>
        </div>

        <TicTacToeBoard
          board={game.board}
          winningLine={game.winningLine}
          selectedFrom={selectedFrom}
          disabled={game.phase === TicTacToePhase.FINISHED || botTurn}
          onCellClick={handleCell}
        />

        <div className="mt-5 min-h-14 text-center">
          {game.phase === TicTacToePhase.FINISHED ? (
            <>
              <p className="text-xl font-bold">{game.isDraw ? 'Draw game' : game.winnerId === 'human' ? 'You win' : 'Bot wins'}</p>
              <Button className="mt-3" onClick={restart}>Play again</Button>
            </>
          ) : botTurn ? (
            <p className="text-game-muted">Bot is thinking…</p>
          ) : (
            <p className="font-semibold">{humanMustMove ? selectedFrom === null ? 'Select one of your marks' : 'Choose an empty destination' : 'Your turn'}</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function TicTacToeBotPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#111a17]" />}><BotGame /></Suspense>;
}
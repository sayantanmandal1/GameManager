'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectFourBoard } from '@/components/connectfour/ConnectFourBoard';
import { Button } from '@/components/ui/Button';
import { CONNECT_FOUR_COLUMNS, ConnectFourPhase, type ConnectFourGameState } from '@/shared';
import {
  applyLocalConnectFourDrop,
  chooseConnectFourBotColumn,
  createLocalConnectFour,
  validConnectFourColumns,
} from '@/lib/connectfour/localGame';

export default function ConnectFourBotPage() {
  const router = useRouter();
  const [game, setGame] = useState<ConnectFourGameState>(() => createLocalConnectFour());
  const botTurn = game.currentTurnId === 'bot' && game.phase === ConnectFourPhase.PLAYING;

  useEffect(() => {
    if (!botTurn) return;
    const timer = setTimeout(() => {
      setGame((current) => {
        const column = chooseConnectFourBotColumn(current);
        return column === null ? current : applyLocalConnectFourDrop(current, 'bot', column).state;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [botTurn, game.lastMove]);

  const lastMoveIndex = game.lastMove
    ? game.lastMove.row * CONNECT_FOUR_COLUMNS + game.lastMove.column
    : null;
  const restart = () => setGame(createLocalConnectFour());

  return (
    <main className="min-h-screen bg-[#111923] px-4 py-5 text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <div className="mb-5 flex w-full max-w-[43rem] items-center justify-between gap-4">
          <button onClick={() => router.push('/games/connectfour')} className="text-sm font-semibold text-game-muted hover:text-white">← Modes</button>
          <div className="text-center"><p className="text-xs font-bold text-game-sun">BOT MATCH</p><h1 className="text-xl font-bold">Connect Four</h1></div>
          <Button variant="ghost" size="sm" onClick={restart}>Restart</Button>
        </div>
        <div className="mb-3 grid w-full max-w-[43rem] grid-cols-2 gap-3">
          <div className={`flex items-center gap-3 rounded-lg border p-3 ${game.currentTurnId === 'human' ? 'border-[#f35f4a]' : 'border-white/10'}`}><span className="h-7 w-7 rounded-full bg-[#f35f4a]" /><span className="font-semibold">You</span></div>
          <div className={`flex items-center gap-3 rounded-lg border p-3 ${game.currentTurnId === 'bot' ? 'border-game-sun' : 'border-white/10'}`}><span className="h-7 w-7 rounded-full bg-game-sun" /><span className="font-semibold">Bot</span></div>
        </div>
        <ConnectFourBoard
          board={game.board}
          validColumns={validConnectFourColumns(game)}
          winningCells={game.winningCells}
          lastMoveIndex={lastMoveIndex}
          canAct={game.currentTurnId === 'human' && game.phase === ConnectFourPhase.PLAYING}
          onDrop={(column) => {
            const next = applyLocalConnectFourDrop(game, 'human', column);
            if (next.valid) setGame(next.state);
          }}
        />
        <div className="mt-5 min-h-14 text-center">
          {game.phase === ConnectFourPhase.FINISHED ? (
            <><p className="text-xl font-bold">{game.isDraw ? 'Draw game' : game.winnerId === 'human' ? 'You win' : 'Bot wins'}</p><Button className="mt-3" onClick={restart}>Play again</Button></>
          ) : botTurn ? <p className="text-game-muted">Bot is calculating…</p> : <p className="font-semibold">Choose a column</p>}
        </div>
      </div>
    </main>
  );
}
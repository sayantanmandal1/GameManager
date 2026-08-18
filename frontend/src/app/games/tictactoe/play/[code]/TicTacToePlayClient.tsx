'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TicTacToeBoard } from '@/components/tictactoe/TicTacToeBoard';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { Button } from '@/components/ui/Button';
import { RematchButton } from '@/components/lobby/RematchButton';
import { useAuthStore } from '@/stores/authStore';
import { useTicTacToeStore } from '@/stores/tictactoeStore';
import { useSocket } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { LOBBY_EVENTS, TicTacToeMode, TicTacToePhase } from '@/shared';

export default function TicTacToePlayClient({ code }: { code: string }) {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { isConnected } = useSocket();
  const view = useTicTacToeStore((state) => state.view);
  const result = useTicTacToeStore((state) => state.result);
  const error = useTicTacToeStore((state) => state.error);
  const setLobbyCode = useTicTacToeStore((state) => state.setLobbyCode);
  const initListeners = useTicTacToeStore((state) => state.initListeners);
  const move = useTicTacToeStore((state) => state.move);
  const surrender = useTicTacToeStore((state) => state.surrender);
  const reset = useTicTacToeStore((state) => state.reset);
  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated || !code) {
      router.push('/games/tictactoe');
      return;
    }
    if (!isConnected) return;
    setLobbyCode(code);
    return initListeners();
  }, [code, hasHydrated, initListeners, isAuthenticated, isConnected, router, setLobbyCode]);

  useEffect(() => () => reset(), [reset]);

  const handleCell = (index: number) => {
    if (!view?.canAct || view.phase !== TicTacToePhase.PLAYING) return;
    const mark = view.board[index];
    if (!view.mustMovePiece) {
      if (!mark) move({ to: index });
      return;
    }
    if (mark === view.yourMark) {
      setSelectedFrom(index);
      return;
    }
    if (!mark && selectedFrom !== null) {
      move({ from: selectedFrom, to: index });
      setSelectedFrom(null);
    }
  };

  const backToLobby = () => {
    getSocket()?.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
    reset();
    router.push(`/lobby/${code}`);
  };

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-game-mint border-t-transparent" />
          <p className="text-game-muted">{isConnected ? 'Restoring match…' : 'Reconnecting…'}</p>
        </div>
      </main>
    );
  }

  const current = view.players.find((player) => player.id === view.currentTurnId);
  const winner = view.players.find((player) => player.id === (result?.winnerId ?? view.winnerId));
  const finished = view.phase === TicTacToePhase.FINISHED || !!result;

  return (
    <main className="min-h-screen bg-[#111a17] px-4 py-4 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-w-0 flex-col items-center">
          <div className="mb-5 flex w-full max-w-[34rem] items-center justify-between gap-4">
            <button onClick={backToLobby} className="text-sm font-semibold text-game-muted hover:text-white">← Lobby</button>
            <div className="text-center">
              <p className="text-xs font-bold text-[#d7a7ff]">{view.mode === TicTacToeMode.LIMITED ? 'THREE-PIECE' : 'CLASSIC'}</p>
              <p className="mt-1 text-sm text-game-muted">Room {code}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmSurrender(true)}>Resign</Button>
          </div>

          <div className="mb-4 grid w-full max-w-[34rem] grid-cols-2 gap-3">
            {view.players.map((player) => (
              <div key={player.id} className={`rounded-lg border p-3 ${player.id === view.currentTurnId && !finished ? 'border-game-mint bg-game-mint/10' : 'border-white/10 bg-white/[0.03]'}`}>
                <span className={`text-2xl font-black ${player.mark === 'X' ? 'text-[#ff795f]' : 'text-game-mint'}`}>{player.mark}</span>
                <p className="mt-1 truncate text-sm font-semibold">{player.name}{player.id === view.youId ? ' (you)' : ''}</p>
              </div>
            ))}
          </div>

          <TicTacToeBoard
            board={view.board}
            winningLine={view.winningLine}
            selectedFrom={selectedFrom}
            disabled={finished}
            onCellClick={handleCell}
          />

          <div className="mt-4 min-h-12 text-center">
            {finished ? (
              <p className="text-lg font-bold">{result?.isDraw || view.isDraw ? 'Draw game' : `${winner?.name ?? 'Player'} wins`}</p>
            ) : view.canAct ? (
              <p className="font-semibold text-white">{view.mustMovePiece ? selectedFrom === null ? 'Select one of your marks' : 'Choose an empty destination' : 'Your turn'}</p>
            ) : (
              <p className="text-game-muted">Waiting for {current?.name ?? 'opponent'}…</p>
            )}
            {error && <p role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
            {finished && <RematchButton lobbyCode={code} className="mt-4" />}
          </div>
        </section>

        <aside className="space-y-4">
          <VoiceChat roomId={code} />
          <GameChat lobbyCode={code} />
        </aside>
      </div>

      {confirmSurrender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/12 bg-[#1c1f1b] p-6 text-center">
            <h2 className="text-xl font-bold">Resign this match?</h2>
            <p className="mt-2 text-sm text-game-muted">Your opponent will be awarded the win.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmSurrender(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => { surrender(); setConfirmSurrender(false); }}>Resign</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
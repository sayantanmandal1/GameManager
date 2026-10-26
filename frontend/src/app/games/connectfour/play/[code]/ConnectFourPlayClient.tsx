'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectFourBoard } from '@/components/connectfour/ConnectFourBoard';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { GameConnectionState } from '@/components/ui/GameConnectionState';
import { PlayerName } from '@/components/ui/PlayerName';
import { RematchButton } from '@/components/lobby/RematchButton';
import { useAuthStore } from '@/stores/authStore';
import { useConnectFourStore } from '@/stores/connectfourStore';
import { useSocket } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { CONNECT_FOUR_COLUMNS, ConnectFourPhase, LOBBY_EVENTS } from '@/shared';

export default function ConnectFourPlayClient({ code }: { code: string }) {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { isConnected } = useSocket();
  const view = useConnectFourStore((state) => state.view);
  const result = useConnectFourStore((state) => state.result);
  const error = useConnectFourStore((state) => state.error);
  const setLobbyCode = useConnectFourStore((state) => state.setLobbyCode);
  const initListeners = useConnectFourStore((state) => state.initListeners);
  const drop = useConnectFourStore((state) => state.drop);
  const surrender = useConnectFourStore((state) => state.surrender);
  const reset = useConnectFourStore((state) => state.reset);
  const [confirmSurrender, setConfirmSurrender] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated || !code) {
      router.push('/games/connectfour');
      return;
    }
    if (!isConnected) return;
    setLobbyCode(code);
    return initListeners();
  }, [code, hasHydrated, initListeners, isAuthenticated, isConnected, router, setLobbyCode]);
  useEffect(() => () => reset(), [reset]);

  const backToLobby = () => {
    getSocket()?.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
    reset();
    router.push(`/lobby/${code}`);
  };

  if (!view) {
    return <GameConnectionState connected={isConnected} error={error} backHref="/games/connectfour" />;
  }
  const lastMoveIndex = view.lastMove
    ? view.lastMove.row * CONNECT_FOUR_COLUMNS + view.lastMove.column
    : null;
  const current = view.players.find((player) => player.id === view.currentTurnId);
  const winner = view.players.find((player) => player.id === (result?.winnerId ?? view.winnerId));
  const finished = view.phase === ConnectFourPhase.FINISHED || !!result;

  return (
    <main className="tabletop-scene min-h-screen px-4 py-4 text-game-text sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-w-0 flex-col items-center">
          <div className="glass-chrome game-toolbar mb-4 w-full max-w-[43rem] rounded-2xl border border-white/10 p-3">
            <button onClick={backToLobby} className="-ml-2 min-h-11 rounded-md px-2 text-sm font-semibold text-game-muted hover:bg-white/5 hover:text-white">← Lobby</button>
            <div className="text-center"><p className="text-xs font-bold text-game-sun">CONNECT FOUR</p><p className="text-sm text-game-muted">Room {code}</p></div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmSurrender(true)}>Resign</Button>
          </div>
          <div className="mb-3 grid w-full max-w-[43rem] grid-cols-2 gap-3">
            {view.players.map((player) => (
              <div key={player.id} className={`flex items-center gap-3 rounded-2xl border bg-game-card p-3 ${player.id === view.currentTurnId && !finished ? 'border-game-blue/40' : 'border-white/10'}`}>
                <span className={`h-7 w-7 rounded-full ${player.disc === 'red' ? 'bg-[#f35f4a]' : 'bg-game-sun'}`} />
                <PlayerName name={player.name} isYou={player.id === view.youId} className="text-sm font-semibold" />
              </div>
            ))}
          </div>
          <ConnectFourBoard
            board={view.board}
            validColumns={view.validColumns}
            winningCells={view.winningCells}
            lastMoveIndex={lastMoveIndex}
            canAct={view.canAct && !finished}
            onDrop={drop}
          />
          <div className="mt-4 min-h-12 text-center">
            {finished ? <p className="text-lg font-bold">{result?.isDraw || view.isDraw ? 'Draw game' : `${winner?.name ?? 'Player'} wins`}</p> : view.canAct ? <p className="font-semibold">Choose a column</p> : <p className="text-game-muted">Waiting for {current?.name ?? 'opponent'}…</p>}
            {error && <p role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
            {finished && <RematchButton lobbyCode={code} className="mt-4" />}
          </div>
        </section>
        <aside className="space-y-4"><VoiceChat roomId={code} /><GameChat lobbyCode={code} /></aside>
      </div>

      <Modal isOpen={confirmSurrender} onClose={() => setConfirmSurrender(false)} title="Resign this match?">
            <p className="mt-2 text-sm text-game-muted">Your opponent will be awarded the win.</p>
            <div className="mt-5 flex justify-center gap-3"><Button variant="secondary" onClick={() => setConfirmSurrender(false)}>Cancel</Button><Button variant="danger" onClick={() => { surrender(); setConfirmSurrender(false); }}>Resign</Button></div>
      </Modal>
    </main>
  );
}
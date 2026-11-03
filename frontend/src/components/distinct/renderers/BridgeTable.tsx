import type { ReactNode } from 'react';
import type { CardTablePlayer } from './CardTable';

export function BridgeTable({ players, youId, currentTurnId, topRail, center, hand, bottomRail, attention }: Readonly<{
  players: CardTablePlayer[];
  youId: string;
  currentTurnId: string | null;
  topRail: ReactNode;
  center: ReactNode;
  hand: ReactNode;
  bottomRail: ReactNode;
  attention: boolean;
}>) {
  const index = players.findIndex((player) => player.id === youId);
  const ordered = [...players.slice(index), ...players.slice(0, index)];
  return (
    <section aria-label="Card table" data-card-table-layout="bridge" className="bridge-table relative isolate w-full min-w-0 rounded-3xl border border-[#d2b76f]/35 bg-[#123f33] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-2 -z-10 rounded-[1.25rem] border border-white/10" />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <p className="text-xs font-semibold text-[#f1d174]">Four seats. One partnership.</p>
        {topRail}
      </div>
      <div aria-label="Opponents" className="grid grid-cols-3 gap-2 px-3">
        {ordered.slice(1).map((player, seat) => (
          <div key={player.id} aria-label={`${player.name}, ${['left', 'across', 'right'][seat]} seat, ${player.handCount} cards${player.id === currentTurnId ? ', to play' : ''}`} className={`min-w-0 rounded-xl border px-2 py-1.5 text-center ${player.id === currentTurnId ? 'border-[#f3d477] bg-[#f3d477]/15' : 'border-white/10 bg-black/15'}`}>
            <p className="truncate text-sm font-bold" title={player.name}>{player.name}</p>
            <p className="text-[11px] text-white/70">{player.handCount} cards · {player.detail}</p>
          </div>
        ))}
      </div>
      <div data-card-table-center className="flex min-h-[10rem] min-w-0 items-center justify-center px-3 py-3">
        {center}
      </div>
      <div data-card-table-hand className="min-w-0 rounded-b-3xl border-t border-white/15 bg-[#092d25] px-2 py-2">
        <p className="mb-1 text-center text-xs text-white/75">
          {ordered[0]?.name} · you{currentTurnId === youId ? <strong className="ml-2 text-[#f3d477]">Your turn</strong> : ''}
        </p>
        {hand}
      </div>
      <details open={attention || undefined} className="border-t border-white/10 px-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-white/75">{attention ? 'Partner request · review table actions' : 'Deal details & table actions'}</summary>
        <div className="pb-3">{bottomRail}</div>
      </details>
    </section>
  );
}

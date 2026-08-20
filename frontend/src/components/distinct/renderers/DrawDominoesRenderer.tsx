'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Domino, DrawDominoesAction, DrawDominoesPlayerView } from '@/shared';

interface Props { view: DrawDominoesPlayerView; disabled: boolean; onAction: (action: DrawDominoesAction) => void }

function DominoTile({ domino, selected, onClick, disabled }: { domino: Domino; selected?: boolean; onClick?: () => void; disabled?: boolean }) {
  const content = <><span>{domino.a}</span><span className="h-px w-full bg-current/30" /><span>{domino.b}</span></>;
  const classes = `flex h-24 w-12 flex-col items-center justify-around border bg-[#f4f1e8] px-2 text-xl font-black text-[#242725] shadow-lg ${selected ? 'outline outline-4 outline-[#f0eee5]' : ''}`;
  return onClick ? <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} aria-label={`Domino ${domino.a}-${domino.b}`} className={`${classes} disabled:opacity-45`}>{content}</button> : <span className={classes} aria-label={`Domino ${domino.a}-${domino.b}`}>{content}</span>;
}

export function DrawDominoesRenderer({ view, disabled, onAction }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [end, setEnd] = useState<'left' | 'right'>('right');
  const [flip, setFlip] = useState(false);
  useEffect(() => { setSelectedId(null); setFlip(false); }, [view.currentTurnId, view.yourHand.length]);
  const legal = view.legalPlays.find((play) => play.dominoId === selectedId);
  const selected = view.yourHand.find((domino) => domino.id === selectedId);
  const play = () => selected && legal?.ends.includes(end) && onAction({ type: 'play_domino', dominoId: selected.id, end, flip });
  return (
    <div className="w-full max-w-[52rem]">
      <div className="flex min-h-28 items-center gap-2 overflow-x-auto border-y border-white/10 px-3 py-4" aria-label="Domino chain">
        {view.chain.length === 0 ? <p className="mx-auto text-sm text-white/45">Open the chain</p> : view.chain.map((domino, index) => <DominoTile key={`${domino.id}-${index}`} domino={domino} />)}
      </div>
      <div className="mt-5 flex items-center justify-center gap-4 text-sm text-white/55"><span>Open ends: {view.openEnds ? `${view.openEnds[0]} / ${view.openEnds[1]}` : 'any'}</span><span>Boneyard: {view.boneyardCount}</span></div>
      <div className="mt-6 flex min-h-28 flex-wrap justify-center gap-2" aria-label="Your domino hand">
        {view.yourHand.map((domino) => {
          const canPlay = view.legalPlays.some((play) => play.dominoId === domino.id);
          return <DominoTile key={domino.id} domino={domino} selected={selectedId === domino.id} disabled={disabled || !view.canAct || !canPlay} onClick={() => { setSelectedId(domino.id); const firstEnd = view.legalPlays.find((play) => play.dominoId === domino.id)?.ends[0]; if (firstEnd) setEnd(firstEnd); }} />;
        })}
      </div>
      {selected && legal && (
        <div className="mt-5 flex flex-wrap justify-center gap-2" role="group" aria-label="Domino orientation and end">
          {legal.ends.map((value) => <button key={value} type="button" aria-pressed={end === value} onClick={() => setEnd(value)} className={`min-h-10 border px-3 font-bold capitalize ${end === value ? 'border-white bg-white text-[#252a2c]' : 'border-white/15 text-white'}`}>{value}</button>)}
          <button type="button" aria-pressed={flip} onClick={() => setFlip((value) => !value)} className={`min-h-10 border px-3 font-bold ${flip ? 'border-white bg-white text-[#252a2c]' : 'border-white/15 text-white'}`}>Flip</button>
        </div>
      )}
      <div className="mt-5 flex justify-center gap-3"><Button disabled={disabled || !selected || !legal?.ends.includes(end)} onClick={play}>Play domino</Button><Button variant="secondary" disabled={disabled || !view.canDraw} onClick={() => onAction({ type: 'draw_domino' })}>Draw</Button></div>
    </div>
  );
}
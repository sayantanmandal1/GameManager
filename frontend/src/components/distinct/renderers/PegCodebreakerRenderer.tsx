'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PEG_CODE_COLORS, type PegCodeAction, type PegCodeColor, type PegCodePlayerView } from '@/shared';

const COLOR_CLASS: Record<PegCodeColor, string> = {
  red: 'bg-[#ef5b54]', blue: 'bg-[#5aa9e6]', green: 'bg-[#67c587]', yellow: 'bg-[#f3cf55]',
  orange: 'bg-[#ef9948]', purple: 'bg-[#b986d7]',
};

interface Props { view: PegCodePlayerView; disabled: boolean; onAction: (action: PegCodeAction) => void }

export function PegCodebreakerRenderer({ view, disabled, onAction }: Props) {
  const [colors, setColors] = useState<PegCodeColor[]>([]);
  useEffect(() => setColors([]), [view.phase, view.guesses.length]);
  const submit = () => {
    if (colors.length !== 4) return;
    onAction(view.phase === 'coding' ? { type: 'set_code', colors } : { type: 'guess_code', colors });
  };
  return (
    <div className="w-full max-w-[42rem]">
      <div className="max-h-72 space-y-2 overflow-y-auto border-y border-white/10 py-3" aria-label="Code guesses">
        {view.guesses.length === 0 && <p className="py-6 text-center text-sm text-white/45">No guesses yet</p>}
        {view.guesses.map((guess, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border-b border-white/5 px-2 py-2">
            <div className="flex gap-2">{guess.colors.map((color, peg) => <span key={peg} className={`h-7 w-7 rounded-full border border-black/25 ${COLOR_CLASS[color]}`} aria-label={color} />)}</div>
            <p className="text-sm font-bold"><span className="text-[#f3cf55]">{guess.exact} exact</span><span className="ml-3 text-white/55">{guess.colorOnly} color</span></p>
          </div>
        ))}
      </div>
      {view.canAct && view.phase !== 'finished' && (
        <div className="mt-6">
          <div className="mb-4 flex min-h-12 items-center justify-center gap-3" aria-label="Current code">
            {Array.from({ length: 4 }, (_, index) => <span key={index} className={`h-10 w-10 rounded-full border-2 ${colors[index] ? `${COLOR_CLASS[colors[index]]} border-black/25` : 'border-dashed border-white/25'}`} />)}
          </div>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Code colors">
            {PEG_CODE_COLORS.map((color) => <button key={color} type="button" disabled={disabled || colors.length >= 4} onClick={() => setColors((current) => [...current, color])} aria-label={`Add ${color}`} className={`h-11 w-11 rounded-full border-2 border-white/35 ${COLOR_CLASS[color]} disabled:opacity-40`} />)}
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="secondary" disabled={colors.length === 0} onClick={() => setColors((current) => current.slice(0, -1))}>Back</Button>
            <Button disabled={disabled || colors.length !== 4} onClick={submit}>{view.phase === 'coding' ? 'Set code' : 'Submit guess'}</Button>
          </div>
        </div>
      )}
      <p className="mt-4 text-center text-sm text-white/55">{view.attemptsRemaining} guesses remaining</p>
    </div>
  );
}
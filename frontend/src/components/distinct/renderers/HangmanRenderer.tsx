'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { HangmanAction, HangmanPlayerView } from '@/shared';

interface Props { view: HangmanPlayerView; disabled: boolean; onAction: (action: HangmanAction) => void }

export function HangmanRenderer({ view, disabled, onAction }: Props) {
  const [entry, setEntry] = useState('');
  useEffect(() => setEntry(''), [view.phase, view.currentTurnId, view.guessedLetters.length]);
  const submit = () => {
    const value = entry.trim();
    if (!value) return;
    if (view.phase === 'setup') onAction({ type: 'set_phrase', phrase: value });
    else if (/^[A-Za-z]$/.test(value)) onAction({ type: 'guess_letter', letter: value });
    else onAction({ type: 'guess_phrase', phrase: value });
  };
  return (
    <div className="w-full max-w-[44rem] text-center">
      <div className="border-y border-white/10 py-8">
        <p aria-label={`Phrase pattern ${view.pattern}`} className="break-words font-mono text-3xl font-black text-white sm:text-5xl">{view.pattern || 'Phrase pending'}</p>
        <div className="mx-auto mt-6 grid max-w-md grid-cols-8 gap-1" aria-label={`${view.misses} of ${view.maxMisses} misses`}>
          {Array.from({ length: view.maxMisses }, (_, index) => <span key={index} className={`h-2 ${index < view.misses ? 'bg-[#ff684d]' : 'bg-white/12'}`} />)}
        </div>
        <p className="mt-3 text-sm text-white/55">Misses {view.misses}/{view.maxMisses}</p>
      </div>
      <div className="mt-5 flex min-h-9 flex-wrap justify-center gap-2" aria-label="Guessed letters">
        {view.guessedLetters.map((letter) => <span key={letter} className="flex h-9 w-9 items-center justify-center border border-white/15 bg-white/5 font-bold">{letter}</span>)}
      </div>
      {view.canAct && (
        <form className="mx-auto mt-6 flex max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <label htmlFor="hangman-entry" className="sr-only">{view.phase === 'setup' ? 'Secret phrase' : 'Letter or full phrase'}</label>
          <input id="hangman-entry" value={entry} onChange={(event) => setEntry(event.target.value.replace(/[^A-Za-z ]/g, '').slice(0, 40))} maxLength={40} autoComplete="off" className="min-w-0 flex-1 border border-white/15 bg-black/25 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-white/30" placeholder={view.phase === 'setup' ? 'Secret phrase' : 'Letter or full phrase'} />
          <Button type="submit" disabled={disabled || entry.trim().length === 0}>{view.phase === 'setup' ? 'Lock phrase' : 'Guess'}</Button>
        </form>
      )}
    </div>
  );
}
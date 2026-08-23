'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { HangmanAction, HangmanPlayerView } from '@/shared';

interface Props { view: HangmanPlayerView; disabled: boolean; onAction: (action: HangmanAction) => void }

export function HangmanRenderer({ view, disabled, onAction }: Props) {
  const [entry, setEntry] = useState('');
  useEffect(
    () => setEntry(''),
    [view.phase, view.currentTurnId, view.guessedLetters.length, view.misses],
  );
  const submit = () => {
    const value = entry.trim();
    if (!value) return;
    if (view.phase === 'setup') onAction({ type: 'set_phrase', phrase: value });
    else if (/^[A-Za-z]$/.test(value)) onAction({ type: 'guess_letter', letter: value });
    else onAction({ type: 'guess_phrase', phrase: value });
  };
  const revealedLetters = new Set(view.pattern.replace(/[^A-Z]/g, '').split(''));
  const correctGuesses = view.guessedLetters.filter((letter) => revealedLetters.has(letter));
  const wrongGuesses = view.guessedLetters.filter((letter) => !revealedLetters.has(letter));
  const displayedPhrase = view.phase === 'finished' && view.revealedPhrase
    ? view.revealedPhrase
    : view.pattern;
  return (
    <div className="w-full max-w-[52rem] text-center">
      <div className="grid gap-6 border-y border-white/10 py-6 md:grid-cols-[15rem_minmax(0,1fr)] md:items-center">
        <HangmanFigure misses={view.misses} maxMisses={view.maxMisses} />
        <div>
          <div
            aria-label={`Phrase pattern ${displayedPhrase}`}
            className="flex min-h-24 flex-wrap items-end justify-center gap-2"
          >
            {displayedPhrase
              ? [...displayedPhrase].map((character, index) => {
                  if (character === ' ') return <span key={index} className="w-5" aria-hidden="true" />;
                  const revealed = character !== '_';
                  return (
                    <span
                      key={index}
                      className={`grid h-12 min-w-9 place-items-center border-b-2 px-1 font-mono text-2xl font-black transition ${revealed ? 'border-[#72d3a3] bg-[#72d3a3]/12 text-[#a8f1ca]' : 'border-white/35 text-transparent'}`}
                    >
                      {revealed ? character : '_'}
                    </span>
                  );
                })
              : <span className="text-xl font-bold text-white/45">Phrase pending</span>}
          </div>
          <p className="mt-4 text-sm text-white/55">
            {view.misses}/{view.maxMisses} wrong guesses
          </p>
          {view.phase === 'finished' && view.revealedPhrase && (
            <p className="mt-2 text-sm text-white/70">
              Answer: <strong className="text-white">{view.revealedPhrase}</strong>
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <GuessList label="Correct letters" letters={correctGuesses} correct />
        <GuessList label="Wrong letters" letters={wrongGuesses} correct={false} />
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

function GuessList({ label, letters, correct }: Readonly<{
  label: string;
  letters: string[];
  correct: boolean;
}>) {
  return (
    <section className="min-h-20 border border-white/10 bg-black/10 p-3 text-left" aria-label={label}>
      <p className="text-[10px] font-bold uppercase text-white/40">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {letters.map((letter) => (
          <span
            key={letter}
            className={`grid h-9 w-9 place-items-center border font-bold ${correct ? 'border-[#72d3a3]/40 bg-[#72d3a3]/12 text-[#a8f1ca]' : 'border-[#ff684d]/40 bg-[#ff684d]/12 text-[#ff9b8a]'}`}
          >
            {letter}
          </span>
        ))}
        {letters.length === 0 && <span className="text-xs text-white/30">None yet</span>}
      </div>
    </section>
  );
}

function HangmanFigure({ misses, maxMisses }: Readonly<{
  misses: number;
  maxMisses: number;
}>) {
  const show = (stage: number) => stage <= misses;
  return (
    <div className="mx-auto w-full max-w-56" aria-label={`${misses} of ${maxMisses} hangman stages`}>
      <div className="relative mx-auto h-52 w-44" aria-hidden="true">
        <span className={`absolute bottom-0 left-2 h-1 w-36 bg-white/65 transition-opacity ${show(1) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute bottom-0 left-8 h-48 w-1 bg-white/65 transition-opacity ${show(2) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute left-8 top-0 h-1 w-24 bg-white/65 transition-opacity ${show(3) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-9 top-0 h-9 w-1 bg-white/65 transition-opacity ${show(4) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-3 top-8 h-12 w-12 rounded-full border-4 border-[#ff9b8a] transition-opacity ${show(5) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-[3.25rem] top-20 h-16 w-1 rotate-0 bg-[#ff9b8a] transition-opacity ${show(6) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-[3.25rem] top-24 h-12 w-1 -rotate-45 origin-top bg-[#ff9b8a] transition-opacity ${show(7) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-[3.25rem] top-24 h-12 w-1 rotate-45 origin-top bg-[#ff9b8a] transition-opacity ${show(7) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-[3.25rem] top-[8.7rem] h-12 w-1 -rotate-45 origin-top bg-[#ff9b8a] transition-opacity ${show(8) ? 'opacity-100' : 'opacity-10'}`} />
        <span className={`absolute right-[3.25rem] top-[8.7rem] h-12 w-1 rotate-45 origin-top bg-[#ff9b8a] transition-opacity ${show(8) ? 'opacity-100' : 'opacity-10'}`} />
      </div>
    </div>
  );
}
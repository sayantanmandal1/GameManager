'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { SudokuBoard } from '@/components/sudoku/SudokuBoard';
import { useSudokuStore, type SudokuDifficulty } from '@/stores/sudokuStore';

const DIFFICULTIES: SudokuDifficulty[] = ['easy', 'medium', 'hard', 'expert'];

export default function SudokuPage() {
  const router = useRouter();
  const puzzle = useSudokuStore((state) => state.puzzle);
  const solution = useSudokuStore((state) => state.solution);
  const difficulty = useSudokuStore((state) => state.difficulty);
  const values = useSudokuStore((state) => state.values);
  const notes = useSudokuStore((state) => state.notes);
  const selected = useSudokuStore((state) => state.selected);
  const mistakes = useSudokuStore((state) => state.mistakes);
  const hintsRemaining = useSudokuStore((state) => state.hintsRemaining);
  const elapsedSeconds = useSudokuStore((state) => state.elapsedSeconds);
  const isPaused = useSudokuStore((state) => state.isPaused);
  const isComplete = useSudokuStore((state) => state.isComplete);
  const newGame = useSudokuStore((state) => state.newGame);
  const selectCell = useSudokuStore((state) => state.selectCell);
  const enterNumber = useSudokuStore((state) => state.enterNumber);
  const erase = useSudokuStore((state) => state.erase);
  const useHint = useSudokuStore((state) => state.useHint);
  const togglePaused = useSudokuStore((state) => state.togglePaused);
  const tick = useSudokuStore((state) => state.tick);
  const [notesMode, setNotesMode] = useState(false);

  useEffect(() => {
    if (!puzzle) newGame('medium');
  }, [newGame, puzzle]);

  useEffect(() => {
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [tick]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key >= '1' && event.key <= '9') enterNumber(Number(event.key), notesMode);
      else if (event.key === 'Backspace' || event.key === 'Delete') erase();
      else if (event.key.toLowerCase() === 'n') setNotesMode((current) => !current);
      else if (selected !== null && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const row = Math.floor(selected / 9);
        const column = selected % 9;
        const nextRow = Math.min(8, Math.max(0, row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
        const nextColumn = Math.min(8, Math.max(0, column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
        selectCell(nextRow * 9 + nextColumn);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterNumber, erase, notesMode, selectCell, selected]);

  if (!puzzle) return <main className="min-h-[calc(100vh-4rem)]" />;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#15201c] px-3 py-5 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,38rem)_18rem] lg:items-start lg:justify-center">
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button onClick={() => router.push('/games')} className="text-sm font-semibold text-game-muted hover:text-white">← Games</button>
            <div className="text-center"><p className="text-xs font-bold text-game-mint">SUDOKU</p><p className="font-mono text-lg font-bold">{formatTime(elapsedSeconds)}</p></div>
            <Button variant="ghost" size="sm" onClick={togglePaused}>{isPaused ? 'Resume' : 'Pause'}</Button>
          </div>
          <SudokuBoard
            puzzle={puzzle}
            solution={solution}
            values={values}
            notes={notes}
            selected={selected}
            paused={isPaused}
            onSelect={selectCell}
          />

          <div className="mt-4 grid grid-cols-9 gap-1.5 sm:gap-2">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                disabled={isPaused || isComplete}
                onClick={() => enterNumber(number, notesMode)}
                className="aspect-square rounded-md border border-white/12 bg-[#22302a] text-lg font-bold text-white hover:bg-[#2b3d35] disabled:opacity-40 sm:text-xl"
              >
                {number}
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/12 bg-[#1c2924] p-4">
            <p className="text-xs font-bold text-game-muted">DIFFICULTY</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={difficulty === option}
                  onClick={() => newGame(option)}
                  className={`min-h-10 rounded-md border px-2 text-sm font-semibold capitalize ${difficulty === option ? 'border-game-mint bg-game-mint/15 text-white' : 'border-white/10 text-game-muted hover:text-white'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setNotesMode((current) => !current)} aria-pressed={notesMode} className={`min-h-14 rounded-lg border text-sm font-semibold ${notesMode ? 'border-game-sun bg-game-sun/15 text-game-sun' : 'border-white/12 bg-[#1c2924] text-game-muted'}`}>Notes</button>
            <button onClick={erase} className="min-h-14 rounded-lg border border-white/12 bg-[#1c2924] text-sm font-semibold text-game-muted hover:text-white">Erase</button>
            <button onClick={useHint} disabled={hintsRemaining === 0} className="min-h-14 rounded-lg border border-white/12 bg-[#1c2924] text-sm font-semibold text-game-muted hover:text-white disabled:opacity-40">Hint {hintsRemaining}</button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/12 bg-[#1c2924] p-4 text-sm">
            <span className="text-game-muted">Mistakes</span>
            <span className="font-bold text-[#ff8a75]">{mistakes}</span>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => newGame(difficulty)}>New puzzle</Button>
        </aside>
      </div>

      {isComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-lg border border-game-mint/30 bg-[#1c2924] p-7 text-center shadow-2xl">
            <p className="text-sm font-bold text-game-mint">PUZZLE COMPLETE</p>
            <h2 className="mt-2 text-3xl font-black">{formatTime(elapsedSeconds)}</h2>
            <p className="mt-2 text-sm text-game-muted">{mistakes} mistake{mistakes === 1 ? '' : 's'} · {difficulty}</p>
            <Button className="mt-6" onClick={() => newGame(difficulty)}>Next puzzle</Button>
          </div>
        </div>
      )}
    </main>
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
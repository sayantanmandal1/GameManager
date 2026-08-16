import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSudoku } from 'sudoku-gen';

export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface SudokuState {
  puzzle: string;
  solution: string;
  difficulty: SudokuDifficulty;
  values: number[];
  notes: Record<number, number[]>;
  selected: number | null;
  mistakes: number;
  hintsRemaining: number;
  elapsedSeconds: number;
  isPaused: boolean;
  isComplete: boolean;
  newGame: (difficulty: SudokuDifficulty) => void;
  selectCell: (index: number | null) => void;
  enterNumber: (value: number, notesMode: boolean) => void;
  erase: () => void;
  useHint: () => void;
  togglePaused: () => void;
  tick: () => void;
}

const EMPTY_VALUES = Array.from({ length: 81 }, () => 0);

export const useSudokuStore = create<SudokuState>()(
  persist(
    (set, get) => ({
      puzzle: '',
      solution: '',
      difficulty: 'medium',
      values: EMPTY_VALUES,
      notes: {},
      selected: null,
      mistakes: 0,
      hintsRemaining: 3,
      elapsedSeconds: 0,
      isPaused: false,
      isComplete: false,

      newGame: (difficulty) => {
        const generated = getSudoku(difficulty);
        if (
          !/^[1-9-]{81}$/.test(generated.puzzle) ||
          !/^[1-9]{81}$/.test(generated.solution)
        ) {
          throw new Error('Sudoku generator returned an invalid puzzle');
        }
        set({
          puzzle: generated.puzzle,
          solution: generated.solution,
          difficulty,
          values: [...generated.puzzle].map((cell) => (cell === '-' ? 0 : Number(cell))),
          notes: {},
          selected: null,
          mistakes: 0,
          hintsRemaining: 3,
          elapsedSeconds: 0,
          isPaused: false,
          isComplete: false,
        });
      },

      selectCell: (index) => {
        if (index !== null && (!Number.isInteger(index) || index < 0 || index >= 81)) return;
        set({ selected: index });
      },

      enterNumber: (value, notesMode) => {
        const state = get();
        const index = state.selected;
        if (
          index === null ||
          state.isPaused ||
          state.isComplete ||
          state.puzzle[index] !== '-' ||
          !Number.isInteger(value) ||
          value < 1 ||
          value > 9
        ) {
          return;
        }
        if (notesMode) {
          const existing = state.notes[index] ?? [];
          const next = existing.includes(value)
            ? existing.filter((note) => note !== value)
            : [...existing, value].sort((a, b) => a - b);
          set({ notes: { ...state.notes, [index]: next } });
          return;
        }

        const values = [...state.values];
        const wasSameValue = values[index] === value;
        values[index] = value;
        const correct = Number(state.solution[index]) === value;
        const notes = { ...state.notes };
        delete notes[index];
        if (correct) removeNoteFromPeers(notes, index, value);
        const isComplete = values.every(
          (cell, cellIndex) => cell === Number(state.solution[cellIndex]),
        );
        set({
          values,
          notes,
          mistakes: state.mistakes + (!correct && !wasSameValue ? 1 : 0),
          isComplete,
          isPaused: false,
        });
      },

      erase: () => {
        const state = get();
        const index = state.selected;
        if (
          index === null ||
          state.isPaused ||
          state.isComplete ||
          state.puzzle[index] !== '-'
        ) {
          return;
        }
        const values = [...state.values];
        values[index] = 0;
        const notes = { ...state.notes };
        delete notes[index];
        set({ values, notes });
      },

      useHint: () => {
        const state = get();
        if (state.hintsRemaining <= 0 || state.isPaused || state.isComplete) return;
        const index =
          state.selected !== null &&
          state.puzzle[state.selected] === '-' &&
          state.values[state.selected] !== Number(state.solution[state.selected])
            ? state.selected
            : state.values.findIndex(
                (value, cellIndex) =>
                  state.puzzle[cellIndex] === '-' &&
                  value !== Number(state.solution[cellIndex]),
              );
        if (index < 0 || state.puzzle[index] !== '-') return;
        const value = Number(state.solution[index]);
        const values = [...state.values];
        values[index] = value;
        const notes = { ...state.notes };
        delete notes[index];
        removeNoteFromPeers(notes, index, value);
        const isComplete = values.every(
          (cell, cellIndex) => cell === Number(state.solution[cellIndex]),
        );
        set({
          values,
          notes,
          selected: index,
          hintsRemaining: state.hintsRemaining - 1,
          isComplete,
        });
      },

      togglePaused: () => {
        if (get().isComplete) return;
        set((state) => ({ isPaused: !state.isPaused }));
      },

      tick: () => {
        const state = get();
        if (!state.isPaused && !state.isComplete && state.puzzle) {
          set({ elapsedSeconds: state.elapsedSeconds + 1 });
        }
      },
    }),
    {
      name: 'gameverse-sudoku',
      partialize: (state) => ({
        puzzle: state.puzzle,
        solution: state.solution,
        difficulty: state.difficulty,
        values: state.values,
        notes: state.notes,
        selected: state.selected,
        mistakes: state.mistakes,
        hintsRemaining: state.hintsRemaining,
        elapsedSeconds: state.elapsedSeconds,
        isPaused: state.isPaused,
        isComplete: state.isComplete,
      }),
    },
  ),
);

function removeNoteFromPeers(
  notes: Record<number, number[]>,
  index: number,
  value: number,
): void {
  const row = Math.floor(index / 9);
  const column = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let cell = 0; cell < 81; cell += 1) {
    const cellRow = Math.floor(cell / 9);
    const cellColumn = cell % 9;
    if (
      cellRow === row ||
      cellColumn === column ||
      (cellRow >= boxRow && cellRow < boxRow + 3 &&
        cellColumn >= boxColumn && cellColumn < boxColumn + 3)
    ) {
      if (notes[cell]?.includes(value)) {
        notes[cell] = notes[cell].filter((note) => note !== value);
      }
    }
  }
}
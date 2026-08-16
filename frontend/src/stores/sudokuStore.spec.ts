import { useSudokuStore } from './sudokuStore';

const solution = '123456789'.repeat(9);
const puzzle = `1${'-'.repeat(80)}`;

describe('sudokuStore', () => {
  beforeEach(() => {
    useSudokuStore.setState({
      puzzle,
      solution,
      difficulty: 'easy',
      values: [1, ...Array.from({ length: 80 }, () => 0)],
      notes: {},
      selected: null,
      mistakes: 0,
      hintsRemaining: 3,
      elapsedSeconds: 0,
      isPaused: false,
      isComplete: false,
    });
  });

  it('never changes an immutable clue', () => {
    useSudokuStore.getState().selectCell(0);
    useSudokuStore.getState().enterNumber(9, false);
    expect(useSudokuStore.getState().values[0]).toBe(1);
  });

  it('records notes without filling the cell', () => {
    useSudokuStore.getState().selectCell(1);
    useSudokuStore.getState().enterNumber(2, true);
    expect(useSudokuStore.getState().values[1]).toBe(0);
    expect(useSudokuStore.getState().notes[1]).toEqual([2]);
  });

  it('counts a wrong entry once and accepts the correction', () => {
    useSudokuStore.getState().selectCell(1);
    useSudokuStore.getState().enterNumber(8, false);
    useSudokuStore.getState().enterNumber(8, false);
    expect(useSudokuStore.getState().mistakes).toBe(1);
    useSudokuStore.getState().enterNumber(2, false);
    expect(useSudokuStore.getState().values[1]).toBe(2);
  });

  it('uses a hint only on editable cells', () => {
    useSudokuStore.getState().selectCell(0);
    useSudokuStore.getState().useHint();
    expect(useSudokuStore.getState().values[0]).toBe(1);
    expect(useSudokuStore.getState().values[1]).toBe(2);
    expect(useSudokuStore.getState().hintsRemaining).toBe(2);
    useSudokuStore.getState().selectCell(1);
    useSudokuStore.getState().useHint();
    expect(useSudokuStore.getState().values[2]).toBe(3);
    expect(useSudokuStore.getState().hintsRemaining).toBe(1);
  });

  it('does not advance the timer while paused', () => {
    useSudokuStore.getState().tick();
    useSudokuStore.getState().togglePaused();
    useSudokuStore.getState().tick();
    expect(useSudokuStore.getState().elapsedSeconds).toBe(1);
  });
});
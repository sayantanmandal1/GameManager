import * as crypto from 'crypto';
import {
  BingoBoard,
  BingoCell,
  BingoWinPattern,
  BingoWinResult,
  BINGO_COLUMN_RANGES,
  BINGO_COLUMNS,
  BINGO_BOARD_SIZE,
  BINGO_FREE_ROW,
  BINGO_FREE_COL,
  BINGO_TOTAL_NUMBERS,
} from '@multiplayer-games/shared';

function rangeArray(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateBoard(): BingoBoard {
  const board: BingoBoard = [];

  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    const cells: BingoCell[] = [];
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      if (row === BINGO_FREE_ROW && col === BINGO_FREE_COL) {
        cells.push({ value: 'FREE', marked: true });
      } else {
        cells.push({ value: 0, marked: false }); // placeholder
      }
    }
    board.push(cells);
  }

  // Fill each column with random numbers from the correct range
  for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
    const column = BINGO_COLUMNS[col];
    const [min, max] = BINGO_COLUMN_RANGES[column];
    const pool = shuffleArray(rangeArray(min, max));
    let poolIdx = 0;

    for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
      if (row === BINGO_FREE_ROW && col === BINGO_FREE_COL) continue;
      board[row][col] = { value: pool[poolIdx++], marked: false };
    }
  }

  return board;
}

export function generateDrawPool(): number[] {
  return shuffleArray(rangeArray(1, BINGO_TOTAL_NUMBERS));
}

export function markNumberOnBoard(
  board: BingoBoard,
  number: number,
): BingoBoard {
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      if (board[row][col].value === number) {
        board[row][col] = { ...board[row][col], marked: true };
      }
    }
  }
  return board;
}

export function checkBoardWin(
  board: BingoBoard,
): { pattern: BingoWinPattern; winningCells: [number, number][] } | null {
  // Check rows
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    if (board[row].every((cell) => cell.marked)) {
      return {
        pattern: BingoWinPattern.ROW,
        winningCells: board[row].map((_, col) => [row, col] as [number, number]),
      };
    }
  }

  // Check columns
  for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
    const allMarked = Array.from({ length: BINGO_BOARD_SIZE }, (_, row) =>
      board[row][col].marked,
    ).every(Boolean);
    if (allMarked) {
      return {
        pattern: BingoWinPattern.COLUMN,
        winningCells: Array.from(
          { length: BINGO_BOARD_SIZE },
          (_, row) => [row, col] as [number, number],
        ),
      };
    }
  }

  // Check diagonal (top-left to bottom-right)
  const diag1 = Array.from(
    { length: BINGO_BOARD_SIZE },
    (_, i) => board[i][i].marked,
  ).every(Boolean);
  if (diag1) {
    return {
      pattern: BingoWinPattern.DIAGONAL,
      winningCells: Array.from(
        { length: BINGO_BOARD_SIZE },
        (_, i) => [i, i] as [number, number],
      ),
    };
  }

  // Check diagonal (top-right to bottom-left)
  const diag2 = Array.from(
    { length: BINGO_BOARD_SIZE },
    (_, i) => board[i][BINGO_BOARD_SIZE - 1 - i].marked,
  ).every(Boolean);
  if (diag2) {
    return {
      pattern: BingoWinPattern.DIAGONAL,
      winningCells: Array.from(
        { length: BINGO_BOARD_SIZE },
        (_, i) => [i, BINGO_BOARD_SIZE - 1 - i] as [number, number],
      ),
    };
  }

  // Check full house
  const allMarked = board.every((row) => row.every((cell) => cell.marked));
  if (allMarked) {
    const cells: [number, number][] = [];
    for (let r = 0; r < BINGO_BOARD_SIZE; r++) {
      for (let c = 0; c < BINGO_BOARD_SIZE; c++) {
        cells.push([r, c]);
      }
    }
    return { pattern: BingoWinPattern.FULL_HOUSE, winningCells: cells };
  }

  return null;
}

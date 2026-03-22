import {
  BingoBoard,
  BingoCell,
  BINGO_BOARD_SIZE,
} from '../../../shared';

/** Create an empty 5×5 board (all zeros, unmarked) — players fill it during setup */
export function createEmptyBoard(): BingoBoard {
  const board: BingoBoard = [];
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    const cells: BingoCell[] = [];
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      cells.push({ value: 0, marked: false });
    }
    board.push(cells);
  }
  return board;
}

/** Create a randomly filled 5×5 board with numbers 1-25 shuffled */
export function createRandomBoard(): BingoBoard {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  // Fisher-Yates shuffle
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  const board: BingoBoard = [];
  let idx = 0;
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    const cells: BingoCell[] = [];
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      cells.push({ value: numbers[idx++], marked: false });
    }
    board.push(cells);
  }
  return board;
}

/** Mark a number on a board (cross it off). Mutates in-place for performance. */
export function markNumberOnBoard(board: BingoBoard, number: number): void {
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      if (board[row][col].value === number) {
        board[row][col].marked = true;
        return; // each number appears exactly once
      }
    }
  }
}

/** Count the total completed lines on a board (rows + cols + diagonals, max 12) */
export function countCompletedLines(board: BingoBoard): number {
  let count = 0;

  // Check 5 rows
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    if (board[row].every((cell) => cell.marked)) count++;
  }

  // Check 5 columns
  for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
    let allMarked = true;
    for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
      if (!board[row][col].marked) { allMarked = false; break; }
    }
    if (allMarked) count++;
  }

  // Diagonal top-left → bottom-right
  let d1 = true;
  for (let i = 0; i < BINGO_BOARD_SIZE; i++) {
    if (!board[i][i].marked) { d1 = false; break; }
  }
  if (d1) count++;

  // Diagonal top-right → bottom-left
  let d2 = true;
  for (let i = 0; i < BINGO_BOARD_SIZE; i++) {
    if (!board[i][BINGO_BOARD_SIZE - 1 - i].marked) { d2 = false; break; }
  }
  if (d2) count++;

  return count; // max possible = 12 (5 rows + 5 cols + 2 diags)
}

/** Check if a board has all 25 numbers placed (no zeros remain) */
export function isBoardFilled(board: BingoBoard): boolean {
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      if (board[row][col].value === 0) return false;
    }
  }
  return true;
}

/** Check if a specific number is already placed on the board */
export function isNumberOnBoard(board: BingoBoard, number: number): boolean {
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      if (board[row][col].value === number) return true;
    }
  }
  return false;
}

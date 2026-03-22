import {
  createEmptyBoard,
  createRandomBoard,
  markNumberOnBoard,
  countCompletedLines,
  isBoardFilled,
  isNumberOnBoard,
} from './bingo.utils';
import { BINGO_BOARD_SIZE, BingoBoard } from '../../../shared';

describe('BingoUtils (standalone)', () => {
  describe('createEmptyBoard', () => {
    it('should create a 5x5 board', () => {
      const board = createEmptyBoard();
      expect(board).toHaveLength(BINGO_BOARD_SIZE);
      board.forEach((row) => expect(row).toHaveLength(BINGO_BOARD_SIZE));
    });

    it('should have all cells with value 0 and unmarked', () => {
      const board = createEmptyBoard();
      board.forEach((row) =>
        row.forEach((cell) => {
          expect(cell.value).toBe(0);
          expect(cell.marked).toBe(false);
        }),
      );
    });
  });

  describe('createRandomBoard', () => {
    it('should create a fully filled 5x5 board', () => {
      const board = createRandomBoard();
      expect(board).toHaveLength(BINGO_BOARD_SIZE);
      board.forEach((row) => {
        expect(row).toHaveLength(BINGO_BOARD_SIZE);
        row.forEach((cell) => {
          expect(cell.value).toBeGreaterThanOrEqual(1);
          expect(cell.value).toBeLessThanOrEqual(25);
          expect(cell.marked).toBe(false);
        });
      });
    });

    it('should contain all numbers 1-25 exactly once', () => {
      const board = createRandomBoard();
      const values = board.flat().map((c) => c.value).sort((a, b) => a - b);
      expect(values).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    });

    it('should produce different boards (randomness)', () => {
      const boards = Array.from({ length: 5 }, () => createRandomBoard());
      const flattened = boards.map((b) => b.flat().map((c) => c.value).join(','));
      // At least 2 out of 5 should be different (extremely unlikely to fail)
      const uniqueCount = new Set(flattened).size;
      expect(uniqueCount).toBeGreaterThan(1);
    });
  });

  describe('markNumberOnBoard', () => {
    it('should mark the cell with matching value', () => {
      const board = createEmptyBoard();
      board[2][3] = { value: 15, marked: false };
      markNumberOnBoard(board, 15);
      expect(board[2][3].marked).toBe(true);
    });

    it('should not mark cells with different values', () => {
      const board = createEmptyBoard();
      board[0][0] = { value: 1, marked: false };
      board[0][1] = { value: 2, marked: false };
      markNumberOnBoard(board, 1);
      expect(board[0][0].marked).toBe(true);
      expect(board[0][1].marked).toBe(false);
    });

    it('should do nothing if number not on board', () => {
      const board = createEmptyBoard();
      board[0][0] = { value: 1, marked: false };
      markNumberOnBoard(board, 99);
      expect(board[0][0].marked).toBe(false);
    });
  });

  describe('countCompletedLines', () => {
    it('should return 0 for empty board', () => {
      expect(countCompletedLines(createEmptyBoard())).toBe(0);
    });

    it('should count 1 for a completed row', () => {
      const board = createEmptyBoard();
      for (let c = 0; c < 5; c++) {
        board[2][c] = { value: c + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should count 1 for a completed column', () => {
      const board = createEmptyBoard();
      for (let r = 0; r < 5; r++) {
        board[r][3] = { value: r + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should count 1 for main diagonal', () => {
      const board = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board[i][i] = { value: i + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should count 1 for anti-diagonal', () => {
      const board = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board[i][4 - i] = { value: i + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should count all 12 lines for a fully marked board', () => {
      const board = createEmptyBoard();
      let n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          board[r][c] = { value: n++, marked: true };
        }
      }
      expect(countCompletedLines(board)).toBe(12);
    });

    it('should count row + column intersection as 2 lines', () => {
      const board = createEmptyBoard();
      // Complete row 0
      for (let c = 0; c < 5; c++) {
        board[0][c] = { value: c + 1, marked: true };
      }
      // Complete col 0 (except [0][0] already done)
      for (let r = 1; r < 5; r++) {
        board[r][0] = { value: 10 + r, marked: true };
      }
      expect(countCompletedLines(board)).toBe(2);
    });
  });

  describe('isBoardFilled', () => {
    it('should return false for empty board', () => {
      expect(isBoardFilled(createEmptyBoard())).toBe(false);
    });

    it('should return false for partially filled board', () => {
      const board = createEmptyBoard();
      board[0][0] = { value: 1, marked: false };
      expect(isBoardFilled(board)).toBe(false);
    });

    it('should return true for fully filled board', () => {
      const board = createRandomBoard();
      expect(isBoardFilled(board)).toBe(true);
    });
  });

  describe('isNumberOnBoard', () => {
    it('should return true if number exists', () => {
      const board = createEmptyBoard();
      board[4][4] = { value: 25, marked: false };
      expect(isNumberOnBoard(board, 25)).toBe(true);
    });

    it('should return false if number does not exist', () => {
      const board = createEmptyBoard();
      expect(isNumberOnBoard(board, 25)).toBe(false);
    });

    it('should find 0 on empty board since cells default to 0', () => {
      const board = createEmptyBoard();
      expect(isNumberOnBoard(board, 0)).toBe(true);
    });
  });
});

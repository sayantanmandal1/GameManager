import { BingoEngine } from './bingo.engine';
import {
  generateBoard,
  generateDrawPool,
  checkBoardWin,
  markNumberOnBoard,
} from './bingo.utils';
import {
  BINGO_BOARD_SIZE,
  BINGO_TOTAL_NUMBERS,
  BingoWinPattern,
} from '@multiplayer-games/shared';

describe('BingoUtils', () => {
  describe('generateBoard', () => {
    it('should create a 5x5 board', () => {
      const board = generateBoard();
      expect(board).toHaveLength(BINGO_BOARD_SIZE);
      board.forEach((row) => expect(row).toHaveLength(BINGO_BOARD_SIZE));
    });

    it('should have FREE in center', () => {
      const board = generateBoard();
      expect(board[2][2].value).toBe('FREE');
      expect(board[2][2].marked).toBe(true);
    });

    it('should have correct column ranges', () => {
      const board = generateBoard();
      const ranges: [number, number][] = [
        [1, 15],
        [16, 30],
        [31, 45],
        [46, 60],
        [61, 75],
      ];
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          if (row === 2 && col === 2) continue; // FREE cell
          const val = board[row][col].value as number;
          expect(val).toBeGreaterThanOrEqual(ranges[col][0]);
          expect(val).toBeLessThanOrEqual(ranges[col][1]);
        }
      }
    });

    it('should have unique numbers in each column', () => {
      const board = generateBoard();
      for (let col = 0; col < 5; col++) {
        const values = [];
        for (let row = 0; row < 5; row++) {
          if (row === 2 && col === 2) continue;
          values.push(board[row][col].value);
        }
        expect(new Set(values).size).toBe(values.length);
      }
    });
  });

  describe('generateDrawPool', () => {
    it('should contain all numbers 1-75', () => {
      const pool = generateDrawPool();
      expect(pool).toHaveLength(BINGO_TOTAL_NUMBERS);
      const sorted = [...pool].sort((a, b) => a - b);
      sorted.forEach((val, i) => expect(val).toBe(i + 1));
    });
  });

  describe('checkBoardWin', () => {
    it('should detect a row win', () => {
      const board = generateBoard();
      // Mark entire first row
      for (let col = 0; col < 5; col++) {
        board[0][col] = { ...board[0][col], marked: true };
      }
      const result = checkBoardWin(board);
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe(BingoWinPattern.ROW);
    });

    it('should detect a column win', () => {
      const board = generateBoard();
      for (let row = 0; row < 5; row++) {
        board[row][0] = { ...board[row][0], marked: true };
      }
      const result = checkBoardWin(board);
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe(BingoWinPattern.COLUMN);
    });

    it('should detect a diagonal win', () => {
      const board = generateBoard();
      for (let i = 0; i < 5; i++) {
        board[i][i] = { ...board[i][i], marked: true };
      }
      const result = checkBoardWin(board);
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe(BingoWinPattern.DIAGONAL);
    });

    it('should return null when no win', () => {
      const board = generateBoard();
      expect(checkBoardWin(board)).toBeNull();
    });
  });

  describe('markNumberOnBoard', () => {
    it('should mark the correct cell', () => {
      const board = generateBoard();
      const target = board[0][0].value as number;
      const marked = markNumberOnBoard(board, target);
      expect(marked[0][0].marked).toBe(true);
    });
  });
});

describe('BingoEngine', () => {
  let engine: BingoEngine;
  const players = ['player1', 'player2'];

  beforeEach(() => {
    engine = new BingoEngine();
  });

  describe('initGame', () => {
    it('should create unique boards for each player', () => {
      const state = engine.initGame(players);
      expect(Object.keys(state.boards)).toHaveLength(2);
      expect(state.boards['player1']).toBeDefined();
      expect(state.boards['player2']).toBeDefined();
      expect(state.remainingNumbers).toHaveLength(BINGO_TOTAL_NUMBERS);
    });
  });

  describe('validateMove', () => {
    it('should reject uncalled numbers', () => {
      const state = engine.initGame(players);
      const result = engine.validateMove(state, 'player1', { number: 99 });
      expect(result.valid).toBe(false);
    });

    it('should accept valid marks', () => {
      const state = engine.initGame(players);
      // Manually call a number that exists on player1's board
      const board = state.boards['player1'];
      const num = board[0][0].value as number;
      state.calledNumbers.push(num);

      const result = engine.validateMove(state, 'player1', { number: num });
      expect(result.valid).toBe(true);
    });
  });

  describe('getPlayerView', () => {
    it('should only show the requesting player board', () => {
      const state = engine.initGame(players);
      const view = engine.getPlayerView(state, 'player1');
      expect(view.board).toBeDefined();
      expect(view.players).toEqual(players);
      // Should not contain other players' boards
      expect((view as any).boards).toBeUndefined();
    });
  });

  describe('drawNumber', () => {
    it('should draw from the pool', () => {
      const state = engine.initGame(players);
      const initial = state.remainingNumbers.length;
      const { state: newState, number } = engine.drawNumber(state);
      expect(number).toBeGreaterThanOrEqual(1);
      expect(number).toBeLessThanOrEqual(75);
      expect(newState.remainingNumbers).toHaveLength(initial - 1);
      expect(newState.calledNumbers).toContain(number);
    });
  });

  describe('validateClaim', () => {
    it('should reject invalid claims', () => {
      const state = engine.initGame(players);
      const result = engine.validateClaim(state, 'player1');
      expect(result).toBeNull();
    });

    it('should accept valid claims', () => {
      const state = engine.initGame(players);
      // Force a row win on player1's board
      const board = state.boards['player1'];
      for (let col = 0; col < 5; col++) {
        board[0][col] = { ...board[0][col], marked: true };
      }
      const result = engine.validateClaim(state, 'player1');
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe('player1');
    });
  });
});

import { BingoEngine } from './bingo.engine';
import {
  createEmptyBoard,
  countCompletedLines,
  markNumberOnBoard,
  isBoardFilled,
  isNumberOnBoard,
} from './bingo.utils';
import {
  BINGO_BOARD_SIZE,
  BingoGamePhase,
} from '@multiplayer-games/shared';

describe('BingoUtils', () => {
  describe('createEmptyBoard', () => {
    it('should create a 5x5 board of zeros', () => {
      const board = createEmptyBoard();
      expect(board).toHaveLength(BINGO_BOARD_SIZE);
      board.forEach((row) => {
        expect(row).toHaveLength(BINGO_BOARD_SIZE);
        row.forEach((cell) => {
          expect(cell.value).toBe(0);
          expect(cell.marked).toBe(false);
        });
      });
    });
  });

  describe('markNumberOnBoard', () => {
    it('should mark the correct cell', () => {
      const board = createEmptyBoard();
      board[0][0] = { value: 7, marked: false };
      markNumberOnBoard(board, 7);
      expect(board[0][0].marked).toBe(true);
    });

    it('should not mark cells with different values', () => {
      const board = createEmptyBoard();
      board[0][0] = { value: 7, marked: false };
      board[0][1] = { value: 8, marked: false };
      markNumberOnBoard(board, 7);
      expect(board[0][1].marked).toBe(false);
    });
  });

  describe('countCompletedLines', () => {
    it('should return 0 for empty board', () => {
      const board = createEmptyBoard();
      expect(countCompletedLines(board)).toBe(0);
    });

    it('should detect a completed row', () => {
      const board = createEmptyBoard();
      for (let col = 0; col < 5; col++) {
        board[0][col] = { value: col + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should detect a completed column', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < 5; row++) {
        board[row][0] = { value: row + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should detect a diagonal', () => {
      const board = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board[i][i] = { value: i + 1, marked: true };
      }
      expect(countCompletedLines(board)).toBe(1);
    });

    it('should count multiple lines', () => {
      const board = createEmptyBoard();
      // Fill entire board marked → 5 rows + 5 cols + 2 diags = 12
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          board[r][c] = { value: r * 5 + c + 1, marked: true };
        }
      }
      expect(countCompletedLines(board)).toBe(12);
    });
  });

  describe('isBoardFilled', () => {
    it('should return false for empty board', () => {
      expect(isBoardFilled(createEmptyBoard())).toBe(false);
    });

    it('should return true when all cells have values', () => {
      const board = createEmptyBoard();
      let n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          board[r][c] = { value: n++, marked: false };
        }
      }
      expect(isBoardFilled(board)).toBe(true);
    });
  });

  describe('isNumberOnBoard', () => {
    it('should find a placed number', () => {
      const board = createEmptyBoard();
      board[2][3] = { value: 15, marked: false };
      expect(isNumberOnBoard(board, 15)).toBe(true);
    });

    it('should not find an unplaced number', () => {
      const board = createEmptyBoard();
      expect(isNumberOnBoard(board, 15)).toBe(false);
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
    it('should create empty boards for each player in setup phase', () => {
      const state = engine.initGame(players);
      expect(Object.keys(state.boards)).toHaveLength(2);
      expect(state.phase).toBe(BingoGamePhase.SETUP);
      expect(state.setupDone).toEqual([]);
      expect(state.playerIds).toEqual(players);
    });
  });

  describe('placeNumber', () => {
    it('should place a number on an empty cell', () => {
      const state = engine.initGame(players);
      const result = engine.placeNumber(state, 'player1', 0, 0, 1);
      expect(result.valid).toBe(true);
      expect(state.boards['player1'][0][0].value).toBe(1);
    });

    it('should reject placing on an occupied cell', () => {
      const state = engine.initGame(players);
      engine.placeNumber(state, 'player1', 0, 0, 1);
      const result = engine.placeNumber(state, 'player1', 0, 0, 2);
      expect(result.valid).toBe(false);
    });

    it('should reject placing a duplicate number', () => {
      const state = engine.initGame(players);
      engine.placeNumber(state, 'player1', 0, 0, 5);
      const result = engine.placeNumber(state, 'player1', 0, 1, 5);
      expect(result.valid).toBe(false);
    });

    it('should transition to PLAYING when both boards are full', () => {
      const state = engine.initGame(players);
      let n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.placeNumber(state, 'player1', r, c, n++);
        }
      }
      expect(state.setupDone).toContain('player1');
      expect(state.phase).toBe(BingoGamePhase.SETUP);

      n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.placeNumber(state, 'player2', r, c, n++);
        }
      }
      expect(state.phase).toBe(BingoGamePhase.PLAYING);
      expect(state.currentTurn).toBe('player1');
    });
  });

  describe('chooseNumber', () => {
    function setupFullBoards(state: ReturnType<typeof engine.initGame>) {
      // Player 1: sequential 1-25
      let n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.placeNumber(state, 'player1', r, c, n++);
        }
      }
      // Player 2: sequential 1-25
      n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.placeNumber(state, 'player2', r, c, n++);
        }
      }
    }

    it('should reject moves when not your turn', () => {
      const state = engine.initGame(players);
      setupFullBoards(state);
      const result = engine.chooseNumber(state, 'player2', 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Not your turn');
    });

    it('should mark the number on both boards and advance turn', () => {
      const state = engine.initGame(players);
      setupFullBoards(state);
      const result = engine.chooseNumber(state, 'player1', 1);
      expect(result.valid).toBe(true);
      expect(state.boards['player1'][0][0].marked).toBe(true);
      expect(state.boards['player2'][0][0].marked).toBe(true);
      expect(state.currentTurn).toBe('player2');
    });

    it('should reject already-chosen numbers', () => {
      const state = engine.initGame(players);
      setupFullBoards(state);
      engine.chooseNumber(state, 'player1', 1);
      engine.chooseNumber(state, 'player2', 2);
      const result = engine.chooseNumber(state, 'player1', 1);
      expect(result.valid).toBe(false);
    });

    it('should detect a winner when 5 lines are completed', () => {
      const state = engine.initGame(players);
      setupFullBoards(state);

      // Both players have the same board layout (1-25 sequentially).
      // Rows are: [1,2,3,4,5], [6,7,8,9,10], [11,12,13,14,15], [16,17,18,19,20], [21,22,23,24,25]
      // Choose all 25 numbers alternating turns, which completes all lines.
      // Choosing 1,2,3,4,5 completes row 1 (line 1).
      // Then 6,7,8,… etc.
      const turnOrder = [
        1, 6, 2, 7, 3, 8, 4, 9, 5, // after 5 chosen by p1: row 1 done (1 line for p1)
        10, // p2 chooses 10
        11, 16, 12, 17, 13, 18, 14, 19, 15, // p1 completes rows
        20, 21, 22, 23, 24, 25,
      ];

      let lastResult;
      for (const num of turnOrder) {
        lastResult = engine.chooseNumber(state, state.currentTurn!, num);
        if (lastResult.winner) break;
      }

      expect(state.phase).toBe(BingoGamePhase.FINISHED);
      expect(state.winnerId).toBeDefined();
    });
  });

  describe('getPlayerView', () => {
    it('should hide opponent board during setup', () => {
      const state = engine.initGame(players);
      const view = engine.getPlayerView(state, 'player1');
      expect(view.board).toBeDefined();
      expect(view.opponentBoard).toBeNull();
      expect(view.phase).toBe(BingoGamePhase.SETUP);
    });

    it('should show opponent board during playing', () => {
      const state = engine.initGame(players);
      // Fill both boards
      let n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.placeNumber(state, 'player1', r, c, n++);
        }
      }
      n = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.placeNumber(state, 'player2', r, c, n++);
        }
      }

      const view = engine.getPlayerView(state, 'player1');
      expect(view.opponentBoard).not.toBeNull();
      expect(view.phase).toBe(BingoGamePhase.PLAYING);
    });
  });
});

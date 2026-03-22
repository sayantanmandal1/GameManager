/**
 * Tests for components/bingo/BingoBoard.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BingoBoard } from './BingoBoard';
import type { BingoBoard as BingoBoardType } from '@/shared';

// Mock framer-motion to render plain elements
jest.mock('framer-motion', () => ({
  motion: {
    button: React.forwardRef(({ children, animate, whileTap, ...props }: any, ref: any) => (
      <button ref={ref} {...props}>{children}</button>
    )),
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function createEmptyBoard(): BingoBoardType {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({ value: 0, marked: false })),
  );
}

function createFilledBoard(): BingoBoardType {
  let n = 1;
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({ value: n++, marked: false })),
  );
}

describe('BingoBoard Component', () => {
  describe('rendering', () => {
    it('should render BINGO header letters', () => {
      render(<BingoBoard board={createEmptyBoard()} />);
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('I')).toBeInTheDocument();
      expect(screen.getByText('N')).toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
      expect(screen.getByText('O')).toBeInTheDocument();
    });

    it('should render 25 board cells', () => {
      const { container } = render(<BingoBoard board={createEmptyBoard()} />);
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(25);
    });

    it('should display cell values when filled', () => {
      render(<BingoBoard board={createFilledBoard()} />);
      for (let i = 1; i <= 25; i++) {
        expect(screen.getByText(String(i))).toBeInTheDocument();
      }
    });

    it('should show label when provided', () => {
      render(<BingoBoard board={createEmptyBoard()} label="Your Board" />);
      expect(screen.getByText('Your Board')).toBeInTheDocument();
    });

    it('should not show label when not provided', () => {
      render(<BingoBoard board={createEmptyBoard()} />);
      expect(screen.queryByText('Your Board')).not.toBeInTheDocument();
    });
  });

  describe('setup phase interaction', () => {
    it('should call onCellClick when clicking an empty cell in setup mode', () => {
      const onClick = jest.fn();
      render(
        <BingoBoard
          board={createEmptyBoard()}
          onCellClick={onClick}
          nextPlaceNumber={1}
        />,
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      expect(onClick).toHaveBeenCalledWith(0, 0);
    });

    it('should not call onCellClick when disabled', () => {
      const onClick = jest.fn();
      render(
        <BingoBoard
          board={createEmptyBoard()}
          onCellClick={onClick}
          nextPlaceNumber={1}
          disabled
        />,
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should not trigger onCellClick on a filled cell', () => {
      const onClick = jest.fn();
      const board = createEmptyBoard();
      board[0][0] = { value: 5, marked: false };
      render(
        <BingoBoard
          board={board}
          onCellClick={onClick}
          nextPlaceNumber={6}
        />,
      );

      // Click the cell that already has value 5
      const cell5 = screen.getByText('5');
      fireEvent.click(cell5);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('play phase interaction', () => {
    it('should call onNumberChoose when clicking an unchosen number', () => {
      const onChoose = jest.fn();
      const board = createFilledBoard();
      render(
        <BingoBoard
          board={board}
          onNumberChoose={onChoose}
          chosenNumbers={[]}
          isMyTurn={true}
        />,
      );

      fireEvent.click(screen.getByText('1'));
      expect(onChoose).toHaveBeenCalledWith(1);
    });

    it('should not call onNumberChoose when not my turn', () => {
      const onChoose = jest.fn();
      render(
        <BingoBoard
          board={createFilledBoard()}
          onNumberChoose={onChoose}
          chosenNumbers={[]}
          isMyTurn={false}
        />,
      );

      fireEvent.click(screen.getByText('1'));
      expect(onChoose).not.toHaveBeenCalled();
    });

    it('should not call onNumberChoose on an already chosen number', () => {
      const onChoose = jest.fn();
      const board = createFilledBoard();
      board[0][0].marked = true;
      render(
        <BingoBoard
          board={board}
          onNumberChoose={onChoose}
          chosenNumbers={[1]}
          isMyTurn={true}
        />,
      );

      // Number 1 is already chosen and marked
      fireEvent.click(screen.getByText('1'));
      expect(onChoose).not.toHaveBeenCalled();
    });

    it('should not call onNumberChoose when disabled', () => {
      const onChoose = jest.fn();
      render(
        <BingoBoard
          board={createFilledBoard()}
          onNumberChoose={onChoose}
          chosenNumbers={[]}
          isMyTurn={true}
          disabled
        />,
      );

      fireEvent.click(screen.getByText('1'));
      expect(onChoose).not.toHaveBeenCalled();
    });
  });
});

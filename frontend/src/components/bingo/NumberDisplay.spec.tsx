/**
 * Tests for components/bingo/NumberDisplay.tsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NumberDisplay } from './NumberDisplay';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
    button: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <button ref={ref} {...props}>{children}</button>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('NumberDisplay Component', () => {
  const defaultProps = {
    chosenNumbers: [],
    calledBy: {},
    isMyTurn: false,
    myCompletedLines: 0,
    userId: 'player1',
    playerNames: { player1: 'Alice', player2: 'Bob' },
  };

  describe('turn indicator', () => {
    it('should show "Your Turn" when isMyTurn is true', () => {
      render(<NumberDisplay {...defaultProps} isMyTurn={true} />);
      expect(screen.getByText(/Your Turn/)).toBeInTheDocument();
    });

    it('should show "Opponent\'s Turn" when isMyTurn is false', () => {
      render(<NumberDisplay {...defaultProps} isMyTurn={false} />);
      expect(screen.getByText(/Opponent.*Turn/)).toBeInTheDocument();
    });
  });

  describe('strategy hint', () => {
    it('should show hint when it is your turn and not disabled', () => {
      render(<NumberDisplay {...defaultProps} isMyTurn={true} />);
      expect(screen.getByText(/completes YOUR lines/)).toBeInTheDocument();
    });

    it('should not show hint when disabled', () => {
      render(<NumberDisplay {...defaultProps} isMyTurn={true} disabled />);
      expect(screen.queryByText(/completes YOUR lines/)).not.toBeInTheDocument();
    });

    it('should not show hint when not your turn', () => {
      render(<NumberDisplay {...defaultProps} isMyTurn={false} />);
      expect(screen.queryByText(/completes YOUR lines/)).not.toBeInTheDocument();
    });
  });

  describe('BINGO progress', () => {
    it('should show 0/5 lines when no lines completed', () => {
      render(<NumberDisplay {...defaultProps} myCompletedLines={0} />);
      expect(screen.getByText('0/5 lines')).toBeInTheDocument();
    });

    it('should show 3/5 lines when 3 lines completed', () => {
      render(<NumberDisplay {...defaultProps} myCompletedLines={3} />);
      expect(screen.getByText('3/5 lines')).toBeInTheDocument();
    });

    it('should display BINGO letters', () => {
      render(<NumberDisplay {...defaultProps} />);
      const letters = ['B', 'I', 'N', 'G', 'O'];
      letters.forEach((letter) => {
        // BINGO letters in progress section
        expect(screen.getAllByText(letter).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('last called number', () => {
    it('should display the last called number', () => {
      render(
        <NumberDisplay
          {...defaultProps}
          chosenNumbers={[5, 12]}
          calledBy={{ 5: 'player1', 12: 'player2' }}
        />,
      );
      // The last called number appears in both "Last Called" and history.
      // Just verify both sections exist.
      expect(screen.getByText('Last Called')).toBeInTheDocument();
      expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    });

    it('should show "You" when you called the last number', () => {
      render(
        <NumberDisplay
          {...defaultProps}
          chosenNumbers={[5]}
          calledBy={{ 5: 'player1' }}
        />,
      );
      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('should show opponent name when they called the last number', () => {
      render(
        <NumberDisplay
          {...defaultProps}
          chosenNumbers={[5]}
          calledBy={{ 5: 'player2' }}
        />,
      );
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should not show last called section when no numbers called', () => {
      render(<NumberDisplay {...defaultProps} chosenNumbers={[]} />);
      expect(screen.queryByText('Last Called')).not.toBeInTheDocument();
    });
  });

  describe('called numbers history', () => {
    it('should show "No numbers called yet" when empty', () => {
      render(<NumberDisplay {...defaultProps} />);
      expect(screen.getByText('No numbers called yet')).toBeInTheDocument();
    });

    it('should display called numbers count', () => {
      render(
        <NumberDisplay
          {...defaultProps}
          chosenNumbers={[1, 2, 3]}
          calledBy={{ 1: 'player1', 2: 'player2', 3: 'player1' }}
        />,
      );
      expect(screen.getByText('Called Numbers (3/25)')).toBeInTheDocument();
    });

    it('should show all called numbers', () => {
      render(
        <NumberDisplay
          {...defaultProps}
          chosenNumbers={[7, 14, 21]}
          calledBy={{ 7: 'player1', 14: 'player2', 21: 'player1' }}
        />,
      );
      // Numbers appear in both Last Called and history — use getAllByText
      expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('14').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('21').length).toBeGreaterThanOrEqual(1);
    });
  });
});

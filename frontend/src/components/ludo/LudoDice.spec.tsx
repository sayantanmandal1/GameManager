/**
 * Tests for components/ludo/LudoDice.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LudoDice } from './LudoDice';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, className, style, ...props }: any, ref: any) => (
      <div ref={ref} className={className} style={style}>{children}</div>
    )),
    button: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <button ref={ref} {...props}>{children}</button>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('LudoDice Component', () => {
  const defaultProps = {
    dice: null as [number, number] | null,
    isRolling: false,
    onRoll: jest.fn(),
    disabled: false,
    isMyTurn: true,
    showRollButton: true,
  };

  beforeEach(() => {
    defaultProps.onRoll = jest.fn();
  });

  it('should show placeholder dice when no dice rolled', () => {
    const { container } = render(<LudoDice {...defaultProps} />);
    const placeholders = container.querySelectorAll('.text-game-muted');
    expect(placeholders.length).toBeGreaterThanOrEqual(2);
  });

  it('should show dice values when rolled', () => {
    const { container } = render(
      <LudoDice {...defaultProps} dice={[3, 5]} />,
    );
    // Dice faces render SVG circles for dots
    const circles = container.querySelectorAll('circle');
    // 3 dots + 5 dots = 8 dots total
    expect(circles).toHaveLength(8);
  });

  it('should show roll button when showRollButton is true', () => {
    render(<LudoDice {...defaultProps} showRollButton={true} />);
    expect(screen.getByText(/Roll/i)).toBeInTheDocument();
  });

  it('should not show roll button when showRollButton is false', () => {
    render(<LudoDice {...defaultProps} showRollButton={false} />);
    expect(screen.queryByText(/Roll/i)).not.toBeInTheDocument();
  });

  it('should show sum when dice are present and not rolling', () => {
    render(
      <LudoDice {...defaultProps} dice={[4, 3]} />,
    );
    // "Total:" is a text node, "7" is inside a child <span>
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});

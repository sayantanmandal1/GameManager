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
    dice: null as number | null,
    isRolling: false,
    onRoll: jest.fn(),
    disabled: false,
    isMyTurn: true,
    showRollButton: true,
  };

  beforeEach(() => {
    defaultProps.onRoll = jest.fn();
  });

  it('should show placeholder when no dice rolled', () => {
    const { container } = render(<LudoDice {...defaultProps} />);
    const placeholder = container.querySelector('.text-2xl');
    expect(placeholder).toBeInTheDocument();
  });

  it('should show dice value when rolled', () => {
    const { container } = render(
      <LudoDice {...defaultProps} dice={3} />,
    );
    // Dice face renders SVG circles for dots: 3 dots
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
  });

  it('should show roll button when showRollButton is true', () => {
    render(<LudoDice {...defaultProps} showRollButton={true} />);
    expect(screen.getByText(/Roll/i)).toBeInTheDocument();
  });

  it('should not show roll button when showRollButton is false', () => {
    render(<LudoDice {...defaultProps} showRollButton={false} />);
    expect(screen.queryByText(/Roll/i)).not.toBeInTheDocument();
  });

  it('should show rolled value when dice are present and not rolling', () => {
    render(
      <LudoDice {...defaultProps} dice={4} />,
    );
    expect(screen.getByText('Rolled:')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

/**
 * Tests for components/ui/Card.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, whileHover, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
    },
    type: { HTMLMotionProps: {} },
  };
});

describe('Card Component', () => {
  it('should render children', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('should apply className prop', () => {
    const { container } = render(<Card className="custom-class">Test</Card>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('supports keyboard activation when clickable', () => {
    const onClick = jest.fn();
    render(<Card hoverable onClick={onClick}>Create Lobby</Card>);
    const card = screen.getByRole('button', { name: 'Create Lobby' });
    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not put a non-interactive card in the tab order', () => {
    const { container } = render(<Card>Player list</Card>);
    expect(container.firstChild).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

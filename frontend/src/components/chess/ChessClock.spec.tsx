/**
 * Tests for components/chess/ChessClock.tsx
 */
import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { ChessClock } from './ChessClock';

describe('ChessClock', () => {
  const base = {
    label: 'white' as const,
    remainingMs: 60_000,
    lastTickAt: 1_000_000,
    active: true,
    untimed: false,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(base.lastTickAt);
    // jsdom: polyfill requestAnimationFrame via setTimeout
    (global as unknown as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
    (global as unknown as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame =
      (h: number) => clearTimeout(h as unknown as NodeJS.Timeout);
  });

  afterEach(() => {
    jest.useRealTimers();
    (Date.now as unknown as jest.SpyInstance).mockRestore?.();
  });

  it('renders initial remaining time', () => {
    render(<ChessClock {...base} active={false} />);
    expect(screen.getByTestId('chess-clock-white')).toHaveTextContent('1:00');
  });

  it('shows ∞ when untimed', () => {
    render(<ChessClock {...base} untimed />);
    expect(screen.getByTestId('chess-clock-white')).toHaveTextContent('∞');
  });

  it('interpolates downward when active', () => {
    render(<ChessClock {...base} remainingMs={10_000} />);
    (Date.now as unknown as jest.Mock).mockReturnValue(base.lastTickAt + 3_000);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    const text = screen.getByTestId('chess-clock-white').textContent ?? '';
    // Expect 00:07 or less (depending on tick granularity)
    expect(text).toMatch(/0:0[5-9]|0:07|0:08|0:06|0:05/);
  });

  it('stops at 0 and shows flagged label', () => {
    render(<ChessClock {...base} remainingMs={500} />);
    (Date.now as unknown as jest.Mock).mockReturnValue(base.lastTickAt + 10_000);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('chess-clock-white').textContent).toContain('Flag fell');
  });
});

import { act, render, screen } from '@testing-library/react';
import { GameConnectionState } from './GameConnectionState';

describe('GameConnectionState', () => {
  afterEach(() => jest.useRealTimers());

  it('offers recovery and a game-specific exit immediately', () => {
    render(<GameConnectionState backHref="/games/bluff" />);
    expect(screen.getByRole('heading', { name: 'Connecting to your table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Back to games' })).toHaveAttribute('href', '/games/bluff');
  });

  it('explains a slow connection and restarts the hint after connecting', () => {
    jest.useFakeTimers();
    const { rerender } = render(<GameConnectionState backHref="/games/bluff" />);
    act(() => jest.advanceTimersByTime(8_000));
    expect(screen.getByRole('status')).toHaveTextContent('taking longer than expected');
    rerender(<GameConnectionState connected backHref="/games/bluff" />);
    expect(screen.getByRole('heading', { name: 'Restoring your match' })).toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent('taking longer');
  });

  it('surfaces an explicit server error instead of an endless loading state', () => {
    render(<GameConnectionState connected error="This room no longer exists." backHref="/games/bluff" />);
    expect(screen.getByRole('alert')).toHaveTextContent('This room no longer exists.');
    expect(screen.getByRole('heading', { name: 'Unable to open the table' })).toBeInTheDocument();
  });
});

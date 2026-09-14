import { fireEvent, render, screen } from '@testing-library/react';
import type { WrongwayPlayerView } from '@/shared';
import { WrongwayRenderer } from './WrongwayRenderer';

const BOARD_SIZE = 9;

function toIndex(row: number, column: number): number {
  return row * BOARD_SIZE + column;
}

function makeView(overrides: Partial<WrongwayPlayerView> = {}): WrongwayPlayerView {
  return {
    gameKey: 'wrongway',
    players: [
      {
        id: 'p-red',
        name: 'Red A',
        color: 'red',
        position: { row: 8, column: 4 },
        goalRow: 0,
        wallsRemaining: 10,
      },
      {
        id: 'p-blue',
        name: 'Blue B',
        color: 'blue',
        position: { row: 0, column: 4 },
        goalRow: 8,
        wallsRemaining: 9,
      },
    ],
    walls: [],
    currentTurnId: 'p-red',
    phase: 'playing',
    winnerId: null,
    canAct: true,
    legalMoves: [toIndex(7, 4), toIndex(8, 3), toIndex(8, 5)],
    legalWallPlacements: [
      { row: 3, column: 3, orientation: 'horizontal' },
      { row: 2, column: 2, orientation: 'vertical' },
    ],
    ...overrides,
  };
}

describe('WrongwayRenderer', () => {
  it('renders 81 cells and both pawns at correct positions', () => {
    const { container } = render(<WrongwayRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    expect(container.querySelectorAll('[data-wrongway-cell]')).toHaveLength(81);
    expect(container.querySelector('[data-pawn-player-id="p-red"]')?.getAttribute('data-pawn-row')).toBe('8');
    expect(container.querySelector('[data-pawn-player-id="p-red"]')?.getAttribute('data-pawn-column')).toBe('4');
    expect(container.querySelector('[data-pawn-player-id="p-blue"]')?.getAttribute('data-pawn-row')).toBe('0');
    expect(container.querySelector('[data-pawn-player-id="p-blue"]')?.getAttribute('data-pawn-column')).toBe('4');
  });

  it('in move mode dispatches exact legal move and rejects illegal interaction', () => {
    const onAction = jest.fn();
    const { container } = render(<WrongwayRenderer view={makeView({ legalMoves: [toIndex(7, 4)] })} disabled={false} onAction={onAction} />);

    const legalCell = container.querySelector('[data-cell-index="67"]') as HTMLButtonElement;
    const illegalCell = container.querySelector('[data-cell-index="66"]') as HTMLButtonElement;

    expect(legalCell).toBeEnabled();
    expect(illegalCell).toBeDisabled();

    fireEvent.click(legalCell);
    fireEvent.click(illegalCell);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ type: 'wrongway_move', cell: toIndex(7, 4) });
  });

  it('in wall mode supports orientation switching, dispatches legal anchor, and disables illegal anchors', () => {
    const onAction = jest.fn();
    const { container } = render(<WrongwayRenderer view={makeView()} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Wall mode' }));

    const legalHorizontal = container.querySelector('[data-wall-anchor-row="3"][data-wall-anchor-column="3"][data-wall-anchor-orientation="horizontal"]') as HTMLButtonElement;
    const illegalHorizontal = container.querySelector('[data-wall-anchor-row="0"][data-wall-anchor-column="0"][data-wall-anchor-orientation="horizontal"]') as HTMLButtonElement;

    expect(legalHorizontal).toBeEnabled();
    expect(illegalHorizontal).toBeDisabled();

    fireEvent.click(legalHorizontal);
    expect(onAction).toHaveBeenCalledWith({ type: 'wrongway_place_wall', row: 3, column: 3, orientation: 'horizontal' });

    fireEvent.click(screen.getByRole('button', { name: 'Vertical orientation' }));

    const legalVertical = container.querySelector('[data-wall-anchor-row="2"][data-wall-anchor-column="2"][data-wall-anchor-orientation="vertical"]') as HTMLButtonElement;
    const illegalVertical = container.querySelector('[data-wall-anchor-row="3"][data-wall-anchor-column="3"][data-wall-anchor-orientation="vertical"]') as HTMLButtonElement;

    expect(legalVertical).toBeEnabled();
    expect(illegalVertical).toBeDisabled();

    fireEvent.click(legalVertical);
    expect(onAction).toHaveBeenCalledWith({ type: 'wrongway_place_wall', row: 2, column: 2, orientation: 'vertical' });
  });

  it('renders existing horizontal and vertical walls with stable data attributes', () => {
    const { container } = render(
      <WrongwayRenderer
        view={makeView({
          walls: [
            { row: 1, column: 2, orientation: 'horizontal', ownerId: 'p-red', color: 'red' },
            { row: 4, column: 5, orientation: 'vertical', ownerId: 'p-blue', color: 'blue' },
          ],
        })}
        disabled={false}
        onAction={jest.fn()}
      />,
    );

    expect(container.querySelector('[data-wall-row="1"][data-wall-column="2"][data-wall-orientation="horizontal"]')).not.toBeNull();
    expect(container.querySelector('[data-wall-row="4"][data-wall-column="5"][data-wall-orientation="vertical"]')).not.toBeNull();
    expect(container.querySelector('[data-wall-row="1"]')?.getAttribute('data-wall-color')).toBe('red');
    expect(container.querySelector('[data-wall-row="4"]')?.getAttribute('data-wall-color')).toBe('blue');
  });

  it('shows turn, wall inventory, and winner state', () => {
    render(
      <WrongwayRenderer
        view={makeView({
          currentTurnId: 'p-blue',
          phase: 'finished',
          winnerId: 'p-blue',
        })}
        disabled={false}
        onAction={jest.fn()}
      />,
    );

    expect(screen.getByText('Turn: Blue B')).toBeInTheDocument();
    expect(screen.getByText('Walls: 10')).toBeInTheDocument();
    expect(screen.getByText('Walls: 9')).toBeInTheDocument();
    expect(screen.getByText('Winner: Blue B')).toBeInTheDocument();
  });
});
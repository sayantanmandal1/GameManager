import { fireEvent, render, screen } from '@testing-library/react';
import { ArcadeBoard } from './ArcadeBoard';
import { ArcadePhase, type ArcadePlayerView } from '@/shared';

jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
}));

const base: ArcadePlayerView = {
  gameKey: 'test',
  family: 'alignment',
  phase: ArcadePhase.PLAYING,
  players: [
    { id: 'p1', name: 'Alice', score: 0 },
    { id: 'p2', name: 'Bob', score: 0 },
  ],
  currentTurn: 'p1',
  canAct: true,
  winnerId: null,
  isDraw: false,
  alignment: null,
  takeaway: null,
  race: null,
  memory: null,
};

describe('ArcadeBoard', () => {
  it('renders and submits alignment cells', () => {
    const onAction = jest.fn();
    render(
      <ArcadeBoard
        view={{ ...base, alignment: { board: Array(9).fill(null), size: 3, connect: 3, gravity: false, misere: false, pieceLimit: 0 } }}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cell 1' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'place', index: 0 });
  });

  it('offers only legal take counts for a heap', () => {
    const onAction = jest.fn();
    render(
      <ArcadeBoard
        view={{ ...base, family: 'takeaway', takeaway: { heaps: [2], maxTake: 3, misere: false } }}
        onAction={onAction}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Take 3' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take 2' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'take', heap: 0, count: 2 });
  });

  it('renders race progress and requests a server roll', () => {
    const onAction = jest.fn();
    render(
      <ArcadeBoard
        view={{ ...base, family: 'race', race: { boardSize: 30, dieSides: 6, exactFinish: true, positions: { p1: 8, p2: 4 }, jumps: {}, lastRoll: null } }}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll d6' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'roll' });
    expect(screen.getByText('8/30')).toBeInTheDocument();
  });

  it('keeps memory tiles hidden until the server reveals them', () => {
    const onAction = jest.fn();
    render(
      <ArcadeBoard
        view={{ ...base, family: 'memory', memory: { tiles: [null, 'animals-1', null, 'animals-1'], matchedBy: [null, null, null, 'p1'], revealed: [1], pairs: 2, theme: 'animals', pendingContinue: false } }}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('button', { name: 'Hidden tile 1' })).toHaveTextContent('?');
    expect(screen.getByRole('button', { name: 'Tile 2: animals-1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tile 2: animals-1' })).toHaveTextContent('🐶');
    fireEvent.click(screen.getByRole('button', { name: 'Hidden tile 3' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'flip', index: 2 });
  });
});

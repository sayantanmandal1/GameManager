import { fireEvent, render, screen } from '@testing-library/react';
import type { LiarsDicePlayerView } from '@/shared';
import { LiarsDiceRenderer } from './LiarsDiceRenderer';

afterEach(() => jest.restoreAllMocks());

const view: LiarsDicePlayerView = {
  gameKey: 'liars-dice', players: [
    { id: 'a', name: 'Alice', diceCount: 5 },
    { id: 'b', name: 'Bob', diceCount: 5 },
  ],
  youId: 'a', yourDice: [1, 2, 3, 4, 5], currentTurnId: 'a',
  currentBid: null, round: 1, phase: 'playing', winnerId: null,
  canAct: true, totalDice: 10, lastResolution: null,
  hostId: 'a', mode: 'classic', penalties: { a: 0, b: 0 },
  lastReveal: null, canChallenge: false, canSpotOn: false,
};

describe('Liar dice table', () => {
  it('shows character portraits and announces a new Spot on reveal once', () => {
    const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { rerender } = render(<LiarsDiceRenderer view={view} disabled={false} onAction={jest.fn()} />);
    expect(screen.getAllByRole('img', { name: /portrait for/ })).toHaveLength(2);

    const bid = { quantity: 2, face: 4, bidderId: 'a' };
    const revealView = {
      ...view,
      phase: 'reveal' as const,
      currentBid: bid,
      lastReveal: { bid, callerId: 'b', kind: 'spot_on' as const, dice: { a: [4, 2, 3, 5, 6], b: [4, 1, 3, 5, 6] }, actual: 2, successful: true, penalizedIds: ['a'] },
    };
    rerender(<LiarsDiceRenderer view={revealView} disabled={false} onAction={jest.fn()} />);
    expect(play).toHaveBeenCalledTimes(1);
    rerender(<LiarsDiceRenderer view={revealView} disabled={false} onAction={jest.fn()} />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1, 2])('uses the correct wording for a %i-die reveal and its bid', (actual) => {
    const bid = { quantity: Math.max(1, actual), face: 4, bidderId: 'b' };
    render(<LiarsDiceRenderer view={{
      ...view, phase: 'reveal', canAct: false, currentBid: bid,
      lastReveal: { bid, callerId: 'a', kind: 'challenge', dice: { a: [actual > 0 ? 4 : 3, 2, 3, 5, 6], b: [actual > 1 ? 4 : 2, 2, 3, 5, 6] }, actual, successful: actual < bid.quantity, penalizedIds: [actual < bid.quantity ? 'b' : 'a'] },
    }} disabled={false} onAction={jest.fn()} />);
    expect(screen.getByText(`${bid.quantity} ${bid.quantity === 1 ? 'die' : 'dice'} showing 4`)).toBeInTheDocument();
    expect(screen.getByText(`Challenge · ${actual} matching ${actual === 1 ? 'die' : 'dice'}`)).toBeInTheDocument();
  });

  it('lets the host continue after a resignation without an old dice reveal', () => {
    const onAction = jest.fn();
    render(<LiarsDiceRenderer view={{ ...view, phase: 'reveal', canAct: false, lastResolution: 'Bob resigned. The remaining players continue.' }} disabled={false} onAction={onAction} />);
    expect(screen.getByText('Bob resigned. The remaining players continue.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'next_liars_dice_round' });
  });

  it('lets players privately lift and lower their cup', () => {
    render(<LiarsDiceRenderer view={view} disabled={false} onAction={jest.fn()} />);
    expect(screen.queryByRole('img', { name: 'Your die 1: 1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lift cup · view your dice' }));
    expect(screen.getByRole('img', { name: 'Your die 1: 1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Your die 5: 5' }).querySelectorAll('.bg-\\[\\#25211c\\]')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Lower cup · hide dice' }));
    expect(screen.queryByRole('img', { name: 'Your die 1: 1' })).not.toBeInTheDocument();
  });

  it('suggests a quantity raise after six and sends the selected bid', () => {
    const onAction = jest.fn();
    render(<LiarsDiceRenderer view={{ ...view, canChallenge: true, currentBid: { quantity: 2, face: 6, bidderId: 'b' } }} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(3);
    expect(screen.getByRole('combobox', { name: 'Face' })).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'Raise bid' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bid', quantity: 3, face: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Challenge' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'challenge' });
  });

  it('rejects fractional inputs and disables all actions while disconnected', () => {
    const onAction = jest.fn();
    const { rerender } = render(<LiarsDiceRenderer view={view} disabled={false} onAction={onAction} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: 'Raise bid' })).toBeDisabled();
    rerender(<LiarsDiceRenderer view={view} disabled onAction={onAction} />);
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Face' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Challenge' })).toBeDisabled();
  });

  it('offers only calls when the bid reaches the number of dice', () => {
    render(<LiarsDiceRenderer view={{ ...view, mode: 'traditional', canChallenge: true, canSpotOn: true, currentBid: { quantity: 10, face: 6, bidderId: 'b' } }} disabled={false} onAction={jest.fn()} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Raise bid' })).not.toBeInTheDocument();
    expect(screen.getByText('No higher bid is possible. Challenge or call Spot on.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Challenge' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Spot on · exact count' })).toBeEnabled();
  });

  it('offers Classic and Traditional setup, then enables server-allowed Spot on', () => {
    const onAction = jest.fn();
    const { rerender } = render(<LiarsDiceRenderer view={{ ...view, phase: 'setup', mode: null }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Traditional · wild ones' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'select_liars_dice_mode', mode: 'traditional' });
    rerender(<LiarsDiceRenderer view={{ ...view, mode: 'traditional', canSpotOn: true, canChallenge: true, currentBid: { quantity: 3, face: 4, bidderId: 'b' } }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spot on · exact count' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'spot_on' });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'Raise bid' })).toBeDisabled();
  });
});

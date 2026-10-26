import { fireEvent, render, screen } from '@testing-library/react';
import type { BluffPlayerView } from '@/shared';
import { BluffRenderer } from './BluffRenderer';

const base: BluffPlayerView = {
  gameKey: 'bluff', players: [{ id: 'a', name: 'Alex', handCount: 2 }, { id: 'b', name: 'Blair', handCount: 2 }],
  youId: 'a', yourHand: [{ id: 'c-clubs-A', rank: 'A', suit: 'clubs' }, { id: 'c-hearts-K', rank: 'K', suit: 'hearts' }],
  pileCount: 0, discardedCount: 0, consecutivePasses: 0, currentTurnId: 'a', claimRank: null,
  pendingClaim: null, lastReveal: null, phase: 'claiming', winnerId: null,
  canAct: true, canClaim: true, canPass: false, canAccept: false, canChallenge: false,
};

describe('BluffRenderer chosen-rank controls', () => {
  it('chooses any opening rank independently of the actual cards', () => {
    const onAction = jest.fn();
    render(<BluffRenderer view={base} disabled={false} onAction={onAction} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Claim rank' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'K of hearts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1 × 5' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bluff_play', rank: '5', cardIds: ['c-hearts-K'] });
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument();
  });

  it('locks the existing rank, allows a pass and challenge, and clears selection when the turn changes', () => {
    const onAction = jest.fn();
    const view: BluffPlayerView = {
      ...base, claimRank: 'Q', canPass: true, canChallenge: true,
      pendingClaim: { playerId: 'b', count: 2, rank: 'Q' }, pileCount: 2,
    };
    const { rerender } = render(<BluffRenderer view={view} disabled={false} onAction={onAction} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'A of clubs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bluff_pass' });
    fireEvent.click(screen.getByRole('button', { name: 'Call bluff' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bluff_challenge' });
    rerender(<BluffRenderer view={{ ...view, currentTurnId: 'b', canClaim: false }} disabled={false} onAction={onAction} />);
    rerender(<BluffRenderer view={view} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'Claim — × Q' })).toBeDisabled();
  });

  it('offers only final-claim acceptance or challenge, not ordinary play', () => {
    const onAction = jest.fn();
    render(<BluffRenderer view={{
      ...base, phase: 'challenge', canClaim: false, canAccept: true, canChallenge: true,
      claimRank: 'K', pendingClaim: { playerId: 'b', count: 1, rank: 'K' },
    }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Let it stand' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bluff_accept' });
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Claim / })).not.toBeInTheDocument();
  });

  it('limits selection to four cards and disables all actions after completion', () => {
    const onAction = jest.fn();
    const hand: BluffPlayerView['yourHand'] = ['A', '2', '3', '4', '5'].map((rank) => ({
      id: rank, rank: rank as BluffPlayerView['yourHand'][number]['rank'], suit: 'clubs',
    }));
    const { rerender } = render(<BluffRenderer view={{ ...base, yourHand: hand }} disabled={false} onAction={onAction} />);
    hand.forEach((card) => fireEvent.click(screen.getByRole('button', { name: `${card.rank} of clubs` })));
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(4);
    rerender(<BluffRenderer view={{ ...base, canClaim: false, canAccept: true, canChallenge: true, pendingClaim: { playerId: 'b', count: 1, rank: 'A' } }} disabled onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'Call bluff' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Let it stand' })).toBeDisabled();
  });
});

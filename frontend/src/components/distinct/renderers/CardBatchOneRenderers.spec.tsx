import { fireEvent, render, screen } from '@testing-library/react';
import type {
  BluffPlayerView,
  BourrePlayerView,
  NinetyNinePlayerView,
  SevensPlayerView,
  StandardCard,
} from '@/shared';
import { BluffRenderer } from './BluffRenderer';
import { BourreRenderer } from './BourreRenderer';
import { NinetyNineRenderer } from './NinetyNineRenderer';
import { SevensRenderer } from './SevensRenderer';

const aceHearts: StandardCard = { id: 'c-hearts-A', suit: 'hearts', rank: 'A' };
const sevenHearts: StandardCard = { id: 'c-hearts-7', suit: 'hearts', rank: '7' };
const kingClubs: StandardCard = { id: 'c-clubs-K', suit: 'clubs', rank: 'K' };
const players = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' }];

describe('first card batch renderers', () => {
  it('submits selected Bourré discards and respects forced dealer stay', () => {
    const onAction = jest.fn();
    const view: BourrePlayerView = {
      gameKey: 'bourre',
      players: players.map((player) => ({ ...player, handCount: 2, decision: 'pending', tricksWon: 0, score: 0 })),
      hostId: 'a', youId: 'a', yourHand: [aceHearts, kingClubs], dealerId: 'a', trumpSuit: 'hearts',
      trumpCard: aceHearts, currentTurnId: 'a', leaderId: null, trick: [], pot: 2, handNumber: 1,
      lastHand: null, phase: 'deciding', winnerId: null, isDraw: false, canAct: true, canFold: false, legalCardIds: [],
    };
    render(<BourreRenderer view={view} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'K of clubs' }));
    expect(screen.getByRole('button', { name: 'Fold' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay · redraw 1' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bourre_decide', play: true, discardIds: [kingClubs.id] });
  });

  it('submits one to four selected Bluff cards and exposes a challenge', () => {
    const claim = jest.fn();
    const base: BluffPlayerView = {
      gameKey: 'bluff', players: players.map((player) => ({ ...player, handCount: 2 })),
      youId: 'a', yourHand: [aceHearts, kingClubs], pileCount: 0, currentTurnId: 'a', claimRank: 'A',
      pendingClaim: null, lastReveal: null, phase: 'claiming', winnerId: null,
      canAct: true, canClaim: true, canAccept: false, canChallenge: false,
    };
    const { rerender } = render(<BluffRenderer view={base} disabled={false} onAction={claim} />);
    fireEvent.click(screen.getByRole('button', { name: 'A of hearts' }));
    fireEvent.click(screen.getByRole('button', { name: 'K of clubs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Claim 2 × A' }));
    expect(claim).toHaveBeenCalledWith({ type: 'bluff_play', cardIds: [aceHearts.id, kingClubs.id] });

    const challenge = jest.fn();
    rerender(<BluffRenderer view={{ ...base, phase: 'challenge', canClaim: false, canChallenge: true, pendingClaim: { playerId: 'b', count: 2, rank: 'A' } }} disabled={false} onAction={challenge} />);
    fireEvent.click(screen.getByRole('button', { name: 'I doubt it' }));
    expect(challenge).toHaveBeenCalledWith({ type: 'bluff_challenge' });
  });

  it('enables only projected Sevens cards and submits a forced pass', () => {
    const onAction = jest.fn();
    const layout = {
      clubs: { low: null, high: null }, diamonds: { low: null, high: null },
      hearts: { low: null, high: null }, spades: { low: null, high: null },
    } as SevensPlayerView['layout'];
    const view: SevensPlayerView = {
      gameKey: 'sevens', players: players.map((player) => ({ ...player, handCount: 1, score: 0 })),
      hostId: 'a', youId: 'a', yourHand: [sevenHearts, kingClubs], layout, currentTurnId: 'a', dealerId: 'b',
      roundNumber: 1, lastRound: null, phase: 'playing', winnerId: null, canAct: true,
      legalCardIds: [sevenHearts.id], canPass: false,
    };
    const { rerender } = render(<SevensRenderer view={view} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('button', { name: '7 of hearts' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'K of clubs' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '7 of hearts' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_sevens_card', cardId: sevenHearts.id });

    rerender(<SevensRenderer view={{ ...view, legalCardIds: [], canPass: true }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'pass_sevens' });
  });

  it('submits only server-projected Ninety-Nine values and concession', () => {
    const onAction = jest.fn();
    const view: NinetyNinePlayerView = {
      gameKey: 'ninety-nine', players: players.map((player) => ({ ...player, handCount: 1, tokens: 3, active: true })),
      youId: 'a', yourHand: [aceHearts], total: 88, direction: 1, dealerId: 'b', currentTurnId: 'a',
      handNumber: 1, phase: 'playing', winnerId: null, canAct: true,
      legalPlays: [{ cardId: aceHearts.id, values: [1, 11] }], mustConcede: false,
    };
    const { rerender } = render(<NinetyNineRenderer view={view} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: '+11' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_ninety_nine', cardId: aceHearts.id, chosenValue: 11 });

    rerender(<NinetyNineRenderer view={{ ...view, legalPlays: [], mustConcede: true }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lose a token' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'concede_ninety_nine' });
  });
});
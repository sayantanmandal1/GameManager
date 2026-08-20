import { fireEvent, render, screen } from '@testing-library/react';
import type { EuchrePlayerView, OhHellPlayerView, StandardCard, WhistPlayerView } from '@/shared';
import { EuchreRenderer } from './EuchreRenderer';
import { OhHellRenderer } from './OhHellRenderer';
import { WhistRenderer } from './WhistRenderer';

const aceHearts: StandardCard = { id: 'c-hearts-A', suit: 'hearts', rank: 'A' };
const jackDiamonds: StandardCard = { id: 'c-diamonds-J', suit: 'diamonds', rank: 'J' };
const players = [
  { id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' },
  { id: 'c', name: 'Casey' }, { id: 'd', name: 'Devon' },
];

describe('second card batch renderers', () => {
  it('submits a lone Euchre order and a dealer-selected discard', () => {
    const onAction = jest.fn();
    const view: EuchrePlayerView = {
      gameKey: 'euchre',
      players: players.map((player, index) => ({ ...player, team: (index % 2) as 0 | 1, handCount: 5, tricksWon: 0, sittingOut: false })),
      hostId: 'a', youId: 'b', yourHand: [aceHearts, jackDiamonds], dealerId: 'a', upcard: aceHearts,
      biddingRound: 1, rejectedSuit: null, makerId: null, makerTeam: null, trumpSuit: null, alone: false,
      currentTurnId: 'b', leaderId: null, trick: [], teamScores: [0, 0], tricksWon: [0, 0], handNumber: 1,
      lastHand: null, phase: 'bidding', winnerId: null, winnerTeam: null, canAct: true,
      canPass: true, canOrderUp: true, legalTrumpSuits: [], legalCardIds: [], canDiscard: false,
    };
    const { rerender } = render(<EuchreRenderer view={view} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Go alone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Order ♥ Hearts' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'euchre_call', euchreCall: { type: 'order_up', alone: true } });

    rerender(<EuchreRenderer view={{ ...view, youId: 'a', currentTurnId: 'a', phase: 'dealer_discard', canOrderUp: false, canDiscard: true }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'J of diamonds' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'euchre_discard', cardId: jackDiamonds.id });
  });

  it('submits only the server-legal Whist card', () => {
    const onAction = jest.fn();
    const view: WhistPlayerView = {
      gameKey: 'whist',
      players: players.map((player, index) => ({ ...player, team: (index % 2) as 0 | 1, handCount: 13, tricksWon: 0 })),
      hostId: 'a', youId: 'b', yourHand: [aceHearts, jackDiamonds], dealerId: 'a', trumpCard: aceHearts,
      trumpSuit: 'hearts', trick: [], teamTricks: [0, 0], gamePoints: [0, 0], currentTurnId: 'b', leaderId: 'b',
      handNumber: 1, lastHand: null, phase: 'playing', winnerId: null, winnerTeam: null, canAct: true,
      legalCardIds: [jackDiamonds.id],
    };
    render(<WhistRenderer view={view} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'J of diamonds' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'A of hearts' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'J of diamonds' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_whist_card', cardId: jackDiamonds.id });
  });

  it('renders only hook-legal Oh Hell bids and submits exact card play', () => {
    const onAction = jest.fn();
    const base: OhHellPlayerView = {
      gameKey: 'oh-hell',
      players: players.map((player) => ({ ...player, handCount: 7, bid: null, tricksWon: 0, score: 0 })),
      hostId: 'a', youId: 'a', yourHand: [aceHearts, jackDiamonds], dealerId: 'a', dealNumber: 1, handSize: 7,
      trumpCard: aceHearts, trumpSuit: 'hearts', trick: [], currentTurnId: 'a', leaderId: 'b', lastDeal: null,
      phase: 'bidding', winnerId: null, isDraw: false, canAct: true, legalBids: [0, 2, 3], legalCardIds: [],
    };
    const { rerender } = render(<OhHellRenderer view={base} disabled={false} onAction={onAction} />);
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bid_oh_hell', bid: 2 });

    rerender(<OhHellRenderer view={{ ...base, phase: 'playing', legalBids: [], legalCardIds: [aceHearts.id] }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'A of hearts' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_oh_hell_card', cardId: aceHearts.id });
  });
});
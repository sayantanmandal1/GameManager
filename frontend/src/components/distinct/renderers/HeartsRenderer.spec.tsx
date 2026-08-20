import { fireEvent, render, screen } from '@testing-library/react';
import type { HeartsPlayerView, StandardCard } from '@/shared';
import { HeartsRenderer } from './HeartsRenderer';

const cards: StandardCard[] = [
  { id: 'c-hearts-A', suit: 'hearts', rank: 'A' },
  { id: 'c-clubs-2', suit: 'clubs', rank: '2' },
  { id: 'c-diamonds-3', suit: 'diamonds', rank: '3' },
  { id: 'c-spades-4', suit: 'spades', rank: '4' },
];

function view(overrides: Partial<HeartsPlayerView> = {}): HeartsPlayerView {
  return {
    gameKey: 'hearts',
    players: ['a', 'b', 'c', 'd'].map((id, index) => ({
      id,
      name: `Player ${index + 1}`,
      handCount: 13,
      score: 0,
      roundPoints: 0,
      passed: false,
    })),
    youId: 'a',
    yourHand: cards,
    currentTurnId: 'a',
    leaderId: null,
    trick: [],
    heartsBroken: false,
    passDirection: 'left',
    roundNumber: 1,
    phase: 'passing',
    winnerId: null,
    isDraw: false,
    canAct: true,
    legalCardIds: [],
    ...overrides,
  };
}

describe('HeartsRenderer', () => {
  it('shows three hidden opponents and submits exactly three selected pass cards', () => {
    const onAction = jest.fn();
    render(<HeartsRenderer view={view()} disabled={false} onAction={onAction} />);

    expect(screen.getAllByLabelText('13 hidden cards')).toHaveLength(3);
    for (const card of cards.slice(0, 3)) fireEvent.click(screen.getByRole('button', { name: `${card.rank} of ${card.suit}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass selected cards' }));

    expect(onAction).toHaveBeenCalledWith({
      type: 'pass_cards',
      cardIds: cards.slice(0, 3).map((card) => card.id),
    });
  });

  it('enables only server-declared cards during trick play', () => {
    const onAction = jest.fn();
    render(<HeartsRenderer view={view({
      phase: 'playing',
      passDirection: 'hold',
      legalCardIds: [cards[1].id],
    })} disabled={false} onAction={onAction} />);

    expect(screen.getByRole('button', { name: '2 of clubs' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'A of hearts' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '2 of clubs' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_card', cardId: cards[1].id });
  });
});

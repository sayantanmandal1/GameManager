import { fireEvent, render, screen, within } from '@testing-library/react';
import type { DistinctGameKey, GoFishPlayerView, SevensPlayerView } from '@/shared';
import { DistinctGamePreview } from './DistinctGamePreview';
import { GoFishRenderer } from './renderers/GoFishRenderer';
import { SevensRenderer } from './renderers/SevensRenderer';

describe('Shared standard-deck presentation', () => {
  const previews: DistinctGameKey[] = [
    'go-fish', 'crazy-eights', 'hearts', 'gin-rummy', 'card-war', 'old-maid',
    'contract-bridge', 'bourre', 'bluff', 'sevens', 'ninety-nine', 'euchre',
    'whist', 'oh-hell', 'president', 'slapjack', 'spoons',
  ];

  it.each(previews)('uses conventional artwork in the %s preview', (gameKey) => {
    const { container } = render(<DistinctGamePreview gameKey={gameKey} />);
    expect(container.querySelectorAll('[data-card-artwork]').length).toBeGreaterThan(0);
    for (const artwork of container.querySelectorAll('[data-card-artwork]')) {
      expect(artwork.querySelectorAll('text')).toHaveLength(2);
      expect(artwork.querySelectorAll('[data-card-pip], [data-card-court]').length).toBeGreaterThan(0);
    }
  });

  it('uses the shared Go Fish faces without changing rank requests', () => {
    const view: GoFishPlayerView = {
      gameKey: 'go-fish', players: [
        { id: 'a', name: 'Alice', handCount: 1, books: [] },
        { id: 'b', name: 'Bob', handCount: 7, books: [] },
      ],
      youId: 'a', yourHand: [{ id: 'h10', rank: '10', suit: 'hearts' }],
      currentTurnId: 'a', phase: 'playing', winnerId: null, isDraw: false,
      canAct: true, deckCount: 44, legalTargets: ['b'], legalRanks: ['10'], lastEvent: '',
    };
    const onAction = jest.fn();
    const { container } = render(<GoFishRenderer view={view} disabled={false} onAction={onAction} />);
    expect(screen.getByLabelText('10 of hearts')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-card-pip]')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'ask', targetPlayerId: 'b', rank: '10' });
  });

  it('shows conventional cards on the Sevens layout as well as in hand', () => {
    const view: SevensPlayerView = {
      gameKey: 'sevens', players: [{ id: 'a', name: 'Alice', handCount: 0, score: 0 }],
      hostId: 'a', youId: 'a', yourHand: [], currentTurnId: 'a', dealerId: 'a',
      roundNumber: 1, lastRound: null, phase: 'playing', winnerId: null,
      canAct: false, legalCardIds: [], canPass: false,
      layout: {
        clubs: { low: null, high: null }, diamonds: { low: null, high: null },
        hearts: { low: '7', high: '10' }, spades: { low: null, high: null },
      },
    };
    render(<SevensRenderer view={view} disabled={false} onAction={jest.fn()} />);
    const layout = within(screen.getByLabelText('Sevens layout'));
    expect(layout.getByLabelText('7 of hearts')).toBeInTheDocument();
    expect(layout.getByLabelText('10 of hearts').querySelectorAll('[data-card-pip]')).toHaveLength(10);
  });
});

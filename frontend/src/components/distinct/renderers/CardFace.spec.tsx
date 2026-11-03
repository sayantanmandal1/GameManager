import { fireEvent, render, screen } from '@testing-library/react';
import type { StandardCard } from '@/shared';
import { CardFace } from './CardFace';

const suits: StandardCard['suit'][] = ['clubs', 'diamonds', 'hearts', 'spades'];
const ranks: StandardCard['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

describe('Standard deck artwork', () => {
  it.each(suits.flatMap((suit) => ranks.map((rank) => ({ id: `${suit}-${rank}`, suit, rank }))))(
    'renders the correct face for $rank of $suit',
    (card) => {
      const { container } = render(<CardFace card={card} />);
      expect(screen.getByLabelText(`${card.rank} of ${card.suit}`)).toBeInTheDocument();
      const court = ['J', 'Q', 'K'].includes(card.rank);
      expect(container.querySelectorAll('[data-card-pip]')).toHaveLength(court ? 0 : card.rank === 'A' ? 1 : Number(card.rank));
      expect(container.querySelector('[data-card-court]')?.getAttribute('data-card-court') ?? null).toBe(court ? card.rank : null);
      expect(container.querySelectorAll('text')).toHaveLength(2);
      expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 150');
    },
  );

  it('preserves selected, disabled and accessible card interactions', () => {
    const onClick = jest.fn();
    const card: StandardCard = { id: 'h10', rank: '10', suit: 'hearts' };
    const { rerender } = render(<CardFace card={card} selected onClick={onClick} />);
    const button = screen.getByRole('button', { name: '10 of hearts' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<CardFace card={card} disabled onClick={onClick} />);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

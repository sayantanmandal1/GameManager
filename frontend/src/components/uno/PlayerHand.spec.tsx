import React from 'react';
import { render } from '@testing-library/react';
import { PlayerHand } from './PlayerHand';
import type { UnoCard } from '@/shared';

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>,
    ),
    button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      ({ children, ...props }, ref) => <button ref={ref} {...props}>{children}</button>,
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const cards: UnoCard[] = Array.from({ length: 12 }, (_, index) => ({
  id: `card-${index}`,
  color: (['red', 'yellow', 'green', 'blue'] as const)[index % 4],
  kind: 'number',
  value: index % 10,
}));

describe('PlayerHand', () => {
  it('renders every card as a separate non-overlapping rack item', () => {
    const { container } = render(
      <PlayerHand
        hand={cards}
        side="light"
        legalCardIds={[]}
        jumpInIds={[]}
        isMyTurn={false}
        playableDrawnCardId={null}
        onSelect={jest.fn()}
        onJumpIn={jest.fn()}
      />,
    );

    const rackCards = Array.from(container.querySelectorAll('[data-uno-hand-card]'));
    expect(rackCards).toHaveLength(cards.length);
    for (const card of rackCards) {
      expect((card as HTMLElement).style.marginLeft.startsWith('-')).toBe(false);
      expect(card).toHaveClass('shrink-0');
    }
  });
});
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { UnoPlayerPublic } from '@/shared';
import { OpponentSeat } from './OpponentSeat';

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>,
    ),
    button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      ({ children, ...props }, ref) => <button ref={ref} {...props}>{children}</button>,
    ),
  },
}));

const player = (visibleBackFaces: UnoPlayerPublic['visibleBackFaces']): UnoPlayerPublic => ({
  id: 'opponent',
  name: 'Opponent',
  handCount: 2,
  isConnected: true,
  calledUno: false,
  unoVulnerable: false,
  score: 0,
  eliminated: false,
  visibleBackFaces,
});

describe('OpponentSeat', () => {
  it('shows the inactive printed faces that are public in UNO Flip', () => {
    render(
      <OpponentSeat
        player={player([
          { color: 'purple', kind: 'skipAll', value: null },
          { color: 'orange', kind: 'number', value: 7 },
        ])}
        side="light"
        isCurrent={false}
        turnEndsAt={0}
        catchable={false}
        onCatch={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Purple Skip Everyone')).toBeInTheDocument();
    expect(screen.getByLabelText('Orange 7')).toBeInTheDocument();
  });

  it('uses ordinary card backs outside UNO Flip', () => {
    const { container } = render(
      <OpponentSeat
        player={player([])}
        side="light"
        isCurrent={false}
        turnEndsAt={0}
        catchable={false}
        onCatch={jest.fn()}
      />,
    );

    expect(container.querySelectorAll('[aria-label^="Purple"], [aria-label^="Orange"]'))
      .toHaveLength(0);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders every public inactive face even when the opponent holds more than seven', () => {
    const faces = Array.from({ length: 12 }, (_, index) => ({
      color: 'orange' as const,
      kind: 'number' as const,
      value: (index % 9) + 1,
    }));
    render(
      <OpponentSeat
        player={{ ...player(faces), handCount: faces.length }}
        side="light"
        isCurrent={false}
        turnEndsAt={0}
        catchable={false}
        onCatch={jest.fn()}
      />,
    );

    expect(screen.getAllByLabelText(/^Orange /)).toHaveLength(12);
  });
});
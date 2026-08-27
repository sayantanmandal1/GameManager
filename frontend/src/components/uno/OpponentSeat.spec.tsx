import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(container.querySelectorAll('[aria-label^="Purple"], [aria-label^="Orange"]')).toHaveLength(0);
    expect(screen.getAllByLabelText('UNO red card back')).toHaveLength(2);
    expect(screen.queryByLabelText('UNO purple card back')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders readable inactive faces in an expanded two-player rack', () => {
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
        expanded
      />,
    );

    expect(screen.getByLabelText('Purple Skip Everyone').firstElementChild)
      .toHaveStyle({ width: '50px', height: '75px' });
    expect(screen.getByLabelText('Orange 7').firstElementChild)
      .toHaveStyle({ width: '50px', height: '75px' });
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

  it('shows the declaration grace before enabling Catch', () => {
    const onCatch = jest.fn();
    const { rerender } = render(
      <OpponentSeat
        player={{ ...player([]), handCount: 1, unoVulnerable: true }}
        side="light"
        isCurrent={false}
        turnEndsAt={0}
        catchable={false}
        unoCallGraceMs={2_500}
        onCatch={onCatch}
      />,
    );

    expect(screen.getByText('UNO call…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Catch!' })).not.toBeInTheDocument();

    rerender(
      <OpponentSeat
        player={{ ...player([]), handCount: 1, unoVulnerable: true }}
        side="light"
        isCurrent={false}
        turnEndsAt={0}
        catchable
        unoCallGraceMs={0}
        onCatch={onCatch}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Catch!' }));
    expect(onCatch).toHaveBeenCalledTimes(1);
  });
});
import { cleanup, render } from '@testing-library/react';
import { DISTINCT_GAME_KEYS } from '@/shared';
import { DistinctGamePreview } from './DistinctGamePreview';

describe('DistinctGamePreview', () => {
  afterEach(cleanup);

  it.each(DISTINCT_GAME_KEYS)('renders a configured visual for %s', (gameKey) => {
    const { container } = render(<DistinctGamePreview gameKey={gameKey} />);

    expect(container.firstElementChild).not.toBeNull();
    if (gameKey !== 'pig') expect(container).not.toHaveTextContent('⚄');
  });

  it('renders Monopoly preview with canonical board labels and center zones', () => {
    const { container } = render(<DistinctGamePreview gameKey="monopoly" />);

    expect(container.querySelector('[data-monopoly-board][data-monopoly-board-shared="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-monopoly-board-art]')).toHaveAttribute('src', expect.stringContaining('monopoly-classic-us-board'));
    expect(container).toHaveTextContent('MONOPOLY');
    expect(container).toHaveTextContent('GO');
    expect(container).toHaveTextContent('JUST VISITING');
    expect(container).toHaveTextContent('Boardwalk');
    expect(container.querySelector('[data-deck-zone="chest"]')).toBeInTheDocument();
    expect(container.querySelector('[data-deck-zone="chance"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label*="token"]')).toHaveLength(3);
    expect(container.querySelector('[data-building-count="2"]')).toBeInTheDocument();
    expect(container.querySelector('[data-building-count="5"]')).toBeInTheDocument();
    expect(container.querySelector('[data-last-roll]')).toBeInTheDocument();
  });
});
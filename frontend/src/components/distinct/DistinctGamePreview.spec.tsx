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
});
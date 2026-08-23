import { fireEvent, render, screen } from '@testing-library/react';
import type { HangmanPlayerView } from '@/shared';
import { HangmanRenderer } from './HangmanRenderer';

const view = (overrides: Partial<HangmanPlayerView> = {}): HangmanPlayerView => ({
  gameKey: 'hangman',
  players: [{ id: 'host', name: 'Host' }, { id: 'guesser', name: 'Guesser' }],
  hostId: 'host',
  youId: 'guesser',
  phase: 'playing',
  currentTurnId: 'guesser',
  winnerId: null,
  canAct: true,
  pattern: '__LL_',
  guessedLetters: ['L', 'Z'],
  misses: 1,
  maxMisses: 8,
  yourSecretPhrase: null,
  revealedPhrase: null,
  ...overrides,
});

describe('HangmanRenderer', () => {
  it('highlights every occurrence of a correct letter and separates wrong guesses', () => {
    render(<HangmanRenderer view={view()} disabled={false} onAction={jest.fn()} />);

    expect(screen.getAllByText('L')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Correct letters' })).toHaveTextContent('L');
    expect(screen.getByRole('region', { name: 'Wrong letters' })).toHaveTextContent('Z');
    expect(screen.getByLabelText('1 of 8 hangman stages')).toBeInTheDocument();
  });

  it('submits a letter guess without exposing the secret phrase', () => {
    const onAction = jest.fn();
    render(<HangmanRenderer view={view()} disabled={false} onAction={onAction} />);

    fireEvent.change(screen.getByLabelText('Letter or full phrase'), {
      target: { value: 'A' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guess' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'guess_letter', letter: 'A' });
    expect(document.body).not.toHaveTextContent('HELLO');
  });

  it('clears a rejected full-phrase entry when the miss counter changes', () => {
    const onAction = jest.fn();
    const { rerender } = render(
      <HangmanRenderer view={view()} disabled={false} onAction={onAction} />,
    );
    const input = screen.getByLabelText('Letter or full phrase');
    fireEvent.change(input, { target: { value: 'WRONG WORD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guess' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'guess_phrase', phrase: 'WRONG WORD' });

    rerender(
      <HangmanRenderer view={view({ misses: 2 })} disabled={false} onAction={onAction} />,
    );
    expect(input).toHaveValue('');
  });

  it('shows the server-revealed answer when the game finishes', () => {
    render(<HangmanRenderer view={view({
      phase: 'finished',
      canAct: false,
      pattern: 'H_LL_',
      revealedPhrase: 'HELLO',
    })} disabled={false} onAction={jest.fn()} />);

    expect(screen.getByText('Answer:')).toHaveTextContent('Answer: HELLO');
    expect(screen.getByLabelText('Phrase pattern HELLO')).toBeInTheDocument();
  });
});
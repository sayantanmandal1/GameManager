import { fireEvent, render, screen } from '@testing-library/react';
import type { PresidentPlayerView, SlapjackPlayerView, SpoonsPlayerView, StandardCard } from '@/shared';
import { PresidentRenderer } from './PresidentRenderer';
import { SlapjackRenderer } from './SlapjackRenderer';
import { SpoonsRenderer } from './SpoonsRenderer';

const aceHearts: StandardCard = { id: 'c-hearts-A', suit: 'hearts', rank: 'A' };
const aceClubs: StandardCard = { id: 'c-clubs-A', suit: 'clubs', rank: 'A' };
const players = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' }, { id: 'c', name: 'Casey' }];

describe('third card batch renderers', () => {
  it('submits server-projected President groups and pass', () => {
    const onAction = jest.fn();
    const view: PresidentPlayerView = {
      gameKey: 'president', players: players.map((player) => ({ ...player, handCount: 2, score: 0, finishPlace: null })),
      hostId: 'a', youId: 'a', yourHand: [aceHearts, aceClubs], roundNumber: 1, currentTurnId: 'a',
      pilePlay: { playerId: 'b', rank: 'K', count: 2, cards: [] }, ranking: [], previousRanking: [], lastRound: null,
      phase: 'playing', winnerId: null, isDraw: false, canAct: true,
      legalPlays: [{ rank: 'A', cardIds: [aceHearts.id, aceClubs.id] }], canPass: true, canReturn: false,
    };
    render(<PresidentRenderer view={view} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: '2 × A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(onAction).toHaveBeenNthCalledWith(1, { type: 'play_president_cards', cardIds: [aceHearts.id, aceClubs.id] });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: 'pass_president' });
  });

  it('submits Slapjack flip, slap, and continue controls only when projected', () => {
    const onAction = jest.fn();
    const base: SlapjackPlayerView = {
      gameKey: 'slapjack', players: players.map((player) => ({ ...player, cardCount: 17, eliminated: false, lastChance: false })),
      youId: 'a', pileCount: 0, topCard: null, topPlayerId: null, currentTurnId: 'a', phase: 'playing',
      winnerId: null, canAct: true, canFlip: true, canSlap: false, canContinue: false,
    };
    const { rerender } = render(<SlapjackRenderer view={base} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Flip' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'flip_slapjack' });
    rerender(<SlapjackRenderer view={{ ...base, pileCount: 1, topCard: aceHearts, phase: 'slap_window', canFlip: false, canSlap: true, canContinue: true }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Slap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'slap_jack' });
    expect(onAction).toHaveBeenCalledWith({ type: 'continue_slapjack' });
  });

  it('submits a selected Spoons pass and rush grab', () => {
    const onAction = jest.fn();
    const view: SpoonsPlayerView = {
      gameKey: 'spoons', players: players.map((player) => ({ ...player, handCount: 4, letters: 0, active: true, grabbed: false })),
      hostId: 'a', youId: 'a', yourHand: [aceHearts], currentTurnId: 'a', dealerId: 'a', spoonsRemaining: 2,
      roundNumber: 1, lastRound: null, phase: 'passing', winnerId: null,
      canAct: true, canPass: true, canGrab: true, canStartNext: false,
    };
    render(<SpoonsRenderer view={view} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'A of hearts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grab spoon' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'pass_spoon_card', cardId: aceHearts.id });
    expect(onAction).toHaveBeenCalledWith({ type: 'grab_spoon' });
  });
});
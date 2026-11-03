import { act, fireEvent, render, screen } from '@testing-library/react';
import { LIARS_DECK_ROULETTE_TIMING, liarsDeckRevealDurationMs, type LiarsDeckPlayerView } from '@/shared';
import { useDistinctGameStore } from '@/stores/distinctGameStore';
import { LiarsDeckRenderer } from './LiarsDeckRenderer';

afterEach(() => jest.restoreAllMocks());

const view: LiarsDeckPlayerView = {
  gameKey: 'liars-deck', players: [
    { id: 'a', name: 'Alice', handCount: 5, pulls: 0, active: true },
    { id: 'b', name: 'Bob', handCount: 5, pulls: 0, active: true },
  ],
  hostId: 'a', mode: 'devil', phase: 'playing', youId: 'a',
  yourHand: [{ id: 'a1', rank: 'A' }, { id: 'k1', rank: 'K' }, { id: 'q1', rank: 'Q' }, { id: 'j1', rank: 'joker' }, { id: 'd1', rank: 'devil' }],
  tableRank: 'A', pileCount: 0, pendingClaim: null, currentTurnId: 'a',
  round: 1, lastReveal: null, canAct: true, canChallenge: false,
  canPlay: true, canDevilsDeal: false, forcedChallenge: false, winnerId: null,
};

describe("Liar's Deck table", () => {
  it('uses singular wording for the last card without changing empty or larger hand counts', () => {
    const players = view.players.map((player, index) => ({ ...player, handCount: index === 0 ? 1 : 0 }));
    const { rerender } = render(<LiarsDeckRenderer view={{ ...view, players }} disabled={false} onAction={jest.fn()} />);
    expect(screen.getByText('1 card · 0/6 pulls')).toBeInTheDocument();
    expect(screen.getByText('0 cards · 0/6 pulls')).toBeInTheDocument();
    rerender(<LiarsDeckRenderer view={view} disabled={false} onAction={jest.fn()} />);
    expect(screen.getAllByText('5 cards · 0/6 pulls')).toHaveLength(2);
  });

  it('shows character portraits and plays the three-card voice cue only for a new claim', () => {
    const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { rerender } = render(<LiarsDeckRenderer view={view} disabled={false} onAction={jest.fn()} />);
    expect(screen.getAllByRole('img', { name: /portrait for/ })).toHaveLength(2);

    const claimView = { ...view, pileCount: 3, pendingClaim: { playerId: 'b', count: 3 } };
    rerender(<LiarsDeckRenderer view={claimView} disabled={false} onAction={jest.fn()} />);
    expect(play).toHaveBeenCalledTimes(1);
    rerender(<LiarsDeckRenderer view={claimView} disabled={false} onAction={jest.fn()} />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('explains a resignation pause and lets the host continue without revealed cards', () => {
    const onAction = jest.fn();
    render(<LiarsDeckRenderer view={{ ...view, phase: 'reveal', canAct: false }} disabled={false} onAction={onAction} />);
    expect(screen.getByText(/A player resigned/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'next_liars_deck_round' });
  });

  it('lets the host select both modes and keeps guests waiting', () => {
    const onAction = jest.fn();
    const { rerender } = render(<LiarsDeckRenderer view={{ ...view, phase: 'setup', mode: null }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    fireEvent.click(screen.getByRole('button', { name: "Devil · Devil's Deal" }));
    expect(onAction.mock.calls).toEqual([
      [{ type: 'select_liars_deck_mode', mode: 'classic' }],
      [{ type: 'select_liars_deck_mode', mode: 'devil' }],
    ]);
    rerender(<LiarsDeckRenderer view={{ ...view, phase: 'setup', canAct: false }} disabled={false} onAction={onAction} />);
    expect(screen.queryByRole('button', { name: 'Classic' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Alice');
  });

  it('selects up to three cards and sends their exact private IDs', () => {
    const onAction = jest.fn();
    render(<LiarsDeckRenderer view={view} disabled={false} onAction={onAction} />);
    for (const name of ['Ace card', 'King card', 'Queen card']) fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('button', { name: 'Joker card' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Play selected' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_liars_deck', cardIds: ['a1', 'k1', 'q1'] });
    expect(screen.getByRole('button', { name: 'Call Liar!' })).toBeDisabled();
  });

  it('selects the Devil alone and exposes Deal only when the server allows it', () => {
    const onAction = jest.fn();
    render(<LiarsDeckRenderer view={{ ...view, canDevilsDeal: true, pileCount: 4 }} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ace card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Devil card' }));
    expect(screen.getByRole('button', { name: 'Ace card' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Play selected' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_liars_deck', cardIds: ['d1'] });
    fireEvent.click(screen.getByRole('button', { name: "Devil's Deal" }));
    expect(onAction).toHaveBeenCalledWith({ type: 'devils_deal' });
  });

  it('disables card play for a forced final-hand challenge', () => {
    const onAction = jest.fn();
    render(<LiarsDeckRenderer view={{ ...view, canPlay: false, canChallenge: true, forcedChallenge: true }} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'Play selected' })).toBeDisabled();
    expect(screen.getByText(/You hold the last hand/)).toHaveAttribute('role', 'status');
    fireEvent.click(screen.getByRole('button', { name: 'Call Liar!' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'call_liars_deck' });
  });

  it('shows only server-revealed cards after a challenge and lets the host redeal', () => {
    const onAction = jest.fn();
    render(<LiarsDeckRenderer view={{
      ...view, phase: 'reveal', canAct: false,
      lastReveal: { kind: 'challenge', callerId: 'b', claimantId: 'a', tableRank: 'A', cards: [{ id: 'revealed-queen', rank: 'Q' }], successful: true, riskPlayerIds: ['a'], eliminatedIds: [], shots: [] },
    }} disabled={false} onAction={onAction} />);
    expect(screen.queryByLabelText('Your private hand')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Revealed cards')).toHaveTextContent('Q');
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'next_liars_deck_round' });
  });

  describe('revolver sequence', () => {
    const fatalReveal: LiarsDeckPlayerView = {
      ...view, phase: 'finished', canAct: false, winnerId: 'a',
      players: [view.players[0], { ...view.players[1], pulls: 3, active: false, handCount: 0 }],
      lastReveal: {
        kind: 'challenge', callerId: 'a', claimantId: 'b', tableRank: 'A', cards: [{ id: 'lie', rank: 'K' }],
        successful: true, riskPlayerIds: ['b'], eliminatedIds: ['b'], shots: [{ playerId: 'b', pull: 3, fired: true }],
      },
    };
    const step = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

    beforeEach(() => {
      jest.useFakeTimers();
      useDistinctGameStore.setState({ presentationHold: false });
    });
    afterEach(() => jest.useRealTimers());

    it('keeps the outcome hidden until the trigger is pulled and holds the game-over banner', () => {
      const { rerender } = render(<LiarsDeckRenderer view={{ ...view, players: [view.players[0], { ...view.players[1], pulls: 2 }] }} disabled={false} onAction={jest.fn()} />);
      rerender(<LiarsDeckRenderer view={fatalReveal} disabled={false} onAction={jest.fn()} />);
      expect(useDistinctGameStore.getState().presentationHold).toBe(true);
      expect(screen.queryByText('Eliminated')).not.toBeInTheDocument();
      expect(screen.getByText('0 cards · 2/6 pulls')).toBeInTheDocument();
      expect(screen.getByText('Bob must face the revolver')).toBeInTheDocument();

      step(LIARS_DECK_ROULETTE_TIMING.introMs);
      expect(screen.getByText('Bob spins the cylinder')).toBeInTheDocument();
      step(LIARS_DECK_ROULETTE_TIMING.spinMs);
      expect(screen.getByText('Bob pulls the trigger…')).toBeInTheDocument();
      expect(screen.queryByText('Eliminated')).not.toBeInTheDocument();
      step(LIARS_DECK_ROULETTE_TIMING.triggerMs);
      expect(screen.getByText('BANG — Bob is out')).toBeInTheDocument();
      expect(screen.getByText('Eliminated')).toBeInTheDocument();
      expect(useDistinctGameStore.getState().presentationHold).toBe(true);
      step(LIARS_DECK_ROULETTE_TIMING.resultMs);
      expect(useDistinctGameStore.getState().presentationHold).toBe(false);
      expect(screen.getByText('Eliminated: Bob')).toBeInTheDocument();
    });

    it('hides Next round until every shot is shown and fits within the server reveal delay', () => {
      const reveal: LiarsDeckPlayerView = {
        ...fatalReveal, phase: 'reveal', winnerId: null,
        players: [view.players[0], { ...view.players[1], pulls: 1 }],
        lastReveal: { ...fatalReveal.lastReveal!, eliminatedIds: [], shots: [{ playerId: 'b', pull: 1, fired: false }] },
      };
      const { rerender } = render(<LiarsDeckRenderer view={view} disabled={false} onAction={jest.fn()} />);
      rerender(<LiarsDeckRenderer view={reveal} disabled={false} onAction={jest.fn()} />);
      expect(screen.queryByRole('button', { name: 'Next round' })).not.toBeInTheDocument();
      const t = LIARS_DECK_ROULETTE_TIMING;
      step(t.introMs);
      step(t.spinMs);
      step(t.triggerMs);
      expect(screen.getByText('Click — Bob survives')).toBeInTheDocument();
      step(t.resultMs);
      expect(screen.getByRole('button', { name: 'Next round' })).toBeInTheDocument();
      expect(t.introMs + t.spinMs + t.triggerMs + t.resultMs).toBeLessThan(liarsDeckRevealDurationMs(1));
    });

    it('shows a reveal already on screen at load as settled instead of replaying it', () => {
      render(<LiarsDeckRenderer view={fatalReveal} disabled={false} onAction={jest.fn()} />);
      expect(useDistinctGameStore.getState().presentationHold).toBe(false);
      expect(screen.getByText('Eliminated: Bob')).toBeInTheDocument();
    });
  });
});

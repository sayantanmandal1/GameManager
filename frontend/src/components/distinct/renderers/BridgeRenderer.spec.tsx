import { fireEvent, render, screen } from '@testing-library/react';
import type { BridgePlayerView, StandardCard } from '@/shared';
import { BridgeRenderer } from './BridgeRenderer';

const players: BridgePlayerView['players'] = [
  { id: 'a', name: 'North', seat: 'north', team: 0, handCount: 13, tricksWon: 0 },
  { id: 'b', name: 'East', seat: 'east', team: 1, handCount: 13, tricksWon: 0 },
  { id: 'c', name: 'South', seat: 'south', team: 0, handCount: 13, tricksWon: 0 },
  { id: 'd', name: 'West', seat: 'west', team: 1, handCount: 13, tricksWon: 0 },
];

const aceHearts: StandardCard = { id: 'c-hearts-A', suit: 'hearts', rank: 'A' };
const twoClubs: StandardCard = { id: 'c-clubs-2', suit: 'clubs', rank: '2' };

function view(overrides: Partial<BridgePlayerView> = {}): BridgePlayerView {
  return {
    gameKey: 'contract-bridge',
    players,
    hostId: 'a',
    youId: 'a',
    mode: null,
    phase: 'setup',
    dealerId: 'a',
    dealNumber: 0,
    vulnerability: [false, false],
    auction: [],
    contract: null,
    trick: [],
    tricksWon: [0, 0],
    currentTurnId: 'a',
    currentActorId: 'a',
    leaderId: null,
    dummyRevealed: false,
    yourHand: [],
    dummyHand: [],
    sessionScores: [0, 0],
    rubber: { belowLine: [0, 0], gamesWon: [0, 0], vulnerable: [false, false] },
    dealHistory: [],
    canAct: true,
    legalModes: ['rubber', 'duplicate', 'home'],
    legalBids: [],
    canPass: false,
    canDouble: false,
    canRedouble: false,
    legalCardIds: [],
    actingHand: null,
    winnerId: null,
    winnerTeam: null,
    isDraw: false,
    ...overrides,
  };
}

describe('BridgeRenderer', () => {
  it('offers all three server-supported modes to the host', () => {
    const onAction = jest.fn();
    render(<BridgeRenderer view={view()} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    expect(onAction).toHaveBeenCalledWith({ type: 'select_bridge_mode', mode: 'home' });
    expect(screen.getByRole('button', { name: /Rubber/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Duplicate/ })).toBeInTheDocument();
  });

  it('enables only server-declared bids and calls', () => {
    const onAction = jest.fn();
    render(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'auction',
      dealNumber: 1,
      legalModes: [],
      legalBids: [{ level: 1, strain: 'clubs' }],
      canPass: true,
      canDouble: false,
      yourHand: [aceHearts],
    })} disabled={false} onAction={onAction} />);

    expect(screen.getByRole('button', { name: '1♣' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '1♦' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Double' })).toBeDisabled();
    expect(screen.getByLabelText('A of hearts')).not.toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: '1♣' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(onAction).toHaveBeenNthCalledWith(1, {
      type: 'bridge_call',
      call: { type: 'bid', level: 1, strain: 'clubs' },
    });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: 'bridge_call', call: { type: 'pass' } });
  });

  it('keeps dummy hidden before the lead and lets declarer play only legal dummy cards', () => {
    const onAction = jest.fn();
    const bridgeContract = {
      level: 2,
      strain: 'hearts' as const,
      doubling: 'undoubled' as const,
      declarerId: 'a',
      dummyId: 'c',
      openingLeaderId: 'b',
      declaringTeam: 0 as const,
    };
    const { rerender } = render(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'opening_lead',
      dealNumber: 1,
      contract: bridgeContract,
      legalModes: [],
      canAct: false,
    })} disabled={false} onAction={onAction} />);
    expect(screen.queryByLabelText('Ace of hearts')).not.toBeInTheDocument();
    expect(screen.getByText('Dummy remains face down')).toBeInTheDocument();

    rerender(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'playing',
      dealNumber: 1,
      contract: bridgeContract,
      legalModes: [],
      dummyRevealed: true,
      dummyHand: [aceHearts, twoClubs],
      currentTurnId: 'c',
      currentActorId: 'a',
      canAct: true,
      actingHand: 'dummy',
      legalCardIds: [aceHearts.id],
    })} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'A of hearts' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '2 of clubs' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'A of hearts' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'play_bridge_card', cardId: aceHearts.id });
  });

  it('shows persistent deal score and lets only the acting host request the next deal', () => {
    const onAction = jest.fn();
    render(<BridgeRenderer view={view({
      mode: 'home',
      phase: 'deal_complete',
      dealNumber: 1,
      legalModes: [],
      sessionScores: [100, 0],
      dealHistory: [{
        dealNumber: 1,
        dealerId: 'a',
        vulnerability: [false, false],
        contract: null,
        tricksWon: [0, 0],
        score: [0, 0],
        passedOut: true,
      }],
    })} disabled={false} onAction={onAction} />);

    expect(screen.getAllByText('Passed out')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Next deal' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'next_bridge_deal' });
  });
});
import { fireEvent, render, screen, within } from '@testing-library/react';
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
const aceSpades: StandardCard = { id: 'c-spades-A', suit: 'spades', rank: 'A' };
const aceClubs: StandardCard = { id: 'c-clubs-A', suit: 'clubs', rank: 'A' };
const aceDiamonds: StandardCard = { id: 'c-diamonds-A', suit: 'diamonds', rank: 'A' };

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
    lastTrick: null,
    trickDisplayUntil: null,
    tricksWon: [0, 0],
    currentTurnId: 'a',
    currentActorId: 'a',
    leaderId: null,
    dummyRevealed: false,
    yourHand: [],
    dummyHand: [],
    partnerHand: [],
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
    surrenderVotes: [[], []],
    canVoteSurrender: false,
    undoRequest: null,
    canRequestUndo: false,
    undoIsImmediate: false,
    canRespondUndo: false,
    canCancelUndo: false,
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

    expect(screen.getByRole('button', { name: 'Choose Clubs' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Choose Diamonds' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Double' })).toBeDisabled();
    expect(screen.getByLabelText('A of hearts')).not.toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Clubs' }));
    expect(screen.getByRole('button', { name: '1♣' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '1♣' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(onAction).toHaveBeenNthCalledWith(1, {
      type: 'bridge_call',
      call: { type: 'bid', level: 1, strain: 'clubs' },
    });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: 'bridge_call', call: { type: 'pass' } });
  });

  it('arranges the private hand black, red, black, red by suit', () => {
    render(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'auction',
      dealNumber: 1,
      legalModes: [],
      canAct: false,
      currentActorId: 'b',
      currentTurnId: 'b',
      yourHand: [aceDiamonds, aceClubs, aceHearts, aceSpades],
    })} disabled={false} onAction={jest.fn()} />);

    expect(screen.getAllByLabelText(/^A of /).map((card) => card.getAttribute('aria-label')))
      .toEqual(['A of spades', 'A of hearts', 'A of clubs', 'A of diamonds']);
  });

  it('keeps dummy hidden before the lead and identifies a forced dummy play', () => {
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
    expect(screen.getByText('Only legal card · playing automatically')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'A of hearts' })).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('selects a card without playing it until explicit confirmation', () => {
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
    render(<BridgeRenderer view={view({
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
      legalCardIds: [aceHearts.id, twoClubs.id],
    })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'A of hearts' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText('A of hearts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play selected' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'play_bridge_card',
      cardId: aceHearts.id,
    });
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
        concededByTeam: null,
      }],
    })} disabled={false} onAction={onAction} />);

    expect(screen.getAllByText('Passed out')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Next deal' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'next_bridge_deal' });
  });

  it('keeps all four completed cards visible, then exposes them through Last trick', () => {
    const completed = {
      cards: [
        { playerId: 'a', card: aceSpades },
        { playerId: 'b', card: aceHearts },
        { playerId: 'c', card: aceClubs },
        { playerId: 'd', card: aceDiamonds },
      ],
      winnerId: 'a',
      completedAt: Date.now(),
    };
    const bridgeContract = {
      level: 1,
      strain: 'notrump' as const,
      doubling: 'undoubled' as const,
      declarerId: 'a',
      dummyId: 'c',
      openingLeaderId: 'b',
      declaringTeam: 0 as const,
    };
    const { rerender } = render(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'playing',
      dealNumber: 1,
      legalModes: [],
      contract: bridgeContract,
      lastTrick: completed,
      trickDisplayUntil: Date.now() + 3_500,
      canAct: true,
      actingHand: 'own',
    })} disabled={false} onAction={jest.fn()} />);

    expect(screen.getByText(/Completed trick/)).toHaveTextContent('North won');
    expect(screen.getAllByLabelText(/^A of /)).toHaveLength(4);

    rerender(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'playing',
      dealNumber: 1,
      legalModes: [],
      contract: bridgeContract,
      lastTrick: completed,
      trickDisplayUntil: Date.now() - 1,
      canAct: true,
      actingHand: 'own',
    })} disabled={false} onAction={jest.fn()} />);
    expect(screen.queryAllByLabelText(/^A of /)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Last trick' }));
    expect(screen.getByText(/Previous trick/)).toHaveTextContent('North won');
    expect(screen.getAllByLabelText(/^A of /)).toHaveLength(4);
  });

  it('shows the final completed trick before replacing it with the deal summary', () => {
    const completedAt = Date.now();
    const bridgeContract = {
      level: 1,
      strain: 'notrump' as const,
      doubling: 'undoubled' as const,
      declarerId: 'a',
      dummyId: 'c',
      openingLeaderId: 'b',
      declaringTeam: 0 as const,
    };
    render(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'deal_complete',
      dealNumber: 1,
      legalModes: [],
      contract: bridgeContract,
      lastTrick: {
        cards: [
          { playerId: 'a', card: aceSpades },
          { playerId: 'b', card: aceHearts },
          { playerId: 'c', card: aceClubs },
          { playerId: 'd', card: aceDiamonds },
        ],
        winnerId: 'a',
        completedAt,
      },
      trickDisplayUntil: completedAt + 3_500,
      dealHistory: [{
        dealNumber: 1,
        dealerId: 'a',
        vulnerability: [false, false],
        contract: bridgeContract,
        tricksWon: [7, 6],
        score: [90, 0],
        passedOut: false,
        concededByTeam: null,
      }],
    })} disabled={false} onAction={jest.fn()} />);

    expect(screen.getByText(/Completed trick/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^A of /)).toHaveLength(4);
    expect(screen.queryByText('Deal complete')).not.toBeInTheDocument();
  });

  it('requires explicit confirmation and supports withdrawing a team surrender vote', () => {
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
      mode: 'home',
      phase: 'playing',
      dealNumber: 1,
      legalModes: [],
      contract: bridgeContract,
      canVoteSurrender: true,
    })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Surrender deal' }));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm surrender' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'bridge_surrender_vote', confirmed: true });

    rerender(<BridgeRenderer view={view({
      mode: 'home',
      phase: 'playing',
      dealNumber: 1,
      legalModes: [],
      contract: bridgeContract,
      canVoteSurrender: true,
      surrenderVotes: [['a'], []],
    })} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw surrender' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'bridge_surrender_vote', confirmed: false });
  });

  it('lets the dummy inspect the declarer partner hand after the opening lead', () => {
    const bridgeContract = {
      level: 2,
      strain: 'hearts' as const,
      doubling: 'undoubled' as const,
      declarerId: 'a',
      dummyId: 'c',
      openingLeaderId: 'b',
      declaringTeam: 0 as const,
    };
    render(<BridgeRenderer view={view({
      youId: 'c',
      mode: 'duplicate',
      phase: 'playing',
      dealNumber: 1,
      contract: bridgeContract,
      legalModes: [],
      dummyRevealed: true,
      yourHand: [twoClubs],
      dummyHand: [twoClubs],
      partnerHand: [aceSpades, aceHearts],
      currentTurnId: 'b',
      currentActorId: 'b',
      canAct: false,
    })} disabled={false} onAction={jest.fn()} />);

    expect(screen.getByLabelText('2 revealed cards')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Partner (2)' }));
    const partnerHand = screen.getByLabelText('Partner cards');
    expect(within(partnerHand).getByLabelText('A of spades')).toBeInTheDocument();
    expect(within(partnerHand).getByLabelText('A of hearts')).toBeInTheDocument();
    expect(within(partnerHand).queryByRole('button', { name: 'Play selected' }))
      .not.toBeInTheDocument();
  });

  it('offers immediate undo and exposes approval controls for a later rollback', () => {
    const onAction = jest.fn();
    const bridgeContract = {
      level: 1,
      strain: 'clubs' as const,
      doubling: 'undoubled' as const,
      declarerId: 'a',
      dummyId: 'c',
      openingLeaderId: 'b',
      declaringTeam: 0 as const,
    };
    const { rerender } = render(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'playing',
      dealNumber: 1,
      contract: bridgeContract,
      legalModes: [],
      canRequestUndo: true,
      undoIsImmediate: true,
    })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Undo last play' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'bridge_request_undo' });

    rerender(<BridgeRenderer view={view({
      mode: 'duplicate',
      phase: 'playing',
      dealNumber: 1,
      contract: bridgeContract,
      legalModes: [],
      canAct: false,
      undoRequest: { requesterId: 'b', approvals: ['c'] },
      canRespondUndo: true,
    })} disabled={false} onAction={onAction} />);
    expect(screen.getByRole('status')).toHaveTextContent('East requested undo · 1/3 approved');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'bridge_respond_undo',
      approved: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'bridge_respond_undo',
      approved: false,
    });
  });

  it('shows one net score from the lobby host team perspective', () => {
    render(<BridgeRenderer view={view({
      hostId: 'b',
      mode: 'home',
      phase: 'auction',
      dealNumber: 2,
      legalModes: [],
      currentTurnId: 'c',
      currentActorId: 'c',
      canAct: false,
      sessionScores: [80, 230],
      tricksWon: [2, 5],
    })} disabled={false} onAction={jest.fn()} />);

    const net = screen.getByLabelText('Host team net score');
    expect(net).toHaveTextContent('East team net');
    expect(net).toHaveTextContent('+150');
    expect(net).toHaveTextContent('tricks 5–2');
  });
});
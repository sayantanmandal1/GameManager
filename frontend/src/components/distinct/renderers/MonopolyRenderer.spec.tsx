import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { MonopolyBoardSpaceView, MonopolyPlayerView } from '@/shared';
import { buildMonopolyCanonicalPreviewBoard } from './monopolyBoardData';
import { MonopolyRenderer } from './MonopolyRenderer';

function buildBoard(): MonopolyBoardSpaceView[] {
  return buildMonopolyCanonicalPreviewBoard();
}

function makeView(overrides: Partial<MonopolyPlayerView> = {}): MonopolyPlayerView {
  const board = buildBoard();
  board[1].ownerId = 'p1';
  board[1].buildingCount = 2;
  board[3].ownerId = 'p1';
  board[6].ownerId = 'p2';

  return {
    gameKey: 'monopoly',
    players: [
      {
        id: 'p1',
        name: 'Ada',
        isBot: false,
        originalToken: 'top_hat',
        originalColor: 'red',
        position: 1,
        cash: 900,
        inJail: false,
        jailTurns: 0,
        jailCards: 1,
        bankrupt: false,
        bankruptOrder: null,
        properties: [1, 3],
      },
      {
        id: 'p2',
        name: 'Ben',
        isBot: false,
        originalToken: 'racecar',
        originalColor: 'blue',
        position: 1,
        cash: 800,
        inJail: false,
        jailTurns: 0,
        jailCards: 2,
        bankrupt: false,
        bankruptOrder: null,
        properties: [6],
      },
      {
        id: 'p3',
        name: 'Cam',
        isBot: false,
        originalToken: 'battleship',
        originalColor: 'green',
        position: 10,
        cash: 750,
        inJail: true,
        jailTurns: 1,
        jailCards: 0,
        bankrupt: false,
        bankruptOrder: null,
        properties: [],
      },
    ],
    board,
    youId: 'p1',
    currentTurnId: 'p1',
    activePlayerIds: ['p1', 'p2', 'p3'],
    turn: {
      hasRolled: false,
      doublesCount: 0,
      lastRoll: [3, 4],
      mustEndTurn: false,
      releasedFromJailByDoubles: false,
    },
    rollSequence: 1,
    lastDiceRoll: [3, 4],
    lastMovement: null,
    pendingPurchase: null,
    pendingAuction: null,
    pendingDebt: null,
    pendingTrade: null,
    housesRemaining: 28,
    hotelsRemaining: 10,
    chanceRemaining: 12,
    chestRemaining: 11,
    chanceDiscardCount: 2,
    chestDiscardCount: 3,
    phase: 'rolling',
    winnerId: null,
    isDraw: false,
    canAct: true,
    legalActions: ['monopoly_roll', 'monopoly_build', 'monopoly_sell_building', 'monopoly_mortgage', 'monopoly_unmortgage', 'monopoly_propose_trade'],
    lastCard: { deck: 'chance', cardId: 'c1', playerId: 'p2', text: 'Advance to GO' },
    lastEvent: 'Ada moved to Mediterranean Avenue',
    ...overrides,
  };
}

describe('MonopolyRenderer', () => {
  it('renders all spaces with canonical cyclic side placement and shared board wrapper', () => {
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    expect(container.querySelector('[data-monopoly-board-viewport]')).toHaveClass('monopoly-board-viewport');
    expect(container.querySelector('[data-monopoly-board][data-monopoly-board-shared="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-space-index]')).toHaveLength(40);

    expect(container.querySelector('[data-space-index="0"]')?.getAttribute('data-side')).toBe('corner');
    expect(container.querySelector('[data-space-index="1"]')?.getAttribute('data-side')).toBe('bottom');
    expect(container.querySelector('[data-space-index="10"]')?.getAttribute('data-side')).toBe('corner');
    expect(container.querySelector('[data-space-index="11"]')?.getAttribute('data-side')).toBe('left');
    expect(container.querySelector('[data-space-index="20"]')?.getAttribute('data-side')).toBe('corner');
    expect(container.querySelector('[data-space-index="21"]')?.getAttribute('data-side')).toBe('top');
    expect(container.querySelector('[data-space-index="30"]')?.getAttribute('data-side')).toBe('corner');
    expect(container.querySelector('[data-space-index="31"]')?.getAttribute('data-side')).toBe('right');
  });

  it('shows canonical board names, center wordmark/decks, and visible attribution', () => {
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    expect(screen.getByText('Mediterranean Avenue')).toBeInTheDocument();
    expect(screen.getByText('Connecticut Avenue')).toBeInTheDocument();
    expect(screen.getByText('St. Charles Place')).toBeInTheDocument();
    expect(screen.getByText('New York Avenue')).toBeInTheDocument();
    expect(screen.getByText('Kentucky Avenue')).toBeInTheDocument();
    expect(screen.getByText('Marvin Gardens')).toBeInTheDocument();
    expect(screen.getByText('Pacific Avenue')).toBeInTheDocument();
    expect(screen.getByText('Boardwalk')).toBeInTheDocument();
    expect(screen.getByText('MONOPOLY')).toBeInTheDocument();
    expect(container.querySelector('[data-deck-zone="chest"]')).toBeInTheDocument();
    expect(container.querySelector('[data-deck-zone="chance"]')).toBeInTheDocument();
    expect(container.querySelector('[data-monopoly-attribution]')).toBeInTheDocument();
    expect(container.querySelector('[data-monopoly-attribution-detail]')).toBeInTheDocument();
  });

  it('renders multiple tokens on a shared space with token movement wrapper', () => {
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    const sharedSpace = container.querySelector('[data-space-index="1"]');
    expect(sharedSpace?.querySelectorAll('[aria-label*="token"]').length).toBe(2);
    expect(sharedSpace?.querySelector('[data-token-track]')).toBeInTheDocument();
  });

  it('dispatches roll, buy/decline, end turn, jail, and debt actions exactly', () => {
    const onAction = jest.fn();
    const { rerender } = render(<MonopolyRenderer view={makeView({ legalActions: ['monopoly_roll'] })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));

    rerender(<MonopolyRenderer view={makeView({
      rollSequence: 2,
      legalActions: ['monopoly_end_turn'],
      turn: {
        hasRolled: true,
        doublesCount: 0,
        lastRoll: [3, 4],
        mustEndTurn: true,
        releasedFromJailByDoubles: false,
      },
    })} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }));

    rerender(<MonopolyRenderer view={makeView({
      pendingPurchase: { playerId: 'p1', spaceIndex: 6, price: 100 },
      legalActions: ['monopoly_buy', 'monopoly_decline'],
    })} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auction' }));

    rerender(<MonopolyRenderer view={makeView({
      legalActions: ['monopoly_pay_jail', 'monopoly_use_jail_card', 'monopoly_attempt_doubles'],
    })} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pay $50' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use jail card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try doubles' }));

    rerender(<MonopolyRenderer view={makeView({
      rollSequence: 3,
      pendingDebt: { debtorId: 'p1', creditorId: 'p2', amount: 125, reason: 'rent' },
      legalActions: ['monopoly_pay_debt', 'monopoly_declare_bankruptcy'],
    })} disabled={false} onAction={onAction} />);
    const debtPanel = screen.getByLabelText('Debt panel');
    fireEvent.click(within(debtPanel).getByRole('button', { name: 'Pay debt' }));
    fireEvent.click(within(debtPanel).getByRole('button', { name: 'Declare bankruptcy' }));

    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_roll' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_end_turn' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_buy' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_decline' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_pay_jail' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_use_jail_card' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_attempt_doubles' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_pay_debt' });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_declare_bankruptcy' });
  });

  it('submits bounded auction bid and pass action', () => {
    const onAction = jest.fn();
    const auctionView = makeView({
      pendingAuction: {
        spaceIndex: 8,
        eligiblePlayerIds: ['p1', 'p2', 'p3'],
        activeBidderIds: ['p1', 'p2', 'p3'],
        currentBidderId: 'p1',
        highestBid: 50,
        highestBidderId: 'p2',
        bids: { p2: 50 },
      },
      legalActions: ['monopoly_bid', 'monopoly_pass_auction'],
    });
    auctionView.players[0].cash = 300;

    render(<MonopolyRenderer view={auctionView} disabled={false} onAction={onAction} />);

    fireEvent.change(screen.getByLabelText('Bid amount'), { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_bid', amount: 300 });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_pass_auction' });
  });

  it('selects owned property, shows deed schedule, and dispatches build/sell/mortgage/unmortgage', () => {
    const onAction = jest.fn();
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={onAction} />);

    fireEvent.click(container.querySelector('[data-space-index="1"]') as HTMLElement);

    expect(screen.getByText('Title Deed')).toBeInTheDocument();
    expect(screen.getByLabelText('With 1 House: $10')).toBeInTheDocument();
    expect(screen.getByLabelText('With Hotel: $250')).toBeInTheDocument();
    expect(screen.getByLabelText('Mortgage value: $30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mortgage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unmortgage' }));

    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_build', spaceIndex: 1 });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_sell_building', spaceIndex: 1 });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_mortgage', spaceIndex: 1 });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_unmortgage', spaceIndex: 1 });
  });

  it('composes and submits a trade, then supports respond/cancel flows', () => {
    const onAction = jest.fn();
    const { rerender } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Trade' }));
    fireEvent.change(screen.getByLabelText('Target player'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByLabelText('Offered cash'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Requested cash'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Offered jail cards'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Requested jail cards'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText('1 Mediterranean Avenue'));
    fireEvent.click(screen.getByLabelText('6 Oriental Avenue'));
    fireEvent.click(screen.getByRole('button', { name: 'Propose trade' }));

    expect(onAction).toHaveBeenCalledWith({
      type: 'monopoly_propose_trade',
      targetPlayerId: 'p2',
      offeredCash: 120,
      requestedCash: 80,
      offeredPropertyIndices: [1],
      requestedPropertyIndices: [6],
      offeredJailCards: 1,
      requestedJailCards: 1,
    });

    rerender(<MonopolyRenderer view={makeView({
      pendingTrade: {
        proposerId: 'p2',
        targetPlayerId: 'p1',
        offeredCash: 50,
        requestedCash: 30,
        offeredPropertyIndices: [6],
        requestedPropertyIndices: [1],
        offeredJailCards: 0,
        requestedJailCards: 0,
      },
      legalActions: ['monopoly_respond_trade'],
    })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    rerender(<MonopolyRenderer view={makeView({
      pendingTrade: {
        proposerId: 'p1',
        targetPlayerId: 'p2',
        offeredCash: 25,
        requestedCash: 0,
        offeredPropertyIndices: [1],
        requestedPropertyIndices: [],
        offeredJailCards: 0,
        requestedJailCards: 0,
      },
      legalActions: ['monopoly_cancel_trade'],
    })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_respond_trade', approved: true });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_respond_trade', approved: false });
    expect(onAction).toHaveBeenCalledWith({ type: 'monopoly_cancel_trade' });
  });

  it('shows last card text and bank inventory details', () => {
    render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    expect(screen.getByText(/Last chance:/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Assets' }));
    expect(screen.getByLabelText('Houses: 28')).toBeInTheDocument();
    expect(screen.getByLabelText('Hotels: 10')).toBeInTheDocument();
    expect(screen.getByLabelText('Chance: 12')).toBeInTheDocument();
    expect(screen.getByLabelText('Chest: 11')).toBeInTheDocument();
  });

  it('renders premium wallet, dice, dock, and server-authored movement surfaces', () => {
    const { container, rerender } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    expect(container.querySelector('[data-monopoly-live-table]')).toBeInTheDocument();
    expect(screen.getByLabelText('Monopoly player wallets')).toBeInTheDocument();
    expect(screen.getByLabelText('Ada wallet, $900, 2 properties')).toBeInTheDocument();
    expect(screen.getByLabelText('Dice show 3 and 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeInTheDocument();

    rerender(<MonopolyRenderer view={makeView({
      rollSequence: 2,
      lastMovement: {
        sequence: 1,
        playerId: 'p1',
        segments: [{ kind: 'roll', from: 1, path: [2, 3, 4] }],
      },
      players: makeView().players.map((player) => player.id === 'p1' ? { ...player, position: 4 } : player),
    })} disabled={false} onAction={jest.fn()} />);

    expect(container.querySelector('[data-monopoly-dice-scene]')).toBeInTheDocument();
    expect(container.querySelector('[data-last-roll]')).toBeInTheDocument();
  });

  it('moves a pawn through each authoritative square once per movement sequence', () => {
    jest.useFakeTimers();
    const initial = makeView({
      rollSequence: 1,
      lastMovement: null,
      players: makeView().players.map((player) => player.id === 'p1' ? { ...player, position: 1 } : player),
    });
    const moved = makeView({
      rollSequence: 2,
      lastMovement: {
        sequence: 1,
        playerId: 'p1',
        segments: [{ kind: 'roll', from: 1, path: [2, 3, 4] }],
      },
      players: makeView().players.map((player) => player.id === 'p1' ? { ...player, position: 4 } : player),
    });
    const { container, rerender } = render(<MonopolyRenderer view={initial} disabled={false} onAction={jest.fn()} />);

    rerender(<MonopolyRenderer view={moved} disabled={false} onAction={jest.fn()} />);
    expect(container.querySelector('[data-space-index="1"] [aria-label="Ada token top hat"]')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1_035));
    expect(container.querySelector('[data-space-index="2"] [aria-label="Ada token top hat"]')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(135));
    expect(container.querySelector('[data-space-index="3"] [aria-label="Ada token top hat"]')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(135));
    expect(container.querySelector('[data-space-index="4"] [aria-label="Ada token top hat"]')).toBeInTheDocument();

    rerender(<MonopolyRenderer view={{ ...moved, lastEvent: 'Duplicate state delivery' }} disabled={false} onAction={jest.fn()} />);
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('[data-space-index="4"] [aria-label="Ada token top hat"]')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
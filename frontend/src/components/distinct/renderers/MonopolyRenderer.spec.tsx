import { fireEvent, render, screen, within } from '@testing-library/react';
import type { MonopolyBoardSpaceView, MonopolyPlayerView } from '@/shared';
import { MonopolyRenderer } from './MonopolyRenderer';

function buildBoard(): MonopolyBoardSpaceView[] {
  return Array.from({ length: 40 }, (_, index) => {
    if (index === 0) return { index, name: 'Start', kind: 'go', ownerId: null, mortgaged: false, buildingCount: 0 };
    if (index === 10) return { index, name: 'Jail / Visiting', kind: 'jail', ownerId: null, mortgaged: false, buildingCount: 0 };
    if (index === 20) return { index, name: 'Free Parking', kind: 'free_parking', ownerId: null, mortgaged: false, buildingCount: 0 };
    if (index === 30) return { index, name: 'Go To Jail', kind: 'go_to_jail', ownerId: null, mortgaged: false, buildingCount: 0 };
    if ([7, 22, 36].includes(index)) return { index, name: `Chance ${index}`, kind: 'chance', ownerId: null, mortgaged: false, buildingCount: 0 };
    if ([2, 17, 33].includes(index)) return { index, name: `Chest ${index}`, kind: 'chest', ownerId: null, mortgaged: false, buildingCount: 0 };
    if ([5, 15, 25, 35].includes(index)) {
      return { index, name: `Rail ${index}`, kind: 'railroad', price: 200, mortgage: 100, ownerId: null, mortgaged: false, buildingCount: 0 };
    }
    if ([12, 28].includes(index)) {
      return { index, name: `Utility ${index}`, kind: 'utility', price: 150, mortgage: 75, ownerId: null, mortgaged: false, buildingCount: 0 };
    }
    if ([4, 38].includes(index)) {
      return { index, name: `Tax ${index}`, kind: 'tax', amount: index === 4 ? 200 : 100, ownerId: null, mortgaged: false, buildingCount: 0 };
    }
    const group = index <= 3
      ? 'brown'
      : index <= 9
        ? 'light_blue'
        : index <= 14
          ? 'pink'
          : index <= 19
            ? 'orange'
            : index <= 24
              ? 'red'
              : index <= 29
                ? 'yellow'
                : index <= 34
                  ? 'green'
                  : 'dark_blue';
    return {
      index,
      name: `Street ${index}`,
      kind: 'street',
      group,
      price: 100 + index,
      rents: [10, 20, 30, 40, 50, 60],
      houseCost: 50,
      mortgage: 50,
      ownerId: null,
      mortgaged: false,
      buildingCount: 0,
    };
  });
}

function makeView(overrides: Partial<MonopolyPlayerView> = {}): MonopolyPlayerView {
  const board = buildBoard();
  board[1].ownerId = 'p1';
  board[3].ownerId = 'p1';
  board[6].ownerId = 'p2';

  return {
    gameKey: 'monopoly',
    players: [
      {
        id: 'p1',
        name: 'Ada',
        originalToken: 'compass',
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
        originalToken: 'lantern',
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
        originalToken: 'rocket',
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
    lastCard: { deck: 'chance', cardId: 'c1', playerId: 'p2', text: 'Advance to Start' },
    lastEvent: 'Ada moved to Street 1',
    ...overrides,
  };
}

describe('MonopolyRenderer', () => {
  it('renders all 40 spaces with expected perimeter coordinates and stable board wrapper', () => {
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    expect(container.querySelector('[data-monopoly-board-viewport]')).toHaveClass('monopoly-board-viewport');
    expect(container.querySelector('[data-monopoly-board]')).toHaveClass('aspect-square');
    expect(container.querySelectorAll('[data-space-index]')).toHaveLength(40);

    expect(container.querySelector('[data-space-index="0"]')?.getAttribute('data-board-row')).toBe('10');
    expect(container.querySelector('[data-space-index="0"]')?.getAttribute('data-board-col')).toBe('10');
    expect(container.querySelector('[data-space-index="10"]')?.getAttribute('data-board-row')).toBe('10');
    expect(container.querySelector('[data-space-index="10"]')?.getAttribute('data-board-col')).toBe('0');
    expect(container.querySelector('[data-space-index="20"]')?.getAttribute('data-board-row')).toBe('0');
    expect(container.querySelector('[data-space-index="20"]')?.getAttribute('data-board-col')).toBe('0');
    expect(container.querySelector('[data-space-index="30"]')?.getAttribute('data-board-row')).toBe('0');
    expect(container.querySelector('[data-space-index="30"]')?.getAttribute('data-board-col')).toBe('10');
  });

  it('renders multiple tokens on a shared space', () => {
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={jest.fn()} />);

    const sharedSpace = container.querySelector('[data-space-index="1"]');
    expect(sharedSpace?.querySelectorAll('[aria-label$="token"]').length).toBe(2);
  });

  it('dispatches roll, buy/decline, end turn, jail, and debt actions exactly', () => {
    const onAction = jest.fn();
    const { rerender } = render(<MonopolyRenderer view={makeView({ legalActions: ['monopoly_roll', 'monopoly_end_turn'] })} disabled={false} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }));

    rerender(<MonopolyRenderer view={makeView({
      pendingPurchase: { playerId: 'p1', spaceIndex: 6, price: 106 },
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

  it('selects owned property and dispatches build/sell/mortgage/unmortgage', () => {
    const onAction = jest.fn();
    const { container } = render(<MonopolyRenderer view={makeView()} disabled={false} onAction={onAction} />);

    fireEvent.click(container.querySelector('[data-space-index="1"]') as HTMLElement);

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

    fireEvent.change(screen.getByLabelText('Target player'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByLabelText('Offered cash'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Requested cash'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Offered jail cards'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Requested jail cards'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText('1 Street 1'));
    fireEvent.click(screen.getByLabelText('6 Street 6'));
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

    expect(screen.getByText('Last chance card: Advance to Start')).toBeInTheDocument();
    expect(screen.getByText('Houses: 28')).toBeInTheDocument();
    expect(screen.getByText('Hotels: 10')).toBeInTheDocument();
    expect(screen.getByText('Chance deck: 12')).toBeInTheDocument();
    expect(screen.getByText('Chest deck: 11')).toBeInTheDocument();
  });
});

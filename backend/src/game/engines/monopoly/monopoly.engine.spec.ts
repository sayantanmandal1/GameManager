import type { MonopolyAction, MonopolyGameState } from '../../../shared';
import { MonopolyEngine } from './monopoly.engine';

describe('MonopolyEngine', () => {
  const make = (
    rolls: number[] = [],
    chanceOrder?: string[],
    chestOrder?: string[],
    players = ['a', 'b', 'c'],
  ) => {
    const die = [...rolls];
    const roller = () => die.shift() ?? 1;
    const shuffler = <T>(values: T[]): T[] => {
      if (values.length > 0 && typeof values[0] === 'string') {
        const ids = values as unknown as string[];
        if (ids.some((id) => id.startsWith('chance_')) && chanceOrder) {
          return [...chanceOrder] as unknown as T[];
        }
        if (ids.some((id) => id.startsWith('chest_')) && chestOrder) {
          return [...chestOrder] as unknown as T[];
        }
      }
      return [...values];
    };
    const engine = new MonopolyEngine(roller, shuffler);
    const names = Object.fromEntries(players.map((id) => [id, id.toUpperCase()]));
    return { engine, state: engine.initGame(players, names) };
  };

  const setOwner = (state: MonopolyGameState, index: number, ownerId: string) => {
    state.ownership[index] = ownerId;
    const owner = state.players.find((player) => player.id === ownerId)!;
    if (!owner.properties.includes(index)) owner.properties.push(index);
    owner.properties.sort((left, right) => left - right);
  };

  const giveJailCard = (state: MonopolyGameState, playerId: string, source: 'chance' | 'chest') => {
    state.heldJailCards[playerId].push(source);
    const player = state.players.find((entry) => entry.id === playerId)!;
    player.jailCards = state.heldJailCards[playerId].length;
  };

  it('validates player count and initializes a 40-space $1500 game', () => {
    const { engine, state } = make();
    expect(engine.rulesetId).toBe('monopoly.distinct-classic-40.v1');
    expect(state.board).toHaveLength(40);
    expect(state.players.map((player) => player.cash)).toEqual([1500, 1500, 1500]);
    expect(() => engine.initGame(['a'], { a: 'A' })).toThrow('two to four');
    expect(() => engine.initGame(['a', 'a'], { a: 'A' })).toThrow('two to four');
  });

  it('moves around the board and collects $200 when passing Start', () => {
    const { engine, state } = make([1, 1]);
    state.players[0].position = 39;
    const before = state.players[0].cash;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    expect(state.players[0].position).toBe(1);
    expect(state.players[0].cash).toBe(before + 200);
  });

  it('sends a player to jail on a third consecutive doubles roll', () => {
    const { engine, state } = make([1, 1, 2, 2, 3, 3]);
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    state.pendingPurchase = null;
    state.pendingDebt = null;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    state.pendingPurchase = null;
    state.pendingDebt = null;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    expect(state.players[0].inJail).toBe(true);
    expect(state.players[0].position).toBe(10);
  });

  it('supports purchase flow and mandatory auction including a decliner', () => {
    const { engine, state } = make([1, 2]);
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.pendingPurchase?.spaceIndex).toBe(3);
    expect(engine.applyAction(state, 'a', { type: 'monopoly_decline' })).toEqual({ valid: true });
    expect(state.pendingAuction).not.toBeNull();
    expect(engine.applyAction(state, 'a', { type: 'monopoly_bid', amount: 100 })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'c', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(state.ownership[3]).toBe('a');
  });

  it('keeps the final bidder active when no one has bid yet, and returns no-bid property to bank', () => {
    const { engine, state } = make([1, 2], undefined, undefined, ['a', 'b', 'c']);
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_decline' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(state.pendingAuction?.currentBidderId).toBe('c');
    expect(engine.applyAction(state, 'c', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(state.pendingAuction).toBeNull();
    expect(state.ownership[3]).toBeNull();
  });

  it('charges street monopoly rent, railroad scaling rent, and utility rent', () => {
    const { engine, state } = make([1, 1, 1, 1, 2, 3]);
    setOwner(state, 1, 'b');
    setOwner(state, 3, 'b');
    state.players[0].position = 39;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'a', creditorId: 'b', amount: 4 });
    state.players[0].cash = 1000;
    state.pendingDebt = null;
    setOwner(state, 5, 'b');
    setOwner(state, 15, 'b');
    state.currentTurnId = 'a';
    state.turn.mustEndTurn = false;
    state.turn.hasRolled = false;
    state.players[0].position = 3;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.pendingDebt).not.toBeNull();
    expect(state.pendingDebt!.amount).toBe(50);
    state.pendingDebt = null;
    setOwner(state, 12, 'b');
    setOwner(state, 28, 'b');
    state.currentTurnId = 'a';
    state.turn.mustEndTurn = false;
    state.turn.hasRolled = false;
    state.players[0].position = 10;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.pendingDebt).not.toBeNull();
    expect(state.pendingDebt!.amount).toBe(50);
  });

  it('supports the three jail release methods', () => {
    const { engine, state } = make([2, 2]);
    const player = state.players[0];
    player.inJail = true;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_pay_jail' })).toEqual({ valid: true });
    expect(player.inJail).toBe(false);

    player.inJail = true;
    giveJailCard(state, 'a', 'chance');
    state.turn.hasRolled = false;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_use_jail_card' })).toEqual({ valid: true });
    expect(player.inJail).toBe(false);
    expect(player.jailCards).toBe(0);
    expect(state.chanceDiscard).toContain('chance_jail_free');

    player.inJail = true;
    state.turn.hasRolled = false;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_attempt_doubles' })).toEqual({ valid: true });
    expect(player.inJail).toBe(false);
    expect(state.turn.hasRolled).toBe(true);
  });

  it('moves after the third failed jail roll once bail debt is raised', () => {
    const { engine, state } = make([1, 2]);
    const player = state.players[0];
    setOwner(state, 5, 'a');
    player.inJail = true;
    player.jailTurns = 2;
    player.position = 10;
    player.cash = 0;

    expect(engine.applyAction(state, 'a', { type: 'monopoly_attempt_doubles' })).toEqual({ valid: true });
    expect(player).toMatchObject({ inJail: false, jailTurns: 0, position: 13 });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'a', amount: 50, reason: 'jail_fee' });
    expect(state.pendingPurchase).toMatchObject({ playerId: 'a', spaceIndex: 13 });

    expect(engine.applyAction(state, 'a', { type: 'monopoly_mortgage', spaceIndex: 5 })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_pay_debt' })).toEqual({ valid: true });
    expect(state).toMatchObject({ pendingDebt: null, phase: 'buying' });
  });

  it('resolves tax, free parking, and go-to-jail spaces correctly', () => {
    const { engine, state } = make([1, 2]);
    state.players[0].position = 1;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.pendingDebt).toMatchObject({ amount: 200, reason: 'tax' });
    state.pendingDebt = null;
    state.currentTurnId = 'a';
    state.turn = { hasRolled: false, doublesCount: 0, lastRoll: null, mustEndTurn: false, releasedFromJailByDoubles: false };
    state.players[0].position = 18;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.players[0].position).toBe(20);
    state.currentTurnId = 'a';
    state.turn = { hasRolled: false, doublesCount: 0, lastRoll: null, mustEndTurn: false, releasedFromJailByDoubles: false };
    state.players[0].position = 28;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.players[0].inJail).toBe(true);
  });

  it('draws representative Chance and Chest cards including movement and jail-free handling', () => {
    const { engine, state } = make([1, 1, 1, 1], ['chance_advance_start'], ['chest_jail_free']);
    state.players[0].position = 5;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.players[0].position).toBe(0);
    state.currentTurnId = 'a';
    state.turn = { hasRolled: false, doublesCount: 0, lastRoll: null, mustEndTurn: false, releasedFromJailByDoubles: false };
    state.players[0].position = 0;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.players[0].jailCards).toBeGreaterThanOrEqual(1);
    expect(state.heldJailCards.a).toContain('chest');
    expect(state.lastCard?.text).toBeTruthy();
  });

  it('uses a fresh utility rent roll without replacing the turn doubles roll', () => {
    const { engine, state } = make([1, 1, 2, 3], ['chance_nearest_utility']);
    setOwner(state, 12, 'b');
    state.players[0].position = 5;

    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    expect(state.players[0].position).toBe(12);
    expect(state.pendingDebt).toMatchObject({ debtorId: 'a', creditorId: 'b', amount: 50 });
    expect(state.turn.lastRoll).toEqual([1, 1]);

    expect(engine.applyAction(state, 'a', { type: 'monopoly_pay_debt' })).toEqual({ valid: true });
    expect(state.turn.mustEndTurn).toBe(false);
    expect(engine.getPlayerView(state, 'a').legalActions).toContain('monopoly_roll');
  });

  it('tracks jail card deck identity across draw, trade, use, and bankruptcy', () => {
    const { engine, state } = make([1, 1, 1, 1], ['chance_jail_free'], ['chest_jail_free'], ['a', 'b', 'c']);
    state.players[0].position = 5;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.heldJailCards.a).toEqual(['chance']);

    state.currentTurnId = 'a';
    state.turn = { hasRolled: false, doublesCount: 0, lastRoll: null, mustEndTurn: false, releasedFromJailByDoubles: false };
    state.players[0].position = 0;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.heldJailCards.a).toEqual(['chance', 'chest']);

    expect(engine.applyAction(state, 'a', {
      type: 'monopoly_propose_trade',
      targetPlayerId: 'b',
      offeredCash: 0,
      requestedCash: 0,
      offeredPropertyIndices: [],
      requestedPropertyIndices: [],
      offeredJailCards: 1,
      requestedJailCards: 0,
    })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'monopoly_respond_trade', approved: true })).toEqual({ valid: true });
    expect(state.heldJailCards.a).toEqual(['chest']);
    expect(state.heldJailCards.b).toEqual(['chance']);

    state.players[0].inJail = true;
    state.turn.hasRolled = false;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_use_jail_card' })).toEqual({ valid: true });
    expect(state.chestDiscard).toContain('chest_jail_free');

    state.players[1].cash = 0;
    state.pendingDebt = { debtorId: 'b', creditorId: null, amount: 999, reason: 'tax' };
    expect(engine.applyAction(state, 'b', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.chanceDiscard).toContain('chance_jail_free');
    expect(state.heldJailCards.b).toEqual([]);
  });

  it('enforces even building, finite inventory, and even selling', () => {
    const { engine, state } = make();
    setOwner(state, 1, 'a');
    setOwner(state, 3, 'a');
    expect(engine.applyAction(state, 'a', { type: 'monopoly_build', spaceIndex: 1 })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_build', spaceIndex: 1 })).toEqual({ valid: false, reason: 'Build evenly across the color set' });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_build', spaceIndex: 3 })).toEqual({ valid: true });
    state.housesRemaining = 0;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_build', spaceIndex: 1 })).toEqual({ valid: false, reason: 'No houses remaining in bank' });
    state.housesRemaining = 30;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_sell_building', spaceIndex: 1 })).toEqual({ valid: true });
  });

  it('supports mortgage and unmortgage with 10 percent interest', () => {
    const { engine, state } = make();
    setOwner(state, 5, 'a');
    const startCash = state.players[0].cash;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_mortgage', spaceIndex: 5 })).toEqual({ valid: true });
    expect(state.players[0].cash).toBe(startCash + 100);
    expect(engine.applyAction(state, 'a', { type: 'monopoly_unmortgage', spaceIndex: 5 })).toEqual({ valid: true });
    expect(state.players[0].cash).toBe(startCash - 11);
  });

  it('executes valid trades and rejects invalid or stale ones, including mortgaged interest', () => {
    const { engine, state } = make();
    setOwner(state, 5, 'a');
    setOwner(state, 15, 'b');
    state.mortgaged.push(5);
    expect(engine.applyAction(state, 'a', {
      type: 'monopoly_propose_trade',
      targetPlayerId: 'b',
      offeredCash: 100,
      requestedCash: 50,
      offeredPropertyIndices: [5],
      requestedPropertyIndices: [15],
      offeredJailCards: 0,
      requestedJailCards: 0,
    })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'c', { type: 'monopoly_respond_trade', approved: true })).toEqual({ valid: false, reason: 'Only target can respond to trade' });
    expect(engine.applyAction(state, 'b', { type: 'monopoly_respond_trade', approved: true })).toEqual({ valid: true });
    expect(state.ownership[5]).toBe('b');
    expect(state.ownership[15]).toBe('a');
    expect(engine.applyAction(state, 'a', {
      type: 'monopoly_propose_trade',
      targetPlayerId: 'b',
      offeredCash: 0,
      requestedCash: 0,
      offeredPropertyIndices: [],
      requestedPropertyIndices: [],
      offeredJailCards: 0,
      requestedJailCards: 0,
    })).toEqual({ valid: false, reason: 'Invalid trade shape' });
    expect(engine.applyAction(state, 'a', {
      type: 'monopoly_propose_trade',
      targetPlayerId: 'b',
      offeredCash: 0,
      requestedCash: 0,
      offeredPropertyIndices: [99],
      requestedPropertyIndices: [],
      offeredJailCards: 0,
      requestedJailCards: 0,
    } as unknown as MonopolyAction)).toEqual({ valid: false, reason: 'Invalid trade shape' });
  });

  it('rejects trading a street when any property in its color group has buildings', () => {
    const { engine, state } = make();
    setOwner(state, 1, 'a');
    setOwner(state, 3, 'a');
    setOwner(state, 5, 'b');
    state.buildings[3] = 1;
    expect(engine.applyAction(state, 'a', {
      type: 'monopoly_propose_trade',
      targetPlayerId: 'b',
      offeredCash: 0,
      requestedCash: 0,
      offeredPropertyIndices: [1],
      requestedPropertyIndices: [5],
      offeredJailCards: 0,
      requestedJailCards: 0,
    })).toEqual({ valid: false, reason: 'Offered properties are invalid' });
  });

  it('requires debt payment before turn completion and allows recovery', () => {
    const { engine, state } = make([1, 2]);
    setOwner(state, 3, 'b');
    state.players[0].position = 0;
    engine.applyAction(state, 'a', { type: 'monopoly_roll' });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'a', creditorId: 'b', amount: 4 });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_end_turn' })).toEqual({ valid: false, reason: 'Debt settlement in progress' });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_pay_debt' })).toEqual({ valid: true });
    expect(state.pendingDebt).toBeNull();
  });

  it('queues collect-from-each-player debts and allows out-of-turn debtor liquidation actions', () => {
    const { engine, state } = make([1, 1], ['chance_collect_each'], undefined, ['a', 'b', 'c']);
    setOwner(state, 5, 'b');
    state.players.find((player) => player.id === 'b')!.cash = 0;
    state.players.find((player) => player.id === 'c')!.cash = 100;
    state.players[0].position = 5;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'b', creditorId: 'a', amount: 50 });
    expect(state.debtQueue).toHaveLength(1);
    expect(engine.applyAction(state, 'b', { type: 'monopoly_mortgage', spaceIndex: 5 })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'monopoly_pay_debt' })).toEqual({ valid: true });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'c', creditorId: 'a', amount: 50 });
    expect(engine.applyAction(state, 'c', { type: 'monopoly_pay_debt' })).toEqual({ valid: true });
    expect(state.pendingDebt).toBeNull();
    expect(state.debtQueue).toEqual([]);
    expect(state.currentTurnId).toBe('a');
    expect(state.phase).toBe('post_roll');
    expect(state.turn.mustEndTurn).toBe(false);
  });

  it('queues pay-each-player debts as separate obligations', () => {
    const { engine, state } = make([1, 1], undefined, ['chest_pay_each'], ['a', 'b', 'c']);
    state.players[0].position = 15;
    state.players[0].cash = 60;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'a', creditorId: 'b', amount: 50 });
    expect(state.debtQueue).toEqual([{ debtorId: 'a', creditorId: 'c', amount: 50, reason: 'card' }]);
  });

  it('rejects bankruptcy when debt can be covered via legal liquidation', () => {
    const { engine, state } = make();
    setOwner(state, 5, 'a');
    state.players[0].cash = 0;
    state.pendingDebt = { debtorId: 'a', creditorId: 'b', amount: 80, reason: 'rent' };
    expect(engine.applyAction(state, 'a', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: false, reason: 'Player can cover debt through legal liquidation' });
  });

  it('allows bankruptcy when a house shortage makes hotel liquidation impossible', () => {
    const { engine, state } = make();
    setOwner(state, 1, 'a');
    setOwner(state, 3, 'a');
    state.buildings[1] = 5;
    state.buildings[3] = 4;
    state.housesRemaining = 0;
    state.hotelsRemaining = 11;
    state.players[0].cash = 0;
    state.pendingDebt = { debtorId: 'a', creditorId: 'b', amount: 100, reason: 'rent' };

    expect(engine.applyAction(state, 'a', { type: 'monopoly_sell_building', spaceIndex: 1 })).toEqual({
      valid: false,
      reason: 'Cannot break a hotel without four houses in bank',
    });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_sell_building', spaceIndex: 3 })).toEqual({
      valid: false,
      reason: 'Sell evenly across the color set',
    });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.players[0].bankrupt).toBe(true);
  });

  it('settles queued debts before opening bank-creditor bankruptcy auctions', () => {
    const { engine, state } = make([], undefined, undefined, ['a', 'b', 'c']);
    setOwner(state, 1, 'b');
    state.players[1].cash = 0;
    state.players[2].cash = 100;
    state.turn = { hasRolled: true, doublesCount: 0, lastRoll: [2, 3], mustEndTurn: true, releasedFromJailByDoubles: false };
    state.pendingDebt = { debtorId: 'b', creditorId: null, amount: 50, reason: 'tax' };
    state.debtQueue = [{ debtorId: 'c', creditorId: 'a', amount: 50, reason: 'card' }];
    state.debtContext = { originTurnId: 'a', turnSnapshot: structuredClone(state.turn) };
    state.phase = 'debt';

    expect(engine.applyAction(state, 'b', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.pendingDebt).toMatchObject({ debtorId: 'c', creditorId: 'a', amount: 50 });
    expect(state.pendingAuction).toBeNull();
    expect(state.pendingBankruptcyAuctions).toEqual([1]);

    expect(engine.applyAction(state, 'c', { type: 'monopoly_pay_debt' })).toEqual({ valid: true });
    expect(state.pendingDebt).toBeNull();
    expect(state.pendingAuction?.spaceIndex).toBe(1);
    expect(state.players[2].cash).toBe(50);
    expect(state.players[0].cash).toBe(1550);
  });

  it('handles bankruptcy to a player and to the bank with deterministic auction ordering', () => {
    const { engine, state } = make([], undefined, undefined, ['a', 'b', 'c', 'd']);
    setOwner(state, 1, 'a');
    setOwner(state, 3, 'a');
    state.players[0].cash = 0;
    state.pendingDebt = { debtorId: 'a', creditorId: 'b', amount: 100, reason: 'rent' };
    expect(engine.applyAction(state, 'a', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.ownership[1]).toBe('b');
    expect(state.ownership[3]).toBe('b');

    setOwner(state, 6, 'c');
    setOwner(state, 8, 'c');
    state.players.find((player) => player.id === 'c')!.cash = 0;
    state.pendingDebt = { debtorId: 'c', creditorId: null, amount: 999, reason: 'tax' };
    engine.applyAction(state, 'c', { type: 'monopoly_declare_bankruptcy' });
    expect(state.pendingAuction?.spaceIndex).toBe(6);
    expect(state.pendingBankruptcyAuctions).toEqual([8]);
  });

  it('liquidates buildings on true bankruptcy and restores finite house-hotel inventory', () => {
    const { engine, state } = make([], undefined, undefined, ['a', 'b', 'c']);
    setOwner(state, 1, 'a');
    setOwner(state, 3, 'a');
    state.buildings[1] = 5;
    state.buildings[3] = 2;
    state.housesRemaining = 30;
    state.hotelsRemaining = 4;
    state.players[0].cash = 0;
    state.pendingDebt = { debtorId: 'a', creditorId: null, amount: 5000, reason: 'tax' };
    expect(engine.applyAction(state, 'a', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.buildings[1]).toBe(0);
    expect(state.buildings[3]).toBe(0);
    expect(state.housesRemaining).toBe(32);
    expect(state.hotelsRemaining).toBe(5);
  });

  it('preserves seating order for next active turn after eliminating the current debtor', () => {
    const { engine, state } = make([], undefined, undefined, ['a', 'b', 'c', 'd']);
    setOwner(state, 6, 'c');
    state.currentTurnId = 'c';
    state.pendingDebt = { debtorId: 'c', creditorId: null, amount: 9999, reason: 'tax' };
    state.players.find((player) => player.id === 'c')!.cash = 0;
    expect(engine.applyAction(state, 'c', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.currentTurnId).toBe('d');
    expect(state.pendingAuction?.currentBidderId).toBe('d');
    for (const bidder of ['d', 'a', 'b']) {
      expect(engine.applyAction(state, bidder, { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    }
    expect(state).toMatchObject({ currentTurnId: 'd', phase: 'rolling' });
    expect(state.turn.mustEndTurn).toBe(false);
    expect(engine.getPlayerView(state, 'd').legalActions).toContain('monopoly_roll');
  });

  it('applies immediate 10 percent bank interest on mortgaged assets transferred to a creditor', () => {
    const { engine, state } = make([], undefined, undefined, ['a', 'b', 'c']);
    setOwner(state, 5, 'a');
    state.mortgaged.push(5);
    state.players.find((player) => player.id === 'a')!.cash = 0;
    state.players.find((player) => player.id === 'b')!.cash = 5;
    state.pendingDebt = { debtorId: 'a', creditorId: 'b', amount: 999, reason: 'rent' };
    expect(engine.applyAction(state, 'a', { type: 'monopoly_declare_bankruptcy' })).toEqual({ valid: true });
    expect(state.ownership[5]).toBe('b');
    expect(state.pendingDebt).toMatchObject({ debtorId: 'b', creditorId: null, amount: 10, reason: 'trade_interest' });
  });

  it('finishes when one active player remains', () => {
    const { engine, state } = make();
    state.players.find((player) => player.id === 'a')!.cash = 0;
    state.players.find((player) => player.id === 'b')!.cash = 0;
    state.pendingDebt = { debtorId: 'a', creditorId: null, amount: 5000, reason: 'tax' };
    engine.applyAction(state, 'a', { type: 'monopoly_declare_bankruptcy' });
    state.pendingDebt = { debtorId: 'b', creditorId: null, amount: 5000, reason: 'tax' };
    const resolution = engine.applyAction(state, 'b', { type: 'monopoly_declare_bankruptcy' });
    expect(resolution.result).toMatchObject({ winnerId: 'c', reason: 'last_player' });
    expect(state.phase).toBe('finished');
  });

  it('rejects forged action shapes with extra fields', () => {
    const { engine, state } = make();
    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll', amount: 4 } as unknown as MonopolyAction)).toEqual({ valid: false, reason: 'Invalid action' });
    expect(engine.applyAction(state, 'a', { type: 'monopoly_bid' } as unknown as MonopolyAction)).toEqual({ valid: false, reason: 'Invalid action' });
  });

  it('projects cloned state without exposing future deck order internals', () => {
    const { engine, state } = make();
    const view = engine.getPlayerView(state, 'a');
    expect(view).not.toHaveProperty('chanceDeck');
    expect(view).not.toHaveProperty('chestDeck');
    expect(view).not.toHaveProperty('heldJailCards');
    const firstOwner = view.board[1];
    firstOwner.ownerId = 'forged';
    expect(state.ownership[1]).toBeNull();
  });

  it('uses explicit phase transitions and deterministic token-color assignment', () => {
    const { engine, state } = make([1, 2], undefined, undefined, ['a', 'b', 'c', 'd']);
    expect(state.phase).toBe('rolling');
    expect(state.players.map((player) => player.originalToken)).toEqual(['compass', 'lantern', 'rocket', 'kite']);
    expect(state.players.map((player) => player.originalColor)).toEqual(['red', 'blue', 'green', 'yellow']);

    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    expect(state.phase).toBe('buying');

    expect(engine.applyAction(state, 'a', { type: 'monopoly_decline' })).toEqual({ valid: true });
    expect(state.phase).toBe('auction');

    expect(engine.applyAction(state, 'a', { type: 'monopoly_bid', amount: 100 })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'c', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'd', { type: 'monopoly_pass_auction' })).toEqual({ valid: true });
    expect(state.phase).toBe('post_roll');

    expect(engine.applyAction(state, 'a', { type: 'monopoly_end_turn' })).toEqual({ valid: true });
    expect(state.phase).toBe('rolling');
  });

  it('projects human-readable last card text without exposing deck order', () => {
    const { engine, state } = make([1, 1], ['chance_collect_bonus']);
    state.players[0].position = 5;
    expect(engine.applyAction(state, 'a', { type: 'monopoly_roll' })).toEqual({ valid: true });
    const view = engine.getPlayerView(state, 'a');
    expect(view.lastCard?.text).toBe('Receive a 100 neighborhood bonus');
    expect((view as unknown as Record<string, unknown>).chanceDeck).toBeUndefined();
    expect((view as unknown as Record<string, unknown>).chestDeck).toBeUndefined();
  });

  it('chooses deterministic surrender winner and returns a terminal result', () => {
    const { engine, state } = make();
    const outcome = engine.surrender(state, 'a');
    expect(outcome.result).toEqual({
      gameKey: 'monopoly',
      winnerId: 'b',
      isDraw: false,
      reason: 'surrender',
      bankruptOrder: [],
    });
  });
});
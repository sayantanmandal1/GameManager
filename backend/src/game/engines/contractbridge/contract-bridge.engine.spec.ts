import type {
  BridgeCall,
  BridgeContract,
  BridgeGameState,
  BridgeMode,
  StandardCard,
} from '../../../shared';
import { ContractBridgeEngine } from './contract-bridge.engine';

describe('ContractBridgeEngine', () => {
  const players = ['a', 'b', 'c', 'd'];
  const names = { a: 'North', b: 'East', c: 'South', d: 'West' };
  const card = (suit: StandardCard['suit'], rank: StandardCard['rank']): StandardCard => ({
    id: `c-${suit}-${rank}`,
    suit,
    rank,
  });
  const game = (mode: BridgeMode = 'duplicate') => {
    const engine = new ContractBridgeEngine((cards) => cards);
    const state = engine.initGame(players, names);
    expect(engine.applyAction(state, 'a', { type: 'select_bridge_mode', mode })).toEqual({ valid: true });
    return { engine, state };
  };
  const call = (
    engine: ContractBridgeEngine,
    state: BridgeGameState,
    playerId: string,
    bridgeCall: BridgeCall,
  ) => engine.applyAction(state, playerId, { type: 'bridge_call', call: bridgeCall });
  const contract = (overrides: Partial<BridgeContract> = {}): BridgeContract => ({
    level: 4,
    strain: 'hearts',
    doubling: 'undoubled',
    declarerId: 'a',
    dummyId: 'c',
    openingLeaderId: 'b',
    declaringTeam: 0,
    ...overrides,
  });
  const prepareFinalTrick = (
    state: BridgeGameState,
    mode: BridgeMode,
    bridgeContract: BridgeContract,
    tricksWon: [number, number],
  ) => {
    state.mode = mode;
    state.phase = 'playing';
    state.contract = bridgeContract;
    state.currentTurnId = 'd';
    state.leaderId = 'a';
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('clubs', '2') },
      { playerId: 'c', card: card('clubs', 'K') },
    ];
    state.hands = { a: [], b: [], c: [], d: [card('clubs', '3')] };
    state.tricksWon = tricksWon;
    state.pendingHonorBonus = null;
  };

  it('requires four unique players and assigns fixed opposite partnerships', () => {
    const engine = new ContractBridgeEngine((cards) => cards);
    expect(() => engine.initGame(['a', 'b'], {})).toThrow('exactly four');
    expect(() => engine.initGame(['a', 'b', 'c', 'c'], {})).toThrow('distinct');
    const state = engine.initGame(players, names);
    expect(state.players.map(({ seat, team }) => ({ seat, team }))).toEqual([
      { seat: 'north', team: 0 },
      { seat: 'east', team: 1 },
      { seat: 'south', team: 0 },
      { seat: 'west', team: 1 },
    ]);
  });

  it('allows only the host to choose one allow-listed mode before any deal', () => {
    const engine = new ContractBridgeEngine((cards) => cards);
    const state = engine.initGame(players, names);
    expect(engine.getPlayerView(state, 'a').legalModes).toEqual(['rubber', 'duplicate', 'home']);
    expect(engine.getPlayerView(state, 'b').legalModes).toEqual([]);
    expect(engine.applyAction(state, 'b', { type: 'select_bridge_mode', mode: 'rubber' })).toEqual({
      valid: false,
      reason: 'Only the host can select the mode',
    });
    expect(engine.applyAction(state, 'a', { type: 'select_bridge_mode', mode: 'forged' as BridgeMode })).toEqual({
      valid: false,
      reason: 'Invalid Bridge mode',
    });
  });

  it('deals all 52 unique cards one at a time starting left of dealer', () => {
    const { engine, state } = game();
    expect(players.map((id) => state.hands[id].length)).toEqual([13, 13, 13, 13]);
    expect(new Set(players.flatMap((id) => state.hands[id].map((entry) => entry.id))).size).toBe(52);
    expect(state.hands.b[0].id).toBe('c-clubs-A');
    expect(state.hands.a[0].id).toBe('c-clubs-4');
    expect(engine.getPlayerView(state, 'a')).toMatchObject({
      dealerId: 'a',
      currentTurnId: 'a',
      dealNumber: 1,
      phase: 'auction',
    });
  });

  it('never projects another private hand during setup or auction', () => {
    const { engine, state } = game();
    const view = engine.getPlayerView(state, 'a');
    const serialized = JSON.stringify(view);
    expect(view.yourHand).toHaveLength(13);
    expect(view.dummyHand).toEqual([]);
    for (const opponentId of ['b', 'c', 'd']) {
      for (const hiddenCard of state.hands[opponentId]) {
        expect(serialized).not.toContain(`"${hiddenCard.id}"`);
      }
    }
    expect(view.players.map((player) => player.handCount)).toEqual([13, 13, 13, 13]);
  });

  it('enforces turn order, exact action shapes, and ascending bid rank', () => {
    const { engine, state } = game();
    expect(call(engine, state, 'b', { type: 'bid', level: 1, strain: 'clubs' })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
    expect(engine.applyAction(state, 'a', {
      type: 'bridge_call',
      call: { type: 'bid', level: 1, strain: 'hearts', leaked: true } as unknown as BridgeCall,
    })).toEqual({ valid: false, reason: 'Invalid call' });
    expect(call(engine, state, 'a', { type: 'bid', level: 1, strain: 'hearts' })).toEqual({ valid: true });
    expect(call(engine, state, 'b', { type: 'bid', level: 1, strain: 'diamonds' })).toEqual({
      valid: false,
      reason: 'Bid must outrank the current contract',
    });
    expect(call(engine, state, 'b', { type: 'bid', level: 1, strain: 'spades' })).toEqual({ valid: true });
    expect(engine.getPlayerView(state, 'c').legalBids[0]).toEqual({ level: 1, strain: 'notrump' });
  });

  it('permits doubles and redoubles only for the legally opposing partnership', () => {
    const { engine, state } = game();
    expect(call(engine, state, 'a', { type: 'double' })).toEqual({ valid: false, reason: 'Double is not legal' });
    expect(call(engine, state, 'a', { type: 'bid', level: 2, strain: 'hearts' })).toEqual({ valid: true });
    expect(call(engine, state, 'b', { type: 'double' })).toEqual({ valid: true });
    expect(call(engine, state, 'c', { type: 'double' })).toEqual({ valid: false, reason: 'Double is not legal' });
    expect(call(engine, state, 'c', { type: 'redouble' })).toEqual({ valid: true });
    expect(call(engine, state, 'd', { type: 'redouble' })).toEqual({ valid: false, reason: 'Redouble is not legal' });
    call(engine, state, 'd', { type: 'pass' });
    call(engine, state, 'a', { type: 'pass' });
    call(engine, state, 'b', { type: 'pass' });
    expect(state.contract).toMatchObject({
      level: 2,
      strain: 'hearts',
      doubling: 'redoubled',
      declarerId: 'a',
    });
  });

  it('resets a double when a later legal bid changes the contract', () => {
    const { engine, state } = game();
    call(engine, state, 'a', { type: 'bid', level: 1, strain: 'clubs' });
    call(engine, state, 'b', { type: 'double' });
    call(engine, state, 'c', { type: 'bid', level: 1, strain: 'diamonds' });
    expect(state.doubling).toBe('undoubled');
    expect(engine.getPlayerView(state, 'd').canDouble).toBe(true);
  });

  it('passes out after four opening passes and rotates dealer and vulnerability', () => {
    const { engine, state } = game('duplicate');
    players.forEach((playerId) => call(engine, state, playerId, { type: 'pass' }));
    expect(state).toMatchObject({ phase: 'deal_complete', contract: null });
    expect(state.dealHistory[0]).toMatchObject({ passedOut: true, score: [0, 0] });
    expect(engine.applyAction(state, 'b', { type: 'next_bridge_deal' })).toEqual({
      valid: false,
      reason: 'Only the host can start the next deal',
    });
    expect(engine.applyAction(state, 'a', { type: 'next_bridge_deal' })).toEqual({ valid: true });
    expect(state).toMatchObject({ dealerIndex: 1, dealNumber: 2, vulnerability: [true, false] });
  });

  it('makes the first partnership bidder of the final strain declarer', () => {
    const { engine, state } = game();
    call(engine, state, 'a', { type: 'bid', level: 1, strain: 'clubs' });
    call(engine, state, 'b', { type: 'pass' });
    call(engine, state, 'c', { type: 'bid', level: 1, strain: 'hearts' });
    call(engine, state, 'd', { type: 'pass' });
    call(engine, state, 'a', { type: 'bid', level: 2, strain: 'hearts' });
    call(engine, state, 'b', { type: 'pass' });
    call(engine, state, 'c', { type: 'pass' });
    call(engine, state, 'd', { type: 'pass' });
    expect(state.contract).toMatchObject({
      declarerId: 'c',
      dummyId: 'a',
      openingLeaderId: 'd',
      strain: 'hearts',
    });
    expect(state).toMatchObject({ phase: 'opening_lead', currentTurnId: 'd', dummyRevealed: false });
  });

  it('reveals dummy only after the opening lead and lets only declarer control it', () => {
    const { engine, state } = game();
    call(engine, state, 'a', { type: 'bid', level: 1, strain: 'spades' });
    call(engine, state, 'b', { type: 'pass' });
    call(engine, state, 'c', { type: 'pass' });
    call(engine, state, 'd', { type: 'pass' });
    const dummyCardId = state.hands.c[0].id;
    expect(JSON.stringify(engine.getPlayerView(state, 'b'))).not.toContain(`"${dummyCardId}"`);

    const leadCardId = engine.getPlayerView(state, 'b').legalCardIds[0];
    expect(engine.applyAction(state, 'b', { type: 'play_bridge_card', cardId: leadCardId })).toEqual({ valid: true });
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'c', dummyRevealed: true });
    expect(engine.getPlayerView(state, 'd').dummyHand).toHaveLength(13);
    expect(engine.getPlayerView(state, 'a')).toMatchObject({ canAct: true, actingHand: 'dummy' });
    expect(engine.getPlayerView(state, 'c').canAct).toBe(false);
    expect(engine.applyAction(state, 'c', { type: 'play_bridge_card', cardId: dummyCardId })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
    expect(engine.applyAction(state, 'a', { type: 'play_bridge_card', cardId: state.hands.a[0].id })).toEqual({
      valid: false,
      reason: 'Card not in controlled hand',
    });
    const legalDummyCard = engine.getPlayerView(state, 'a').legalCardIds[0];
    expect(engine.applyAction(state, 'a', { type: 'play_bridge_card', cardId: legalDummyCard })).toEqual({ valid: true });
  });

  it('reveals the declarer hand to dummy only after dummy goes down', () => {
    const { engine, state } = game();
    call(engine, state, 'a', { type: 'bid', level: 1, strain: 'spades' });
    call(engine, state, 'b', { type: 'pass' });
    call(engine, state, 'c', { type: 'pass' });
    call(engine, state, 'd', { type: 'pass' });
    const declarerCardIds = state.hands.a.map((entry) => entry.id);

    expect(engine.getPlayerView(state, 'c').partnerHand).toEqual([]);
    expect(JSON.stringify(engine.getPlayerView(state, 'c'))).not.toContain(`"${declarerCardIds[0]}"`);

    const leadCardId = engine.getPlayerView(state, 'b').legalCardIds[0];
    engine.applyAction(state, 'b', { type: 'play_bridge_card', cardId: leadCardId });

    expect(engine.getPlayerView(state, 'c').partnerHand.map((entry) => entry.id))
      .toEqual(declarerCardIds);
    expect(engine.getPlayerView(state, 'd').partnerHand).toEqual([]);
  });

  it('immediately undoes the latest play before another player acts', () => {
    const { engine, state } = game();
    call(engine, state, 'a', { type: 'bid', level: 1, strain: 'spades' });
    call(engine, state, 'b', { type: 'pass' });
    call(engine, state, 'c', { type: 'pass' });
    call(engine, state, 'd', { type: 'pass' });
    const leadCardId = engine.getPlayerView(state, 'b').legalCardIds[0];
    engine.applyAction(state, 'b', { type: 'play_bridge_card', cardId: leadCardId });
    expect(engine.getPlayerView(state, 'b')).toMatchObject({
      canRequestUndo: true,
      undoIsImmediate: true,
    });

    expect(engine.applyAction(state, 'b', { type: 'bridge_request_undo' }))
      .toEqual({ valid: true });

    expect(state).toMatchObject({
      phase: 'opening_lead',
      currentTurnId: 'b',
      dummyRevealed: false,
      trick: [],
      playHistory: [],
      undoRequest: null,
    });
    expect(state.hands.b.some((entry) => entry.id === leadCardId)).toBe(true);
  });

  it('requires all other players to approve undo after a later play', () => {
    const { engine, state } = game();
    call(engine, state, 'a', { type: 'bid', level: 1, strain: 'spades' });
    call(engine, state, 'b', { type: 'pass' });
    call(engine, state, 'c', { type: 'pass' });
    call(engine, state, 'd', { type: 'pass' });
    const leadCardId = engine.getPlayerView(state, 'b').legalCardIds[0];
    engine.applyAction(state, 'b', { type: 'play_bridge_card', cardId: leadCardId });
    const dummyCardId = engine.getPlayerView(state, 'a').legalCardIds[0];
    engine.applyAction(state, 'a', { type: 'play_bridge_card', cardId: dummyCardId });
    expect(engine.getPlayerView(state, 'b')).toMatchObject({
      canRequestUndo: true,
      undoIsImmediate: false,
    });

    expect(engine.applyAction(state, 'b', { type: 'bridge_request_undo' }))
      .toEqual({ valid: true });
    expect(state.undoRequest).toMatchObject({ requesterId: 'b', approvals: [] });
    expect(engine.applyAction(state, 'd', {
      type: 'play_bridge_card',
      cardId: engine.getPlayerView(state, 'd').legalCardIds[0],
    })).toEqual({ valid: false, reason: 'Resolve the undo request first' });
    expect(engine.applyAction(state, 'b', {
      type: 'bridge_respond_undo',
      approved: true,
    })).toEqual({ valid: false, reason: 'The requester cannot approve their own undo' });

    for (const approver of ['a', 'c']) {
      expect(engine.applyAction(state, approver, {
        type: 'bridge_respond_undo',
        approved: true,
      })).toEqual({ valid: true });
      expect(state.undoRequest).not.toBeNull();
    }
    expect(engine.applyAction(state, 'd', {
      type: 'bridge_respond_undo',
      approved: true,
    })).toEqual({ valid: true });

    expect(state).toMatchObject({
      phase: 'opening_lead',
      currentTurnId: 'b',
      dummyRevealed: false,
      trick: [],
      playHistory: [],
      undoRequest: null,
    });
    expect(state.hands.b.some((entry) => entry.id === leadCardId)).toBe(true);
    expect(state.hands.c.some((entry) => entry.id === dummyCardId)).toBe(true);
  });

  it('lets any approver reject and only the requester cancel a voted undo', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'c';
    state.playHistory = [
      {
        playId: 1,
        actorId: 'a',
        handOwnerId: 'a',
        cardId: 'c-clubs-A',
        snapshot: structuredClone({
          hands: state.hands,
          trick: state.trick,
          lastTrick: state.lastTrick,
          trickDisplayUntil: state.trickDisplayUntil,
          tricksWon: state.tricksWon,
          currentTurnId: state.currentTurnId,
          leaderId: state.leaderId,
          dummyRevealed: state.dummyRevealed,
          sessionScores: state.sessionScores,
          rubber: state.rubber,
          dealHistory: state.dealHistory,
          pendingHonorBonus: state.pendingHonorBonus,
          surrenderVotes: state.surrenderVotes,
          phase: state.phase,
          winnerId: state.winnerId,
          winnerTeam: state.winnerTeam,
          isDraw: state.isDraw,
          finishReason: state.finishReason,
        }),
      },
      {
        playId: 2,
        actorId: 'b',
        handOwnerId: 'b',
        cardId: 'c-clubs-2',
        snapshot: {} as never,
      },
    ];
    expect(engine.applyAction(state, 'a', { type: 'bridge_request_undo' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'bridge_respond_undo', approved: false }))
      .toEqual({ valid: true });
    expect(state.undoRequest).toBeNull();

    expect(engine.applyAction(state, 'a', { type: 'bridge_request_undo' })).toEqual({ valid: true });
    expect(engine.applyAction(state, 'b', { type: 'bridge_cancel_undo' }))
      .toEqual({ valid: false, reason: 'Only the requester can cancel the undo' });
    expect(engine.applyAction(state, 'a', { type: 'bridge_cancel_undo' }))
      .toEqual({ valid: true });
    expect(state.undoRequest).toBeNull();
  });

  it('rolls back a completed trick and never projects private snapshots', () => {
    let now = 1_000;
    const engine = new ContractBridgeEngine((cards) => cards, () => now);
    const state = engine.initGame(players, names);
    engine.applyAction(state, 'a', { type: 'select_bridge_mode', mode: 'duplicate' });
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'd';
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('clubs', '2') },
      { playerId: 'c', card: card('clubs', 'K') },
    ];
    state.hands = {
      a: [card('diamonds', '2')],
      b: [card('diamonds', '3')],
      c: [card('diamonds', '4')],
      d: [card('clubs', '3'), card('diamonds', '5')],
    };
    engine.applyAction(state, 'd', { type: 'play_bridge_card', cardId: 'c-clubs-3' });
    expect(state).toMatchObject({ tricksWon: [1, 0], currentTurnId: 'a' });
    expect(state.lastTrick?.cards).toHaveLength(4);
    expect(JSON.stringify(engine.getPlayerView(state, 'a'))).not.toContain('snapshot');

    now = 1_100;
    expect(engine.applyAction(state, 'd', { type: 'bridge_request_undo' }))
      .toEqual({ valid: true });

    expect(state).toMatchObject({
      tricksWon: [0, 0],
      currentTurnId: 'd',
      lastTrick: null,
      trickDisplayUntil: null,
    });
    expect(state.trick).toHaveLength(3);
    expect(state.hands.d.map((entry) => entry.id)).toContain('c-clubs-3');
  });

  it('auto-plays only a single legal card and preserves a 1.5-second undo grace', () => {
    const now = 2_000;
    const engine = new ContractBridgeEngine((cards) => cards, () => now);
    const state = engine.initGame(players, names);
    engine.applyAction(state, 'a', { type: 'select_bridge_mode', mode: 'duplicate' });
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'b';
    state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands.b = [card('clubs', 'K'), card('hearts', 'A')];

    expect(engine.getAutomaticAction(state)).toEqual({
      playerId: 'b',
      action: { type: 'play_bridge_card', cardId: 'c-clubs-K' },
      delayMs: 1_500,
    });

    state.hands.b.push(card('clubs', 'Q'));
    expect(engine.getAutomaticAction(state)).toBeNull();

    state.hands.b = [card('clubs', 'K'), card('hearts', 'A')];
    state.undoRequest = {
      requesterId: 'a',
      targetPlayId: 1,
      approvals: [],
      requestedAt: now,
    };
    expect(engine.getAutomaticAction(state)).toBeNull();
  });

  it('auto-plays the only dummy card as declarer after the reveal window', () => {
    const now = 2_000;
    const engine = new ContractBridgeEngine((cards) => cards, () => now);
    const state = engine.initGame(players, names);
    engine.applyAction(state, 'a', { type: 'select_bridge_mode', mode: 'duplicate' });
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'c';
    state.trick = [{ playerId: 'b', card: card('clubs', '5') }];
    state.hands.c = [card('clubs', 'Q'), card('hearts', 'A')];
    state.trickDisplayUntil = 5_500;

    expect(engine.getAutomaticAction(state)).toEqual({
      playerId: 'a',
      action: { type: 'play_bridge_card', cardId: 'c-clubs-Q' },
      delayMs: 3_900,
    });
  });

  it('rejects a revoke when the controlled hand can follow suit', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'b';
    state.trick = [{ playerId: 'a', card: card('clubs', '5') }];
    state.hands.b = [card('clubs', 'K'), card('hearts', 'A')];
    expect(engine.getPlayerView(state, 'b').legalCardIds).toEqual(['c-clubs-K']);
    expect(engine.applyAction(state, 'b', { type: 'play_bridge_card', cardId: 'c-hearts-A' })).toEqual({
      valid: false,
      reason: 'Must follow suit',
    });
  });

  it('awards a trick to the highest trump and gives that seat the next lead', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'd';
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('spades', 'A') },
      { playerId: 'c', card: card('hearts', '2') },
    ];
    state.hands = {
      a: [card('diamonds', '2')],
      b: [card('diamonds', '3')],
      c: [card('diamonds', '4')],
      d: [card('hearts', 'K'), card('diamonds', '5')],
    };
    expect(engine.applyAction(state, 'd', { type: 'play_bridge_card', cardId: 'c-hearts-K' })).toEqual({ valid: true });
    expect(state.tricksWon).toEqual([0, 1]);
    expect(state.currentTurnId).toBe('d');
    expect(state.leaderId).toBe('d');
  });

  it('keeps all four cards visible for 3.5 seconds and rejects the next play during that gap', () => {
    let now = 1_000;
    const engine = new ContractBridgeEngine((cards) => cards, () => now);
    const state = engine.initGame(players, names);
    engine.applyAction(state, 'a', { type: 'select_bridge_mode', mode: 'duplicate' });
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'd';
    state.trick = [
      { playerId: 'a', card: card('clubs', 'A') },
      { playerId: 'b', card: card('clubs', '2') },
      { playerId: 'c', card: card('clubs', 'K') },
    ];
    state.hands = {
      a: [card('diamonds', '2')],
      b: [card('diamonds', '3')],
      c: [card('diamonds', '4')],
      d: [card('clubs', '3'), card('diamonds', '5')],
    };

    expect(engine.applyAction(state, 'd', {
      type: 'play_bridge_card',
      cardId: 'c-clubs-3',
    })).toEqual({ valid: true });
    expect(state.lastTrick).toMatchObject({
      winnerId: 'a',
      completedAt: 1_000,
    });
    expect(state.lastTrick?.cards).toHaveLength(4);
    expect(state.trickDisplayUntil).toBe(4_500);
    expect(engine.applyAction(state, 'a', {
      type: 'play_bridge_card',
      cardId: 'c-diamonds-2',
    })).toEqual({ valid: false, reason: 'Wait for the completed trick to clear' });

    now = 4_500;
    expect(engine.applyAction(state, 'a', {
      type: 'play_bridge_card',
      cardId: 'c-diamonds-2',
    })).toEqual({ valid: true });
    expect(state.trick).toHaveLength(1);
    expect(state.lastTrick?.cards).toHaveLength(4);
    expect(state.trickDisplayUntil).toBeNull();
  });

  it('integrates duplicate raw score into the persistent session ledger', () => {
    const { engine, state } = game('duplicate');
    prepareFinalTrick(state, 'duplicate', contract(), [9, 3]);
    expect(engine.applyAction(state, 'd', { type: 'play_bridge_card', cardId: 'c-clubs-3' })).toEqual({ valid: true });
    expect(state).toMatchObject({
      phase: 'deal_complete',
      tricksWon: [10, 3],
      sessionScores: [420, -420],
    });
    expect(state.dealHistory.at(-1)?.score).toEqual([420, -420]);
  });

  it('integrates the selected Home 10-trick score and doubled undertrick deductions', () => {
    const made = game('home');
    prepareFinalTrick(made.state, 'home', contract({ level: 3 }), [9, 3]);
    made.engine.applyAction(made.state, 'd', { type: 'play_bridge_card', cardId: 'c-clubs-3' });
    expect(made.state.sessionScores).toEqual([100, 0]);

    const down = game('home');
    prepareFinalTrick(down.state, 'home', contract({ level: 5, doubling: 'doubled' }), [8, 4]);
    down.engine.applyAction(down.state, 'd', { type: 'play_bridge_card', cardId: 'c-clubs-3' });
    expect(down.state.sessionScores).toEqual([-200, 0]);
  });

  it('tracks rubber games, vulnerability, honors, and the fast-rubber bonus', () => {
    const first = game('rubber');
    prepareFinalTrick(first.state, 'rubber', contract(), [9, 3]);
    first.engine.applyAction(first.state, 'd', { type: 'play_bridge_card', cardId: 'c-clubs-3' });
    expect(first.state.rubber).toEqual({
      belowLine: [0, 0],
      gamesWon: [1, 0],
      vulnerable: [true, false],
    });
    expect(first.state.sessionScores).toEqual([120, 0]);
    first.engine.applyAction(first.state, 'a', { type: 'next_bridge_deal' });
    expect(first.state.vulnerability).toEqual([true, false]);

    prepareFinalTrick(first.state, 'rubber', contract(), [9, 3]);
    const result = first.engine.applyAction(first.state, 'd', { type: 'play_bridge_card', cardId: 'c-clubs-3' });
    expect(result.result).toMatchObject({
      gameKey: 'contract-bridge',
      winnerTeam: 0,
      reason: 'rubber_complete',
      sessionScores: [940, 0],
    });

    const honors = game('rubber');
    honors.state.hands.a = [
      card('spades', '10'), card('spades', 'J'), card('spades', 'Q'), card('spades', 'K'), card('spades', 'A'),
      card('clubs', '2'), card('clubs', '3'), card('clubs', '4'), card('diamonds', '2'),
      card('diamonds', '3'), card('hearts', '2'), card('hearts', '3'), card('hearts', '4'),
    ];
    call(honors.engine, honors.state, 'a', { type: 'bid', level: 1, strain: 'spades' });
    call(honors.engine, honors.state, 'b', { type: 'pass' });
    call(honors.engine, honors.state, 'c', { type: 'pass' });
    call(honors.engine, honors.state, 'd', { type: 'pass' });
    expect(honors.state.pendingHonorBonus).toEqual({ team: 0, points: 150 });
  });

  it('requires both partners to surrender, awards every remaining trick, and scores the deal', () => {
    const { engine, state } = game();
    state.phase = 'playing';
    state.contract = contract();
    state.currentTurnId = 'a';
    state.tricksWon = [3, 2];

    expect(engine.applyAction(state, 'a', {
      type: 'bridge_surrender_vote',
      confirmed: true,
    })).toEqual({ valid: true });
    expect(state).toMatchObject({
      phase: 'playing',
      surrenderVotes: [['a'], []],
      tricksWon: [3, 2],
    });

    expect(engine.applyAction(state, 'a', {
      type: 'bridge_surrender_vote',
      confirmed: false,
    })).toEqual({ valid: true });
    expect(state.surrenderVotes).toEqual([[], []]);

    engine.applyAction(state, 'a', { type: 'bridge_surrender_vote', confirmed: true });
    expect(engine.applyAction(state, 'c', {
      type: 'bridge_surrender_vote',
      confirmed: true,
    })).toEqual({ valid: true });
    expect(state).toMatchObject({
      phase: 'deal_complete',
      tricksWon: [3, 10],
      sessionScores: [-350, 350],
    });
    expect(state.dealHistory.at(-1)).toMatchObject({
      concededByTeam: 0,
      tricksWon: [3, 10],
      score: [-350, 350],
    });
    expect(state.players.every((player) => state.hands[player.id].length === 0)).toBe(true);
  });

  it('rejects one-click generic surrender and voting before a contract exists', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'c')).toEqual({
      valid: false,
      reason: 'Both partners must confirm surrender at the Bridge table',
    });
    state.phase = 'opening_lead';
    state.contract = null;
    expect(engine.applyAction(state, 'a', {
      type: 'bridge_surrender_vote',
      confirmed: true,
    })).toEqual({
      valid: false,
      reason: 'A contract is required before surrender',
    });
  });
});
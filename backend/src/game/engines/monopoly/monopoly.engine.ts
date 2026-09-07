import { randomInt } from 'node:crypto';
import type {
  MonopolyAction,
  MonopolyAuctionState,
  MonopolyBoardSpace,
  MonopolyBoardSpaceView,
  MonopolyDebtState,
  MonopolyGameState,
  MonopolyPlayer,
  MonopolyPlayerView,
  MonopolyResult,
  MonopolyStreetSpace,
  MonopolyTradeOffer,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { secureShuffle } from '../standard-cards';

type DeckType = 'chance' | 'chest';
type DeckShuffler = <T>(values: T[]) => T[];
type DiceRoller = () => number;

interface MonopolyCard {
  id: string;
  deck: DeckType;
  text: string;
  kind:
    | 'move_absolute'
    | 'move_relative'
    | 'move_nearest_railroad'
    | 'move_nearest_utility'
    | 'collect'
    | 'pay'
    | 'collect_each_player'
    | 'pay_each_player'
    | 'repairs'
    | 'jail_free'
    | 'go_to_jail';
  value?: number;
  destination?: number;
  houseRepair?: number;
  hotelRepair?: number;
}

const START_CASH = 1500;
const GO_COLLECT = 200;
const HOUSE_BANK_TOTAL = 32;
const HOTEL_BANK_TOTAL = 12;
const JAIL_BAIL = 50;
const PLAYER_TOKENS = ['compass', 'lantern', 'rocket', 'kite'] as const;
const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'] as const;

const freshTurnState = () => ({
  hasRolled: false,
  doublesCount: 0,
  lastRoll: null as [number, number] | null,
  mustEndTurn: false,
  releasedFromJailByDoubles: false,
});

const BOARD: MonopolyBoardSpace[] = [
  { index: 0, kind: 'go', name: 'Start' },
  { index: 1, kind: 'street', name: 'Harbor Row', group: 'brown', price: 60, rents: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgage: 30 },
  { index: 2, kind: 'chest', name: 'Community Fund' },
  { index: 3, kind: 'street', name: 'Maple Alley', group: 'brown', price: 60, rents: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgage: 30 },
  { index: 4, kind: 'tax', name: 'Civic Tax', amount: 200 },
  { index: 5, kind: 'railroad', name: 'Northline Rail', price: 200, mortgage: 100 },
  { index: 6, kind: 'street', name: 'Skyline Avenue', group: 'light_blue', price: 100, rents: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgage: 50 },
  { index: 7, kind: 'chance', name: 'Opportunity Deck' },
  { index: 8, kind: 'street', name: 'Juniper Avenue', group: 'light_blue', price: 100, rents: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgage: 50 },
  { index: 9, kind: 'street', name: 'Orchid Avenue', group: 'light_blue', price: 120, rents: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgage: 60 },
  { index: 10, kind: 'jail', name: 'Jail / Visiting' },
  { index: 11, kind: 'street', name: 'Cedar Square', group: 'pink', price: 140, rents: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgage: 70 },
  { index: 12, kind: 'utility', name: 'Reservoir Authority', price: 150, mortgage: 75 },
  { index: 13, kind: 'street', name: 'Willow Square', group: 'pink', price: 140, rents: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgage: 70 },
  { index: 14, kind: 'street', name: 'Rose Square', group: 'pink', price: 160, rents: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgage: 80 },
  { index: 15, kind: 'railroad', name: 'Eastline Rail', price: 200, mortgage: 100 },
  { index: 16, kind: 'street', name: 'Marina Boulevard', group: 'orange', price: 180, rents: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgage: 90 },
  { index: 17, kind: 'chest', name: 'Community Fund' },
  { index: 18, kind: 'street', name: 'Sunset Boulevard', group: 'orange', price: 180, rents: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgage: 90 },
  { index: 19, kind: 'street', name: 'Beacon Boulevard', group: 'orange', price: 200, rents: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgage: 100 },
  { index: 20, kind: 'free_parking', name: 'Free Parking' },
  { index: 21, kind: 'street', name: 'River Gardens', group: 'red', price: 220, rents: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgage: 110 },
  { index: 22, kind: 'chance', name: 'Opportunity Deck' },
  { index: 23, kind: 'street', name: 'Summit Gardens', group: 'red', price: 220, rents: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgage: 110 },
  { index: 24, kind: 'street', name: 'Grove Gardens', group: 'red', price: 240, rents: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgage: 120 },
  { index: 25, kind: 'railroad', name: 'Southline Rail', price: 200, mortgage: 100 },
  { index: 26, kind: 'street', name: 'Liberty Avenue', group: 'yellow', price: 260, rents: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgage: 130 },
  { index: 27, kind: 'street', name: 'Aurora Avenue', group: 'yellow', price: 260, rents: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgage: 130 },
  { index: 28, kind: 'utility', name: 'Power Grid', price: 150, mortgage: 75 },
  { index: 29, kind: 'street', name: 'Coral Avenue', group: 'yellow', price: 280, rents: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgage: 140 },
  { index: 30, kind: 'go_to_jail', name: 'Go To Jail' },
  { index: 31, kind: 'street', name: 'Midtown Terrace', group: 'green', price: 300, rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgage: 150 },
  { index: 32, kind: 'street', name: 'Park Terrace', group: 'green', price: 300, rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgage: 150 },
  { index: 33, kind: 'chest', name: 'Community Fund' },
  { index: 34, kind: 'street', name: 'Harbor Terrace', group: 'green', price: 320, rents: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgage: 160 },
  { index: 35, kind: 'railroad', name: 'Westline Rail', price: 200, mortgage: 100 },
  { index: 36, kind: 'chance', name: 'Opportunity Deck' },
  { index: 37, kind: 'street', name: 'Grand Esplanade', group: 'dark_blue', price: 350, rents: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgage: 175 },
  { index: 38, kind: 'tax', name: 'Metro Tax', amount: 100 },
  { index: 39, kind: 'street', name: 'Crown Esplanade', group: 'dark_blue', price: 400, rents: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgage: 200 },
];

const CHANCE_CARDS: MonopolyCard[] = [
  { id: 'chance_advance_start', deck: 'chance', text: 'Move to Start and collect the crossing bonus', kind: 'move_absolute', destination: 0 },
  { id: 'chance_advance_grove', deck: 'chance', text: 'Proceed to Grove Gardens', kind: 'move_absolute', destination: 24 },
  { id: 'chance_advance_cedar', deck: 'chance', text: 'Proceed to Cedar Square', kind: 'move_absolute', destination: 11 },
  { id: 'chance_advance_northline', deck: 'chance', text: 'Proceed to Northline Rail', kind: 'move_absolute', destination: 5 },
  { id: 'chance_nearest_rail_1', deck: 'chance', text: 'Take the next rail line; rent is doubled if owned', kind: 'move_nearest_railroad' },
  { id: 'chance_nearest_rail_2', deck: 'chance', text: 'Take the next rail line; rent is doubled if owned', kind: 'move_nearest_railroad' },
  { id: 'chance_nearest_utility', deck: 'chance', text: 'Travel to the next utility; owned rent uses a fresh roll', kind: 'move_nearest_utility' },
  { id: 'chance_collect_dividend', deck: 'chance', text: 'Your investments pay 50', kind: 'collect', value: 50 },
  { id: 'chance_pay_fine', deck: 'chance', text: 'Pay a 15 civic levy', kind: 'pay', value: 15 },
  { id: 'chance_repair', deck: 'chance', text: 'Fund repairs across your developments', kind: 'repairs', houseRepair: 25, hotelRepair: 100 },
  { id: 'chance_collect_loan', deck: 'chance', text: 'A construction bond matures; receive 150', kind: 'collect', value: 150 },
  { id: 'chance_collect_each', deck: 'chance', text: 'Table chair bonus: collect 50 from every rival', kind: 'collect_each_player', value: 50 },
  { id: 'chance_go_back_three', deck: 'chance', text: 'Move back three spaces', kind: 'move_relative', value: -3 },
  { id: 'chance_go_to_jail', deck: 'chance', text: 'Report to jail without collecting the Start bonus', kind: 'go_to_jail' },
  { id: 'chance_jail_free', deck: 'chance', text: 'Keep this pass to leave jail without paying', kind: 'jail_free' },
  { id: 'chance_collect_bonus', deck: 'chance', text: 'Receive a 100 neighborhood bonus', kind: 'collect', value: 100 },
];

const CHEST_CARDS: MonopolyCard[] = [
  { id: 'chest_advance_start', deck: 'chest', text: 'Return to Start and collect the crossing bonus', kind: 'move_absolute', destination: 0 },
  { id: 'chest_collect_error', deck: 'chest', text: 'A bank correction credits you 200', kind: 'collect', value: 200 },
  { id: 'chest_pay_fee', deck: 'chest', text: 'Pay a 50 medical consultation fee', kind: 'pay', value: 50 },
  { id: 'chest_collect_services', deck: 'chest', text: 'Receive 50 for community services', kind: 'collect', value: 50 },
  { id: 'chest_collect_fund', deck: 'chest', text: 'Your savings fund pays 100', kind: 'collect', value: 100 },
  { id: 'chest_collect_refund', deck: 'chest', text: 'Receive a 20 tax rebate', kind: 'collect', value: 20 },
  { id: 'chest_collect_each', deck: 'chest', text: 'Collect 10 from every rival', kind: 'collect_each_player', value: 10 },
  { id: 'chest_pay_each', deck: 'chest', text: 'Give every rival 50', kind: 'pay_each_player', value: 50 },
  { id: 'chest_collect_advisory', deck: 'chest', text: 'Advisory work pays 25', kind: 'collect', value: 25 },
  { id: 'chest_repair', deck: 'chest', text: 'Cover repairs on all developments', kind: 'repairs', houseRepair: 40, hotelRepair: 115 },
  { id: 'chest_collect_prize', deck: 'chest', text: 'A local contest awards you 10', kind: 'collect', value: 10 },
  { id: 'chest_collect_inherit', deck: 'chest', text: 'An estate payment gives you 100', kind: 'collect', value: 100 },
  { id: 'chest_pay_hospital', deck: 'chest', text: 'Pay 100 in hospital costs', kind: 'pay', value: 100 },
  { id: 'chest_pay_school', deck: 'chest', text: 'Pay 150 in school costs', kind: 'pay', value: 150 },
  { id: 'chest_go_to_jail', deck: 'chest', text: 'Report to jail without collecting the Start bonus', kind: 'go_to_jail' },
  { id: 'chest_jail_free', deck: 'chest', text: 'Keep this pass to leave jail without paying', kind: 'jail_free' },
];

const CARD_LOOKUP = new Map<string, MonopolyCard>(
  [...CHANCE_CARDS, ...CHEST_CARDS].map((card) => [card.id, card]),
);

export class MonopolyEngine implements DistinctGameAdapter<MonopolyGameState, MonopolyAction, MonopolyPlayerView, MonopolyResult, 'monopoly'> {
  readonly key = 'monopoly' as const;
  readonly rulesetId = 'monopoly.distinct-classic-40.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(
    private readonly rollDie: DiceRoller = () => randomInt(1, 7),
    private readonly shuffleValues: DeckShuffler = secureShuffle,
  ) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): MonopolyGameState {
    this.requirePlayers(playerIds);
    const heldJailCards: MonopolyGameState['heldJailCards'] = Object.fromEntries(playerIds.map((id) => [id, []]));
    const players: MonopolyPlayer[] = playerIds.map((id, index) => ({
      id,
      name: playerNames[id] || `Player ${index + 1}`,
      originalToken: PLAYER_TOKENS[index],
      originalColor: PLAYER_COLORS[index],
      position: 0,
      cash: START_CASH,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
      bankruptOrder: null,
      properties: [],
    }));
    const chanceDeck = this.shuffleValues(CHANCE_CARDS.map((card) => card.id));
    const chestDeck = this.shuffleValues(CHEST_CARDS.map((card) => card.id));
    return {
      gameKey: this.key,
      players,
      board: BOARD.map((space) => ({ ...space })),
      ownership: Object.fromEntries(BOARD.map((space) => [space.index, null])),
      buildings: Object.fromEntries(BOARD.filter((space) => space.kind === 'street').map((space) => [space.index, 0])),
      mortgaged: [],
      currentTurnId: players[0].id,
      activePlayerIds: players.map((player) => player.id),
      turn: freshTurnState(),
      pendingPurchase: null,
      pendingAuction: null,
      pendingDebt: null,
      debtQueue: [],
      debtContext: null,
      pendingTrade: null,
      pendingBankruptcyAuctions: [],
      heldJailCards,
      chanceDeck,
      chanceDiscard: [],
      chestDeck,
      chestDiscard: [],
      housesRemaining: HOUSE_BANK_TOTAL,
      hotelsRemaining: HOTEL_BANK_TOTAL,
      phase: 'rolling',
      winnerId: null,
      isDraw: false,
      finishReason: null,
      lastCard: null,
      lastEvent: 'Game started',
    };
  }

  applyAction(state: MonopolyGameState, playerId: string, action: MonopolyAction): DistinctActionResult<MonopolyResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const player = this.getPlayer(state, playerId);
    if (!player || player.bankrupt) return { valid: false, reason: 'Player not active' };

    const pendingResolution = this.applyPendingAction(state, playerId, action);
    if (pendingResolution) return pendingResolution;

    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    return this.applyActionAndRefresh(state, this.applyTurnAction(state, playerId, action));
  }

  private applyPendingAction(
    state: MonopolyGameState,
    playerId: string,
    action: MonopolyAction,
  ): DistinctActionResult<MonopolyResult> | null {
    if (state.pendingTrade) {
      return this.applyActionAndRefresh(state, this.applyTradeResolution(state, playerId, action));
    }
    if (state.pendingDebt) {
      return this.applyActionAndRefresh(state, this.applyDebtAction(state, playerId, action));
    }
    if (state.pendingAuction) {
      return this.applyActionAndRefresh(state, this.applyAuctionAction(state, playerId, action));
    }
    return null;
  }

  private applyDebtAction(
    state: MonopolyGameState,
    playerId: string,
    action: MonopolyAction,
  ): DistinctActionResult<MonopolyResult> {
    if (state.pendingDebt?.debtorId !== playerId) return { valid: false, reason: 'Debt settlement in progress' };

    if (hasExactActionShape(action, 'monopoly_pay_debt', [])) return this.payDebt(state, playerId);
    if (hasExactActionShape(action, 'monopoly_declare_bankruptcy', [])) return this.declareBankruptcy(state, playerId);
    if (hasExactActionShape(action, 'monopoly_mortgage', ['spaceIndex']) && isBoundedInteger(action.spaceIndex, 0, 39)) {
      return this.mortgageProperty(state, playerId, action.spaceIndex);
    }
    if (hasExactActionShape(action, 'monopoly_sell_building', ['spaceIndex']) && isBoundedInteger(action.spaceIndex, 0, 39)) {
      return this.sellBuilding(state, playerId, action.spaceIndex);
    }
    if (
      hasExactActionShape(action, 'monopoly_propose_trade', [
        'targetPlayerId',
        'offeredCash',
        'requestedCash',
        'offeredPropertyIndices',
        'requestedPropertyIndices',
        'offeredJailCards',
        'requestedJailCards',
      ])
    ) {
      return this.proposeTrade(state, playerId, action as MonopolyAction & MonopolyTradeOffer);
    }
    return { valid: false, reason: 'Debt settlement in progress' };
  }

  private applyTurnAction(state: MonopolyGameState, playerId: string, action: MonopolyAction): DistinctActionResult<MonopolyResult> {
    const zeroArgHandlers: Array<{ matches: () => boolean; execute: () => DistinctActionResult<MonopolyResult> }> = [
      { matches: () => hasExactActionShape(action, 'monopoly_roll', []), execute: () => this.rollTurn(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_pay_jail', []), execute: () => this.payJail(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_use_jail_card', []), execute: () => this.useJailCard(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_attempt_doubles', []), execute: () => this.attemptDoublesFromJail(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_buy', []), execute: () => this.buyPendingProperty(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_decline', []), execute: () => this.declinePendingProperty(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_end_turn', []), execute: () => this.endTurn(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_cancel_trade', []), execute: () => this.cancelTrade(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_pay_debt', []), execute: () => this.payDebt(state, playerId) },
      { matches: () => hasExactActionShape(action, 'monopoly_declare_bankruptcy', []), execute: () => this.declareBankruptcy(state, playerId) },
    ];

    for (const handler of zeroArgHandlers) {
      if (handler.matches()) return handler.execute();
    }

    if (hasExactActionShape(action, 'monopoly_build', ['spaceIndex']) && isBoundedInteger(action.spaceIndex, 0, 39)) {
      return this.buildHouseOrHotel(state, playerId, action.spaceIndex);
    }
    if (hasExactActionShape(action, 'monopoly_sell_building', ['spaceIndex']) && isBoundedInteger(action.spaceIndex, 0, 39)) {
      return this.sellBuilding(state, playerId, action.spaceIndex);
    }
    if (hasExactActionShape(action, 'monopoly_mortgage', ['spaceIndex']) && isBoundedInteger(action.spaceIndex, 0, 39)) {
      return this.mortgageProperty(state, playerId, action.spaceIndex);
    }
    if (hasExactActionShape(action, 'monopoly_unmortgage', ['spaceIndex']) && isBoundedInteger(action.spaceIndex, 0, 39)) {
      return this.unmortgageProperty(state, playerId, action.spaceIndex);
    }
    if (
      hasExactActionShape(action, 'monopoly_propose_trade', [
        'targetPlayerId',
        'offeredCash',
        'requestedCash',
        'offeredPropertyIndices',
        'requestedPropertyIndices',
        'offeredJailCards',
        'requestedJailCards',
      ])
    ) {
      return this.proposeTrade(state, playerId, action as MonopolyAction & MonopolyTradeOffer);
    }

    return { valid: false, reason: 'Invalid action' };
  }

  private applyActionAndRefresh(
    state: MonopolyGameState,
    resolution: DistinctActionResult<MonopolyResult>,
  ): DistinctActionResult<MonopolyResult> {
    if (resolution.valid) this.refreshPhase(state);
    return resolution;
  }

  getPlayerView(state: MonopolyGameState, playerId: string): MonopolyPlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        properties: [...player.properties],
      })),
      board: state.board.map((space) => this.toBoardView(state, space)),
      youId: playerId,
      currentTurnId: state.currentTurnId,
      activePlayerIds: [...state.activePlayerIds],
      turn: { ...state.turn, lastRoll: state.turn.lastRoll ? [...state.turn.lastRoll] as [number, number] : null },
      pendingPurchase: state.pendingPurchase ? { ...state.pendingPurchase } : null,
      pendingAuction: state.pendingAuction ? this.cloneAuction(state.pendingAuction) : null,
      pendingDebt: state.pendingDebt ? { ...state.pendingDebt } : null,
      pendingTrade: state.pendingTrade
        ? {
            ...state.pendingTrade,
            offeredPropertyIndices: [...state.pendingTrade.offeredPropertyIndices],
            requestedPropertyIndices: [...state.pendingTrade.requestedPropertyIndices],
          }
        : null,
      housesRemaining: state.housesRemaining,
      hotelsRemaining: state.hotelsRemaining,
      chanceRemaining: state.chanceDeck.length,
      chestRemaining: state.chestDeck.length,
      chanceDiscardCount: state.chanceDiscard.length,
      chestDiscardCount: state.chestDiscard.length,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: false,
      canAct: this.canAct(state, playerId),
      legalActions: this.legalActions(state, playerId),
      lastCard: state.lastCard ? { ...state.lastCard } : null,
      lastEvent: state.lastEvent,
    };
  }

  surrender(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const quitter = this.getPlayer(state, playerId);
    if (!quitter || quitter.bankrupt) return { valid: false, reason: 'Player not active' };
    const winner = state.players.find((candidate) => !candidate.bankrupt && candidate.id !== playerId);
    if (!winner) return { valid: false, reason: 'No remaining player' };
    state.phase = 'finished';
    state.winnerId = winner.id;
    state.finishReason = 'surrender';
    state.lastEvent = `${quitter.name} surrendered`;
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: MonopolyGameState): MonopolyResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Monopoly game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: false,
      reason: state.finishReason,
      bankruptOrder: state.players
        .filter((player) => player.bankruptOrder !== null)
        .sort((left, right) => (left.bankruptOrder ?? 0) - (right.bankruptOrder ?? 0))
        .map((player) => player.id),
    };
  }

  private rollTurn(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const player = this.getPlayer(state, playerId)!;
    if (player.inJail) return { valid: false, reason: 'Use jail actions while in jail' };
    if (state.pendingPurchase || state.pendingDebt || state.pendingTrade) return { valid: false, reason: 'Resolve pending state first' };
    if (state.turn.mustEndTurn) return { valid: false, reason: 'End turn required' };
    const [left, right] = this.rollDicePair();
    const total = left + right;
    const isDoubles = left === right;
    state.turn.hasRolled = true;
    state.turn.lastRoll = [left, right];
    state.turn.releasedFromJailByDoubles = false;
    state.turn.doublesCount = isDoubles ? state.turn.doublesCount + 1 : 0;

    if (state.turn.doublesCount >= 3) {
      this.sendToJail(state, player);
      state.turn.mustEndTurn = true;
      state.lastEvent = `${player.name} rolled three doubles and was sent to jail`;
      return { valid: true };
    }

    this.moveBy(state, player, total);
    this.resolveLanding(state, player, total, null);
    if (this.finishIfOnePlayerLeft(state)) return { valid: true, result: this.getResult(state) };

    if (!state.pendingPurchase && !state.pendingAuction && !state.pendingDebt) {
      state.turn.mustEndTurn = !this.canTakeExtraRoll(state, player);
      if (!state.turn.mustEndTurn) state.lastEvent = `${player.name} rolled doubles and may roll again`;
    }
    return { valid: true };
  }

  private payJail(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const player = this.getPlayer(state, playerId)!;
    if (!player.inJail) return { valid: false, reason: 'Player is not in jail' };
    if (state.turn.hasRolled) return { valid: false, reason: 'Roll already used this turn' };
    if (player.cash < JAIL_BAIL) return { valid: false, reason: 'Insufficient cash for bail' };
    player.cash -= JAIL_BAIL;
    player.inJail = false;
    player.jailTurns = 0;
    state.lastEvent = `${player.name} paid jail bail`;
    return { valid: true };
  }

  private useJailCard(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const player = this.getPlayer(state, playerId)!;
    if (!player.inJail) return { valid: false, reason: 'Player is not in jail' };
    if (state.turn.hasRolled) return { valid: false, reason: 'Roll already used this turn' };
    if (player.jailCards < 1) return { valid: false, reason: 'No jail card available' };
    const jailCardDeck = this.takeExactJailCard(state, player.id);
    if (!jailCardDeck) return { valid: false, reason: 'No jail card available' };
    player.inJail = false;
    player.jailTurns = 0;
    this.returnJailCardToDiscard(state, jailCardDeck);
    state.lastEvent = `${player.name} used a jail card`;
    return { valid: true };
  }

  private attemptDoublesFromJail(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const player = this.getPlayer(state, playerId)!;
    if (!player.inJail) return { valid: false, reason: 'Player is not in jail' };
    if (state.turn.hasRolled) return { valid: false, reason: 'Roll already used this turn' };
    const [left, right] = this.rollDicePair();
    const total = left + right;
    const isDoubles = left === right;
    state.turn.hasRolled = true;
    state.turn.lastRoll = [left, right];
    state.turn.doublesCount = 0;

    if (!isDoubles) {
      player.jailTurns += 1;
      if (player.jailTurns < 3) {
        state.turn.mustEndTurn = true;
        state.lastEvent = `${player.name} failed to roll doubles in jail`;
        return { valid: true };
      }
      if (player.cash < JAIL_BAIL) {
        this.createDebt(state, player.id, null, JAIL_BAIL, 'jail_fee');
        player.inJail = false;
        player.jailTurns = 0;
        this.moveBy(state, player, total);
        this.resolveLanding(state, player, total, null);
        state.turn.mustEndTurn = true;
        return { valid: true };
      }
      player.cash -= JAIL_BAIL;
      player.inJail = false;
      player.jailTurns = 0;
      this.moveBy(state, player, total);
      this.resolveLanding(state, player, total, null);
      state.turn.mustEndTurn = true;
      return { valid: true };
    }

    player.inJail = false;
    player.jailTurns = 0;
    state.turn.releasedFromJailByDoubles = true;
    this.moveBy(state, player, total);
    this.resolveLanding(state, player, total, null);
    if (!state.pendingPurchase && !state.pendingAuction && !state.pendingDebt) {
      state.turn.mustEndTurn = true;
    }
    state.lastEvent = `${player.name} rolled doubles to leave jail`;
    return { valid: true };
  }

  private buyPendingProperty(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const pending = state.pendingPurchase;
    if (pending?.playerId !== playerId) return { valid: false, reason: 'No purchasable property pending' };
    const player = this.getPlayer(state, playerId)!;
    if (player.cash < pending.price) return { valid: false, reason: 'Insufficient cash to buy property' };
    this.transferPropertyToPlayer(state, pending.spaceIndex, playerId);
    player.cash -= pending.price;
    state.pendingPurchase = null;
    state.lastEvent = `${player.name} bought ${state.board[pending.spaceIndex].name}`;
    state.turn.mustEndTurn = !this.canTakeExtraRoll(state, player);
    return { valid: true };
  }

  private declinePendingProperty(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const pending = state.pendingPurchase;
    if (pending?.playerId !== playerId) return { valid: false, reason: 'No purchasable property pending' };
    const auction = this.createAuction(state, pending.spaceIndex, playerId);
    state.pendingPurchase = null;
    state.pendingAuction = auction;
    state.lastEvent = `${state.board[pending.spaceIndex].name} moved to auction`;
    return { valid: true };
  }

  private applyAuctionAction(state: MonopolyGameState, playerId: string, action: MonopolyAction): DistinctActionResult<MonopolyResult> {
    const auction = state.pendingAuction;
    if (!auction) return { valid: false, reason: 'No auction pending' };
    if (auction.currentBidderId !== playerId) return { valid: false, reason: 'Not your auction turn' };

    if (hasExactActionShape(action, 'monopoly_bid', ['amount'])) {
      return this.applyAuctionBid(state, auction, playerId, action.amount);
    }

    if (hasExactActionShape(action, 'monopoly_pass_auction', [])) {
      return this.applyAuctionPass(state, auction, playerId);
    }

    return { valid: false, reason: 'Invalid auction action' };
  }

  private applyAuctionBid(
    state: MonopolyGameState,
    auction: MonopolyAuctionState,
    playerId: string,
    amount: number,
  ): DistinctActionResult<MonopolyResult> {
    if (!isBoundedInteger(amount, 1, 10000)) return { valid: false, reason: 'Invalid bid amount' };
    const bidder = this.getPlayer(state, playerId)!;
    if (amount <= auction.highestBid) return { valid: false, reason: 'Bid must exceed current high bid' };
    if (amount > bidder.cash) return { valid: false, reason: 'Bid exceeds available cash' };
    auction.highestBid = amount;
    auction.highestBidderId = playerId;
    auction.bids[playerId] = amount;
    auction.currentBidderId = this.nextAuctionBidder(auction, playerId);
    state.lastEvent = `${bidder.name} bid ${amount}`;
    return { valid: true };
  }

  private applyAuctionPass(
    state: MonopolyGameState,
    auction: MonopolyAuctionState,
    playerId: string,
  ): DistinctActionResult<MonopolyResult> {
    auction.activeBidderIds = auction.activeBidderIds.filter((id) => id !== playerId);
    const passingPlayer = this.getPlayer(state, playerId)!;

    if (auction.activeBidderIds.length === 0) {
      state.pendingAuction = null;
      this.finishAuctionRound(state, auction);
      state.lastEvent = `${passingPlayer.name} passed; auction closed`;
      return { valid: true };
    }

    if (auction.activeBidderIds.length === 1) {
      this.resolveSingleRemainingAuctionBidder(state, auction);
      return { valid: true };
    }

    auction.currentBidderId = this.nextAuctionBidder(auction, playerId);
    state.lastEvent = `${passingPlayer.name} passed`;
    return { valid: true };
  }

  private resolveSingleRemainingAuctionBidder(state: MonopolyGameState, auction: MonopolyAuctionState): void {
    const soleBidderId = auction.activeBidderIds[0];
    if (auction.highestBidderId && auction.highestBidderId === soleBidderId) {
      state.pendingAuction = null;
      this.finishAuctionRound(state, auction);
      return;
    }
    auction.currentBidderId = soleBidderId;
  }

  private endTurn(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.pendingPurchase || state.pendingAuction || state.pendingDebt || state.pendingTrade) {
      return { valid: false, reason: 'Resolve pending state first' };
    }
    if (!state.turn.mustEndTurn) return { valid: false, reason: 'Current turn is not complete' };
    const nextPlayerId = this.nextActivePlayer(state, playerId);
    state.currentTurnId = nextPlayerId;
    state.turn = freshTurnState();
    state.lastEvent = `${this.getPlayer(state, nextPlayerId)!.name}'s turn`;
    return { valid: true };
  }

  private buildHouseOrHotel(state: MonopolyGameState, playerId: string, spaceIndex: number): DistinctActionResult<MonopolyResult> {
    if (state.pendingDebt) return { valid: false, reason: 'Settle debt before building' };
    const space = state.board[spaceIndex];
    if (space?.kind !== 'street') return { valid: false, reason: 'Only streets can be developed' };
    if (state.ownership[spaceIndex] !== playerId) return { valid: false, reason: 'Property not owned by player' };
    if (!this.playerOwnsMonopolyGroup(state, playerId, space.group)) return { valid: false, reason: 'Full color set required' };
    const groupIndices = this.streetGroupIndices(space.group);
    if (groupIndices.some((index) => state.mortgaged.includes(index))) {
      return { valid: false, reason: 'Cannot build while any property in the set is mortgaged' };
    }
    const current = state.buildings[spaceIndex] ?? 0;
    if (current >= 5) return { valid: false, reason: 'Property already has a hotel' };
    const minInGroup = Math.min(...groupIndices.map((index) => state.buildings[index] ?? 0));
    if (current > minInGroup) return { valid: false, reason: 'Build evenly across the color set' };
    const player = this.getPlayer(state, playerId)!;
    if (player.cash < space.houseCost) return { valid: false, reason: 'Insufficient cash to build' };

    if (current === 4) {
      if (state.hotelsRemaining < 1) return { valid: false, reason: 'No hotels remaining in bank' };
      state.hotelsRemaining -= 1;
      state.housesRemaining += 4;
      state.buildings[spaceIndex] = 5;
    } else {
      if (state.housesRemaining < 1) return { valid: false, reason: 'No houses remaining in bank' };
      state.housesRemaining -= 1;
      state.buildings[spaceIndex] = current + 1;
    }
    player.cash -= space.houseCost;
    state.lastEvent = `${player.name} developed ${space.name}`;
    return { valid: true };
  }

  private sellBuilding(state: MonopolyGameState, playerId: string, spaceIndex: number): DistinctActionResult<MonopolyResult> {
    const space = state.board[spaceIndex];
    if (space?.kind !== 'street') return { valid: false, reason: 'Only streets can be sold down' };
    if (state.ownership[spaceIndex] !== playerId) return { valid: false, reason: 'Property not owned by player' };
    const current = state.buildings[spaceIndex] ?? 0;
    if (current <= 0) return { valid: false, reason: 'No buildings to sell' };
    const groupIndices = this.streetGroupIndices(space.group);
    const maxInGroup = Math.max(...groupIndices.map((index) => state.buildings[index] ?? 0));
    if (current < maxInGroup) return { valid: false, reason: 'Sell evenly across the color set' };
    if (current === 5) {
      if (state.housesRemaining < 4) return { valid: false, reason: 'Cannot break a hotel without four houses in bank' };
      state.hotelsRemaining += 1;
      state.housesRemaining -= 4;
      state.buildings[spaceIndex] = 4;
    } else {
      state.housesRemaining += 1;
      state.buildings[spaceIndex] = current - 1;
    }
    const player = this.getPlayer(state, playerId)!;
    player.cash += Math.floor(space.houseCost / 2);
    state.lastEvent = `${player.name} sold development on ${space.name}`;
    return { valid: true };
  }

  private mortgageProperty(state: MonopolyGameState, playerId: string, spaceIndex: number): DistinctActionResult<MonopolyResult> {
    const space = state.board[spaceIndex];
    if (!this.isOwnable(space)) return { valid: false, reason: 'Only ownable spaces can be mortgaged' };
    if (state.ownership[spaceIndex] !== playerId) return { valid: false, reason: 'Property not owned by player' };
    if (state.mortgaged.includes(spaceIndex)) return { valid: false, reason: 'Property already mortgaged' };
    if (space.kind === 'street') {
      const group = this.streetGroupIndices(space.group);
      if (group.some((index) => (state.buildings[index] ?? 0) > 0)) {
        return { valid: false, reason: 'Cannot mortgage while the color set has buildings' };
      }
    }
    state.mortgaged.push(spaceIndex);
    const player = this.getPlayer(state, playerId)!;
    player.cash += space.mortgage;
    state.lastEvent = `${player.name} mortgaged ${space.name}`;
    return { valid: true };
  }

  private unmortgageProperty(state: MonopolyGameState, playerId: string, spaceIndex: number): DistinctActionResult<MonopolyResult> {
    const space = state.board[spaceIndex];
    if (!this.isOwnable(space)) return { valid: false, reason: 'Only ownable spaces can be unmortgaged' };
    if (state.ownership[spaceIndex] !== playerId) return { valid: false, reason: 'Property not owned by player' };
    if (!state.mortgaged.includes(spaceIndex)) return { valid: false, reason: 'Property is not mortgaged' };
    const cost = Math.ceil(space.mortgage * 1.1);
    const player = this.getPlayer(state, playerId)!;
    if (player.cash < cost) return { valid: false, reason: 'Insufficient cash to unmortgage' };
    player.cash -= cost;
    state.mortgaged = state.mortgaged.filter((value) => value !== spaceIndex);
    state.lastEvent = `${player.name} unmortgaged ${space.name}`;
    return { valid: true };
  }

  private proposeTrade(
    state: MonopolyGameState,
    playerId: string,
    action: MonopolyAction & MonopolyTradeOffer,
  ): DistinctActionResult<MonopolyResult> {
    if (state.pendingPurchase || state.pendingAuction || state.pendingTrade) return { valid: false, reason: 'Another pending decision exists' };
    if (!this.isTradeShapeValid(action)) return { valid: false, reason: 'Invalid trade shape' };
    if (action.targetPlayerId === playerId) return { valid: false, reason: 'Cannot trade with self' };
    const target = this.getPlayer(state, action.targetPlayerId);
    const proposer = this.getPlayer(state, playerId);
    if (!target || target.bankrupt || !proposer || proposer.bankrupt) return { valid: false, reason: 'Invalid trade participants' };
    if (!this.validateTradeOwnership(state, playerId, action.offeredPropertyIndices)) {
      return { valid: false, reason: 'Offered properties are invalid' };
    }
    if (!this.validateTradeOwnership(state, target.id, action.requestedPropertyIndices)) {
      return { valid: false, reason: 'Requested properties are invalid' };
    }
    if (proposer.cash < action.offeredCash || target.cash < action.requestedCash) {
      return { valid: false, reason: 'Insufficient cash for trade terms' };
    }
    if (proposer.jailCards < action.offeredJailCards || target.jailCards < action.requestedJailCards) {
      return { valid: false, reason: 'Insufficient jail cards for trade terms' };
    }
    state.pendingTrade = {
      proposerId: playerId,
      targetPlayerId: target.id,
      offeredCash: action.offeredCash,
      requestedCash: action.requestedCash,
      offeredPropertyIndices: [...action.offeredPropertyIndices],
      requestedPropertyIndices: [...action.requestedPropertyIndices],
      offeredJailCards: action.offeredJailCards,
      requestedJailCards: action.requestedJailCards,
    };
    state.lastEvent = `${proposer.name} proposed a trade to ${target.name}`;
    return { valid: true };
  }

  private applyTradeResolution(state: MonopolyGameState, playerId: string, action: MonopolyAction): DistinctActionResult<MonopolyResult> {
    const trade = state.pendingTrade;
    if (!trade) return { valid: false, reason: 'No trade pending' };
    if (hasExactActionShape(action, 'monopoly_cancel_trade', [])) {
      if (trade.proposerId !== playerId) return { valid: false, reason: 'Only proposer can cancel trade' };
      state.pendingTrade = null;
      state.lastEvent = 'Trade canceled by proposer';
      return { valid: true };
    }
    if (!hasExactActionShape(action, 'monopoly_respond_trade', ['approved']) || typeof action.approved !== 'boolean') {
      return { valid: false, reason: 'Invalid trade response' };
    }
    if (trade.targetPlayerId !== playerId) return { valid: false, reason: 'Only target can respond to trade' };
    if (!action.approved) {
      state.pendingTrade = null;
      state.lastEvent = 'Trade rejected';
      return { valid: true };
    }

    const proposer = this.getPlayer(state, trade.proposerId);
    const target = this.getPlayer(state, trade.targetPlayerId);
    if (!proposer || !target || proposer.bankrupt || target.bankrupt) {
      state.pendingTrade = null;
      return { valid: false, reason: 'Trade participants are no longer active' };
    }
    if (!this.validateTradeOwnership(state, proposer.id, trade.offeredPropertyIndices)
      || !this.validateTradeOwnership(state, target.id, trade.requestedPropertyIndices)) {
      state.pendingTrade = null;
      return { valid: false, reason: 'Trade is no longer valid' };
    }
    if (proposer.cash < trade.offeredCash || target.cash < trade.requestedCash
      || proposer.jailCards < trade.offeredJailCards || target.jailCards < trade.requestedJailCards) {
      state.pendingTrade = null;
      return { valid: false, reason: 'Trade resources changed before approval' };
    }

    const proposerInterest = this.tradeMortgageInterest(state, trade.requestedPropertyIndices);
    const targetInterest = this.tradeMortgageInterest(state, trade.offeredPropertyIndices);
    if (proposer.cash < trade.offeredCash + proposerInterest || target.cash < trade.requestedCash + targetInterest) {
      state.pendingTrade = null;
      return { valid: false, reason: 'Insufficient cash for mortgage transfer interest' };
    }

    proposer.cash = proposer.cash - trade.offeredCash + trade.requestedCash - proposerInterest;
    target.cash = target.cash + trade.offeredCash - trade.requestedCash - targetInterest;
    this.transferExactJailCards(state, proposer.id, target.id, trade.offeredJailCards);
    this.transferExactJailCards(state, target.id, proposer.id, trade.requestedJailCards);

    trade.offeredPropertyIndices.forEach((index) => this.transferPropertyToPlayer(state, index, target.id));
    trade.requestedPropertyIndices.forEach((index) => this.transferPropertyToPlayer(state, index, proposer.id));
    state.pendingTrade = null;
    state.lastEvent = `${proposer.name} and ${target.name} completed a trade`;
    return { valid: true };
  }

  private cancelTrade(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    if (!state.pendingTrade) return { valid: false, reason: 'No trade pending' };
    if (state.pendingTrade.proposerId !== playerId) return { valid: false, reason: 'Only proposer can cancel trade' };
    state.pendingTrade = null;
    state.lastEvent = 'Trade canceled';
    return { valid: true };
  }

  private payDebt(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const debt = state.pendingDebt;
    if (debt?.debtorId !== playerId) return { valid: false, reason: 'No payable debt' };
    const debtor = this.getPlayer(state, playerId)!;
    if (debtor.cash < debt.amount) return { valid: false, reason: 'Insufficient cash to clear debt' };
    debtor.cash -= debt.amount;
    if (debt.creditorId) {
      const creditor = this.getPlayer(state, debt.creditorId);
      if (creditor && !creditor.bankrupt) creditor.cash += debt.amount;
    }
    state.pendingDebt = null;
    this.advanceDebtQueue(state);
    state.lastEvent = `${debtor.name} paid debt`;
    return { valid: true };
  }

  private declareBankruptcy(state: MonopolyGameState, playerId: string): DistinctActionResult<MonopolyResult> {
    const debtor = this.getPlayer(state, playerId);
    if (!debtor || debtor.bankrupt) return { valid: false, reason: 'Player not active' };
    if (state.pendingDebt?.debtorId !== playerId) {
      return { valid: false, reason: 'No debt to discharge' };
    }
    if (this.canCoverDebtWithLegalLiquidation(state, debtor.id, state.pendingDebt.amount)) {
      return { valid: false, reason: 'Player can cover debt through legal liquidation' };
    }
    const creditorId = state.pendingDebt?.debtorId === playerId ? state.pendingDebt.creditorId : null;
    this.bankruptPlayer(state, playerId, creditorId);
    state.pendingDebt = null;
    this.advanceDebtQueue(state);
    state.pendingTrade = null;
    state.pendingPurchase = null;
    if (this.finishIfOnePlayerLeft(state)) return { valid: true, result: this.getResult(state) };
    return { valid: true };
  }

  private resolveLanding(
    state: MonopolyGameState,
    player: MonopolyPlayer,
    moveTotal: number,
    options: { railroadDoubleRent?: boolean; utilityMultiplier?: 4 | 10 } | null,
  ): void {
    const space = state.board[player.position];
    if (space.kind === 'go') {
      state.lastEvent = `${player.name} landed on Start`;
      return;
    }
    if (space.kind === 'free_parking') {
      state.lastEvent = `${player.name} landed on Free Parking`;
      return;
    }
    if (space.kind === 'jail') {
      state.lastEvent = `${player.name} is visiting jail`;
      return;
    }
    if (space.kind === 'go_to_jail') {
      this.sendToJail(state, player);
      state.lastEvent = `${player.name} was sent to jail`;
      return;
    }
    if (space.kind === 'tax') {
      this.createDebt(state, player.id, null, space.amount, 'tax');
      state.lastEvent = `${player.name} owes ${space.amount} in tax`;
      return;
    }
    if (space.kind === 'chance' || space.kind === 'chest') {
      this.applyCard(state, player, space.kind, moveTotal);
      return;
    }
    this.resolveOwnableLanding(state, player, space, moveTotal, options);
  }

  private resolveOwnableLanding(
    state: MonopolyGameState,
    player: MonopolyPlayer,
    space: MonopolyBoardSpace,
    moveTotal: number,
    options: { railroadDoubleRent?: boolean; utilityMultiplier?: 4 | 10 } | null,
  ): void {
    if (!this.isOwnable(space)) return;
    const ownerId = state.ownership[space.index];
    if (!ownerId) {
      state.pendingPurchase = { playerId: player.id, spaceIndex: space.index, price: space.price };
      state.lastEvent = `${space.name} is available for purchase`;
      return;
    }
    if (ownerId === player.id) {
      state.lastEvent = `${player.name} landed on owned property`;
      return;
    }
    if (state.mortgaged.includes(space.index)) {
      state.lastEvent = `${player.name} landed on a mortgaged property`;
      return;
    }
    const rent = this.calculateRent(state, ownerId, space, moveTotal, options);
    if (rent > 0) {
      this.createDebt(state, player.id, ownerId, rent, 'rent');
      state.lastEvent = `${player.name} owes ${rent} rent`;
    }
  }

  private applyCard(state: MonopolyGameState, player: MonopolyPlayer, deck: DeckType, triggeringRollTotal: number): void {
    const cardId = this.drawCard(state, deck);
    const card = CARD_LOOKUP.get(cardId)!;
    state.lastCard = { deck, cardId: card.id, playerId: player.id, text: card.text };

    if (card.kind === 'jail_free') {
      this.giveExactJailCard(state, player.id, deck);
      state.lastEvent = `${player.name} drew a jail free card`;
      return;
    }

    this.pushToDiscard(state, deck, card.id);
    this.applyCardEffect(state, player, card, triggeringRollTotal);
  }

  private applyCardEffect(state: MonopolyGameState, player: MonopolyPlayer, card: MonopolyCard, triggeringRollTotal: number): void {
    const amount = card.value ?? 0;
    const resolvedKind = card.kind;
    if (resolvedKind === 'jail_free') return;

    const handlers: Record<Exclude<MonopolyCard['kind'], 'jail_free'>, () => void> = {
      collect: () => this.applyCardCollect(state, player, amount),
      pay: () => this.applyCardPay(state, player, amount),
      pay_each_player: () => this.applyCardPayEachPlayer(state, player, amount),
      collect_each_player: () => this.applyCardCollectEachPlayer(state, player, amount),
      repairs: () => this.applyCardRepairs(state, player, card),
      go_to_jail: () => this.applyCardGoToJail(state, player),
      move_relative: () => this.applyCardMoveRelative(state, player, amount, triggeringRollTotal),
      move_absolute: () => this.applyCardMoveAbsolute(state, player, card.destination ?? 0, triggeringRollTotal),
      move_nearest_railroad: () => this.applyCardMoveNearestRailroad(state, player, triggeringRollTotal),
      move_nearest_utility: () => this.applyCardMoveNearestUtility(state, player),
    };

    handlers[resolvedKind]();
  }

  private applyCardCollect(state: MonopolyGameState, player: MonopolyPlayer, amount: number): void {
    player.cash += amount;
    state.lastEvent = `${player.name} collected ${amount}`;
  }

  private applyCardPay(state: MonopolyGameState, player: MonopolyPlayer, amount: number): void {
    this.createDebt(state, player.id, null, amount, 'card');
    state.lastEvent = `${player.name} owes ${amount}`;
  }

  private applyCardPayEachPlayer(state: MonopolyGameState, player: MonopolyPlayer, amountPerPlayer: number): void {
    const recipients = state.players.filter((candidate) => !candidate.bankrupt && candidate.id !== player.id);
    if (recipients.length > 0 && amountPerPlayer > 0) {
      this.beginDebtResolution(state);
    }
    for (const recipient of recipients) {
      this.createDebt(state, player.id, recipient.id, amountPerPlayer, 'card');
    }
    state.lastEvent = `${player.name} must pay each player`;
  }

  private applyCardCollectEachPlayer(state: MonopolyGameState, player: MonopolyPlayer, amountPerPlayer: number): void {
    const payers = state.players.filter((candidate) => !candidate.bankrupt && candidate.id !== player.id);
    if (payers.length > 0 && amountPerPlayer > 0) {
      this.beginDebtResolution(state);
    }
    for (const payer of payers) {
      this.createDebt(state, payer.id, player.id, amountPerPlayer, 'card');
    }
    state.lastEvent = `${player.name} collected from each player`;
  }

  private applyCardRepairs(state: MonopolyGameState, player: MonopolyPlayer, card: MonopolyCard): void {
    const cost = this.repairCost(state, player.id, card.houseRepair ?? 0, card.hotelRepair ?? 0);
    if (cost > 0) this.createDebt(state, player.id, null, cost, 'card');
    state.lastEvent = `${player.name} owes ${cost} in property repairs`;
  }

  private applyCardGoToJail(state: MonopolyGameState, player: MonopolyPlayer): void {
    this.sendToJail(state, player);
    state.lastEvent = `${player.name} drew a go-to-jail card`;
  }

  private applyCardMoveRelative(
    state: MonopolyGameState,
    player: MonopolyPlayer,
    moveBy: number,
    triggeringRollTotal: number,
  ): void {
    this.moveBy(state, player, moveBy);
    this.resolveLanding(state, player, triggeringRollTotal, null);
  }

  private applyCardMoveAbsolute(
    state: MonopolyGameState,
    player: MonopolyPlayer,
    destination: number,
    triggeringRollTotal: number,
  ): void {
    this.moveTo(state, player, destination, true);
    this.resolveLanding(state, player, triggeringRollTotal, null);
  }

  private applyCardMoveNearestRailroad(state: MonopolyGameState, player: MonopolyPlayer, triggeringRollTotal: number): void {
    const destination = this.nextFrom(player.position, [5, 15, 25, 35]);
    this.moveTo(state, player, destination, true);
    this.resolveLanding(state, player, triggeringRollTotal, { railroadDoubleRent: true });
  }

  private applyCardMoveNearestUtility(state: MonopolyGameState, player: MonopolyPlayer): void {
    const destination = this.nextFrom(player.position, [12, 28]);
    this.moveTo(state, player, destination, true);
    const ownerId = state.ownership[destination];
    if (ownerId && ownerId !== player.id && !state.mortgaged.includes(destination)) {
      const [left, right] = this.rollDicePair();
      this.resolveLanding(state, player, left + right, { utilityMultiplier: 10 });
      return;
    }
    this.resolveLanding(state, player, 0, null);
  }

  private calculateRent(
    state: MonopolyGameState,
    ownerId: string,
    space: MonopolyBoardSpace,
    moveTotal: number,
    options: { railroadDoubleRent?: boolean; utilityMultiplier?: 4 | 10 } | null,
  ): number {
    if (space.kind === 'street') {
      const buildingCount = state.buildings[space.index] ?? 0;
      if (buildingCount > 0) return space.rents[buildingCount];
      const ownsSet = this.playerOwnsMonopolyGroup(state, ownerId, space.group);
      return ownsSet ? space.rents[0] * 2 : space.rents[0];
    }
    if (space.kind === 'railroad') {
      const railOwned = this.playerRailroads(state, ownerId).length;
      const base = [25, 50, 100, 200][Math.max(0, Math.min(railOwned, 4)) - 1] ?? 25;
      return options?.railroadDoubleRent ? base * 2 : base;
    }
    if (space.kind === 'utility') {
      const owned = this.playerUtilities(state, ownerId).length;
      const multiplier = options?.utilityMultiplier ?? (owned >= 2 ? 10 : 4);
      return multiplier * moveTotal;
    }
    return 0;
  }

  private applyPostAuctionFlow(state: MonopolyGameState): void {
    this.startNextBankruptcyAuctionIfNeeded(state);
    if (!state.pendingAuction) {
      const current = this.getPlayer(state, state.currentTurnId);
      if (current && state.turn.hasRolled) {
        state.turn.mustEndTurn = !this.canTakeExtraRoll(state, current);
      }
    }
  }

  private finishAuctionRound(state: MonopolyGameState, auction: MonopolyAuctionState): void {
    if (auction.highestBidderId && auction.highestBid > 0) {
      const winner = this.getPlayer(state, auction.highestBidderId);
      if (winner && !winner.bankrupt && winner.cash >= auction.highestBid) {
        winner.cash -= auction.highestBid;
        this.transferPropertyToPlayer(state, auction.spaceIndex, winner.id);
        state.lastEvent = `${winner.name} won auction for ${state.board[auction.spaceIndex].name}`;
      }
    }
    this.applyPostAuctionFlow(state);
  }

  private createAuction(state: MonopolyGameState, spaceIndex: number, seedPlayerId: string): MonopolyAuctionState {
    const order = this.turnOrderedActivePlayers(state, seedPlayerId);
    return {
      spaceIndex,
      eligiblePlayerIds: [...order],
      activeBidderIds: [...order],
      currentBidderId: order[0],
      highestBid: 0,
      highestBidderId: null,
      bids: Object.fromEntries(order.map((id) => [id, 0])),
    };
  }

  private nextAuctionBidder(auction: MonopolyAuctionState, fromPlayerId: string): string {
    const ring = auction.eligiblePlayerIds;
    const start = ring.indexOf(fromPlayerId);
    const offset = Math.max(start, 0);
    for (let step = 1; step <= ring.length; step += 1) {
      const candidate = ring[(offset + step) % ring.length];
      if (auction.activeBidderIds.includes(candidate)) return candidate;
    }
    return auction.activeBidderIds[0];
  }

  private turnOrderedActivePlayers(state: MonopolyGameState, anchorPlayerId: string): string[] {
    const active = state.players.filter((player) => !player.bankrupt).map((player) => player.id);
    const anchor = active.indexOf(anchorPlayerId);
    if (anchor < 0) return active;
    return [...active.slice(anchor), ...active.slice(0, anchor)];
  }

  private createDebt(
    state: MonopolyGameState,
    debtorId: string,
    creditorId: string | null,
    amount: number,
    reason: MonopolyDebtState['reason'],
  ): void {
    if (amount <= 0) return;
    this.beginDebtResolution(state);
    const debt: MonopolyDebtState = {
      debtorId,
      creditorId,
      amount,
      reason,
    };
    if (!state.pendingDebt) {
      state.pendingDebt = debt;
      return;
    }
    state.debtQueue.push(debt);
  }

  private repairCost(state: MonopolyGameState, playerId: string, perHouse: number, perHotel: number): number {
    const owned = this.getPlayer(state, playerId)?.properties ?? [];
    let houses = 0;
    let hotels = 0;
    for (const index of owned) {
      const count = state.buildings[index] ?? 0;
      if (count >= 5) hotels += 1;
      else houses += count;
    }
    return houses * perHouse + hotels * perHotel;
  }

  private drawCard(state: MonopolyGameState, deck: DeckType): string {
    const drawPile = deck === 'chance' ? state.chanceDeck : state.chestDeck;
    const discard = deck === 'chance' ? state.chanceDiscard : state.chestDiscard;
    if (drawPile.length === 0) {
      const replenished = this.shuffleValues([...discard]);
      discard.splice(0, discard.length);
      drawPile.push(...replenished);
    }
    if (drawPile.length === 0) throw new Error('No cards available to draw');
    return drawPile.shift()!;
  }

  private pushToDiscard(state: MonopolyGameState, deck: DeckType, cardId: string): void {
    if (deck === 'chance') state.chanceDiscard.push(cardId);
    else state.chestDiscard.push(cardId);
  }

  private returnJailCardToDiscard(state: MonopolyGameState, deck: DeckType): void {
    if (deck === 'chance') {
      state.chanceDiscard.push('chance_jail_free');
      return;
    }
    state.chestDiscard.push('chest_jail_free');
  }

  private moveBy(state: MonopolyGameState, player: MonopolyPlayer, steps: number): void {
    const size = state.board.length;
    const from = player.position;
    const to = ((from + steps) % size + size) % size;
    if (steps > 0 && from + steps >= size) player.cash += GO_COLLECT;
    player.position = to;
  }

  private moveTo(state: MonopolyGameState, player: MonopolyPlayer, destination: number, awardGoOnPass: boolean): void {
    if (awardGoOnPass && destination < player.position) player.cash += GO_COLLECT;
    player.position = destination;
  }

  private sendToJail(state: MonopolyGameState, player: MonopolyPlayer): void {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    state.turn.doublesCount = 0;
  }

  private canTakeExtraRoll(state: MonopolyGameState, player: MonopolyPlayer): boolean {
    if (!state.turn.lastRoll) return false;
    const [left, right] = state.turn.lastRoll;
    return left === right && !player.inJail && !state.turn.releasedFromJailByDoubles;
  }

  private nextActivePlayer(state: MonopolyGameState, playerId: string): string {
    if (state.activePlayerIds.length === 0) return playerId;
    const seat = state.players.findIndex((player) => player.id === playerId);
    if (seat < 0) return state.activePlayerIds[0];
    for (let step = 1; step <= state.players.length; step += 1) {
      const candidate = state.players[(seat + step) % state.players.length];
      if (!candidate.bankrupt) return candidate.id;
    }
    return state.activePlayerIds[0];
  }

  private finishIfOnePlayerLeft(state: MonopolyGameState): boolean {
    const remaining = state.players.filter((player) => !player.bankrupt);
    if (remaining.length !== 1) return false;
    state.phase = 'finished';
    state.winnerId = remaining[0].id;
    state.finishReason = 'last_player';
    state.pendingAuction = null;
    state.pendingDebt = null;
    state.debtQueue = [];
    state.debtContext = null;
    state.pendingPurchase = null;
    state.pendingTrade = null;
    return true;
  }

  private bankruptPlayer(state: MonopolyGameState, debtorId: string, creditorId: string | null): void {
    const debtor = this.getPlayer(state, debtorId);
    if (!debtor || debtor.bankrupt) return;
    this.liquidateAllBuildings(state, debtor.id);
    debtor.bankrupt = true;
    debtor.bankruptOrder = state.players.filter((player) => player.bankrupt).length;
    const debtorProperties = [...debtor.properties].sort((left, right) => left - right);

    if (creditorId) this.transferBankruptcyAssetsToCreditor(state, debtor, creditorId, debtorProperties);
    else this.transferBankruptcyAssetsToBank(state, debtor.id, debtorProperties);

    debtor.cash = 0;
    debtor.jailCards = 0;
    state.heldJailCards[debtor.id] = [];
    debtor.properties = [];
    debtor.inJail = false;
    debtor.jailTurns = 0;
    state.debtQueue = state.debtQueue.filter((debt) => debt.debtorId !== debtor.id);
    state.activePlayerIds = state.players.filter((player) => !player.bankrupt).map((player) => player.id);
    if (state.currentTurnId === debtor.id && state.activePlayerIds.length > 0) {
      state.currentTurnId = this.nextActivePlayer(state, debtor.id);
      state.turn = freshTurnState();
    }
    state.lastEvent = `${debtor.name} declared bankruptcy`;
  }

  private transferBankruptcyAssetsToCreditor(
    state: MonopolyGameState,
    debtor: MonopolyPlayer,
    creditorId: string,
    debtorProperties: number[],
  ): void {
    const creditor = this.getPlayer(state, creditorId);
    if (!creditor || creditor.bankrupt) return;
    creditor.cash += Math.max(0, debtor.cash);
    this.transferExactJailCards(state, debtor.id, creditor.id, debtor.jailCards);
    debtorProperties.forEach((index) => this.transferPropertyToPlayer(state, index, creditor.id));
    const transferInterest = this.tradeMortgageInterest(state, debtorProperties);
    if (transferInterest <= 0) return;
    if (creditor.cash >= transferInterest) {
      creditor.cash -= transferInterest;
      return;
    }
    this.beginDebtResolution(state);
    this.createDebt(state, creditor.id, null, transferInterest, 'trade_interest');
  }

  private transferBankruptcyAssetsToBank(
    state: MonopolyGameState,
    debtorId: string,
    debtorProperties: number[],
  ): void {
    debtorProperties.forEach((index) => this.returnPropertyToBank(state, index));
    this.returnAllJailCardsToBank(state, debtorId);
    state.pendingBankruptcyAuctions.push(...debtorProperties);
    state.pendingBankruptcyAuctions = [...new Set(state.pendingBankruptcyAuctions)].sort((left, right) => left - right);
  }

  private startNextBankruptcyAuctionIfNeeded(state: MonopolyGameState): void {
    if (state.pendingAuction || state.pendingDebt || state.debtQueue.length > 0) return;
    const next = state.pendingBankruptcyAuctions.shift();
    if (next === undefined) return;
    state.pendingAuction = this.createAuction(state, next, state.currentTurnId);
  }

  private transferPropertyToPlayer(state: MonopolyGameState, spaceIndex: number, playerId: string): void {
    const previousOwnerId = state.ownership[spaceIndex];
    if (previousOwnerId) {
      const previousOwner = this.getPlayer(state, previousOwnerId);
      if (previousOwner) previousOwner.properties = previousOwner.properties.filter((value) => value !== spaceIndex);
    }
    state.ownership[spaceIndex] = playerId;
    const owner = this.getPlayer(state, playerId);
    if (owner && !owner.properties.includes(spaceIndex)) {
      owner.properties.push(spaceIndex);
      owner.properties.sort((left, right) => left - right);
    }
  }

  private returnPropertyToBank(state: MonopolyGameState, spaceIndex: number): void {
    const space = state.board[spaceIndex];
    const ownerId = state.ownership[spaceIndex];
    if (ownerId) {
      const owner = this.getPlayer(state, ownerId);
      if (owner) owner.properties = owner.properties.filter((value) => value !== spaceIndex);
    }
    state.ownership[spaceIndex] = null;
    state.mortgaged = state.mortgaged.filter((value) => value !== spaceIndex);
    if (space.kind === 'street') {
      const buildings = state.buildings[spaceIndex] ?? 0;
      if (buildings >= 5) {
        state.hotelsRemaining += 1;
      } else {
        state.housesRemaining += buildings;
      }
      state.buildings[spaceIndex] = 0;
    }
  }

  private validateTradeOwnership(state: MonopolyGameState, playerId: string, propertyIndices: number[]): boolean {
    if (!Array.isArray(propertyIndices) || new Set(propertyIndices).size !== propertyIndices.length) return false;
    return propertyIndices.every((spaceIndex) => {
      if (!isBoundedInteger(spaceIndex, 0, 39)) return false;
      const space = state.board[spaceIndex];
      if (!this.isOwnable(space)) return false;
      if (state.ownership[spaceIndex] !== playerId) return false;
      if (space.kind === 'street') {
        const groupIndices = this.streetGroupIndices(space.group);
        if (groupIndices.some((index) => (state.buildings[index] ?? 0) > 0)) return false;
      }
      return true;
    });
  }

  private tradeMortgageInterest(state: MonopolyGameState, propertyIndices: number[]): number {
    let total = 0;
    for (const index of propertyIndices) {
      if (!state.mortgaged.includes(index)) continue;
      const space = state.board[index];
      if (this.isOwnable(space)) total += Math.ceil(space.mortgage * 0.1);
    }
    return total;
  }

  private isTradeShapeValid(action: MonopolyTradeOffer): boolean {
    if (typeof action.targetPlayerId !== 'string') return false;
    if (!isBoundedInteger(action.offeredCash, 0, 20000) || !isBoundedInteger(action.requestedCash, 0, 20000)) return false;
    if (!Array.isArray(action.offeredPropertyIndices) || !Array.isArray(action.requestedPropertyIndices)) return false;
    if (!isBoundedInteger(action.offeredJailCards, 0, 4) || !isBoundedInteger(action.requestedJailCards, 0, 4)) return false;
    if (action.offeredPropertyIndices.some((index) => !isBoundedInteger(index, 0, 39))) return false;
    if (action.requestedPropertyIndices.some((index) => !isBoundedInteger(index, 0, 39))) return false;
    if (new Set(action.offeredPropertyIndices).size !== action.offeredPropertyIndices.length) return false;
    if (new Set(action.requestedPropertyIndices).size !== action.requestedPropertyIndices.length) return false;
    const hasValue = action.offeredCash > 0
      || action.requestedCash > 0
      || action.offeredPropertyIndices.length > 0
      || action.requestedPropertyIndices.length > 0
      || action.offeredJailCards > 0
      || action.requestedJailCards > 0;
    if (!hasValue) return false;
    return true;
  }

  private playerOwnsMonopolyGroup(state: MonopolyGameState, playerId: string, group: string): boolean {
    const groupSpaces = state.board.filter((space): space is MonopolyStreetSpace => space.kind === 'street' && space.group === group);
    return groupSpaces.every((space) => state.ownership[space.index] === playerId);
  }

  private streetGroupIndices(group: string): number[] {
    return BOARD.filter((space): space is MonopolyStreetSpace => space.kind === 'street' && space.group === group)
      .map((space) => space.index);
  }

  private playerRailroads(state: MonopolyGameState, playerId: string): number[] {
    return state.board
      .filter((space) => space.kind === 'railroad' && state.ownership[space.index] === playerId)
      .map((space) => space.index);
  }

  private playerUtilities(state: MonopolyGameState, playerId: string): number[] {
    return state.board
      .filter((space) => space.kind === 'utility' && state.ownership[space.index] === playerId)
      .map((space) => space.index);
  }

  private nextFrom(current: number, indices: number[]): number {
    const greater = indices.filter((value) => value > current).sort((left, right) => left - right);
    if (greater.length > 0) return greater[0];
    return [...indices].sort((left, right) => left - right)[0];
  }

  private toBoardView(state: MonopolyGameState, space: MonopolyBoardSpace): MonopolyBoardSpaceView {
    const view: MonopolyBoardSpaceView = {
      index: space.index,
      name: space.name,
      kind: space.kind,
      ownerId: state.ownership[space.index],
      mortgaged: state.mortgaged.includes(space.index),
      buildingCount: state.buildings[space.index] ?? 0,
    };
    if (space.kind === 'street') {
      view.group = space.group;
      view.price = space.price;
      view.rents = [...space.rents] as [number, number, number, number, number, number];
      view.houseCost = space.houseCost;
      view.mortgage = space.mortgage;
    }
    if (space.kind === 'railroad' || space.kind === 'utility') {
      view.price = space.price;
      view.mortgage = space.mortgage;
    }
    if (space.kind === 'tax') view.amount = space.amount;
    return view;
  }

  private cloneAuction(auction: MonopolyAuctionState): MonopolyAuctionState {
    return {
      ...auction,
      eligiblePlayerIds: [...auction.eligiblePlayerIds],
      activeBidderIds: [...auction.activeBidderIds],
      bids: { ...auction.bids },
    };
  }

  private canAct(state: MonopolyGameState, playerId: string): boolean {
    if (state.phase === 'finished') return false;
    if (state.pendingTrade) return state.pendingTrade.proposerId === playerId || state.pendingTrade.targetPlayerId === playerId;
    if (state.pendingDebt) return state.pendingDebt.debtorId === playerId;
    if (state.pendingAuction) return state.pendingAuction.currentBidderId === playerId;
    return state.currentTurnId === playerId;
  }

  private legalActions(state: MonopolyGameState, playerId: string): string[] {
    const player = this.getPlayer(state, playerId);
    if (!player || player.bankrupt || state.phase === 'finished') return [];

    const pendingActions = this.legalActionsWhilePending(state, playerId);
    if (pendingActions) return pendingActions;

    if (state.currentTurnId !== playerId) return [];
    return this.legalActionsOnTurn(state, player);
  }

  private legalActionsWhilePending(state: MonopolyGameState, playerId: string): string[] | null {
    if (state.pendingTrade) {
      if (state.pendingTrade.proposerId === playerId) return ['monopoly_cancel_trade'];
      if (state.pendingTrade.targetPlayerId === playerId) return ['monopoly_respond_trade'];
      return [];
    }
    if (state.pendingDebt) {
      if (state.pendingDebt.debtorId !== playerId) return [];
      return ['monopoly_mortgage', 'monopoly_sell_building', 'monopoly_propose_trade', 'monopoly_pay_debt', 'monopoly_declare_bankruptcy'];
    }
    if (state.pendingAuction) {
      if (state.pendingAuction.currentBidderId !== playerId) return [];
      return ['monopoly_bid', 'monopoly_pass_auction'];
    }
    return null;
  }

  private legalActionsOnTurn(state: MonopolyGameState, player: MonopolyPlayer): string[] {
    const actions: string[] = ['monopoly_propose_trade', 'monopoly_build', 'monopoly_sell_building', 'monopoly_mortgage', 'monopoly_unmortgage'];
    if (state.pendingPurchase?.playerId === player.id) return ['monopoly_buy', 'monopoly_decline'];
    if (player.inJail && !state.turn.hasRolled) {
      actions.push('monopoly_pay_jail', 'monopoly_use_jail_card', 'monopoly_attempt_doubles');
      return actions;
    }
    if (!player.inJail && !state.turn.mustEndTurn) actions.push('monopoly_roll');
    if (state.turn.mustEndTurn) actions.push('monopoly_end_turn');
    return actions;
  }

  private refreshPhase(state: MonopolyGameState): void {
    if (state.phase === 'finished') return;
    if (state.pendingDebt || state.debtQueue.length > 0) {
      state.phase = 'debt';
      return;
    }
    if (state.pendingAuction) {
      state.phase = 'auction';
      return;
    }
    if (state.pendingPurchase) {
      state.phase = 'buying';
      return;
    }
    const current = this.getPlayer(state, state.currentTurnId);
    if (current?.inJail && !state.turn.hasRolled) {
      state.phase = 'jail';
      return;
    }
    if (!state.turn.hasRolled) {
      state.phase = 'rolling';
      return;
    }
    state.phase = 'post_roll';
  }

  private beginDebtResolution(state: MonopolyGameState): void {
    if (state.debtContext || state.phase === 'finished') return;
    state.debtContext = {
      originTurnId: state.currentTurnId,
      turnSnapshot: { ...state.turn, lastRoll: state.turn.lastRoll ? [...state.turn.lastRoll] as [number, number] : null },
    };
  }

  private advanceDebtQueue(state: MonopolyGameState): void {
    while (state.debtQueue.length > 0) {
      const next = state.debtQueue.shift()!;
      const debtor = this.getPlayer(state, next.debtorId);
      const creditor = next.creditorId ? this.getPlayer(state, next.creditorId) : undefined;
      if (!debtor || debtor.bankrupt) continue;
      if (next.creditorId && (!creditor || creditor.bankrupt)) continue;
      if (next.amount <= 0) continue;
      state.pendingDebt = next;
      return;
    }
    state.pendingDebt = null;
    this.restoreTurnAfterDebtResolution(state);
    this.startNextBankruptcyAuctionIfNeeded(state);
  }

  private restoreTurnAfterDebtResolution(state: MonopolyGameState): void {
    if (!state.debtContext) return;
    const context = state.debtContext;
    state.debtContext = null;
    if (state.phase === 'finished') return;
    const originPlayer = this.getPlayer(state, context.originTurnId);
    if (originPlayer && !originPlayer.bankrupt && state.currentTurnId === context.originTurnId) {
      state.turn = {
        ...context.turnSnapshot,
        lastRoll: context.turnSnapshot.lastRoll ? [...context.turnSnapshot.lastRoll] as [number, number] : null,
      };
      if (state.turn.hasRolled) {
        state.turn.mustEndTurn = !this.canTakeExtraRoll(state, originPlayer);
      }
      return;
    }
    state.turn = freshTurnState();
  }

  private giveExactJailCard(state: MonopolyGameState, playerId: string, deck: DeckType): void {
    const held = state.heldJailCards[playerId] ?? [];
    held.push(deck);
    state.heldJailCards[playerId] = held;
    const player = this.getPlayer(state, playerId);
    if (player) player.jailCards = held.length;
  }

  private takeExactJailCard(state: MonopolyGameState, playerId: string): DeckType | null {
    const held = state.heldJailCards[playerId] ?? [];
    if (held.length === 0) return null;
    const deck = held.shift()!;
    state.heldJailCards[playerId] = held;
    const player = this.getPlayer(state, playerId);
    if (player) player.jailCards = held.length;
    return deck;
  }

  private transferExactJailCards(state: MonopolyGameState, fromPlayerId: string, toPlayerId: string, count: number): void {
    if (count <= 0) return;
    const from = state.heldJailCards[fromPlayerId] ?? [];
    const to = state.heldJailCards[toPlayerId] ?? [];
    for (let i = 0; i < count && from.length > 0; i += 1) {
      to.push(from.shift()!);
    }
    state.heldJailCards[fromPlayerId] = from;
    state.heldJailCards[toPlayerId] = to;
    const fromPlayer = this.getPlayer(state, fromPlayerId);
    const toPlayer = this.getPlayer(state, toPlayerId);
    if (fromPlayer) fromPlayer.jailCards = from.length;
    if (toPlayer) toPlayer.jailCards = to.length;
  }

  private returnAllJailCardsToBank(state: MonopolyGameState, playerId: string): void {
    const held = [...(state.heldJailCards[playerId] ?? [])];
    for (const deck of held) {
      this.returnJailCardToDiscard(state, deck);
    }
    state.heldJailCards[playerId] = [];
    const player = this.getPlayer(state, playerId);
    if (player) player.jailCards = 0;
  }

  private canCoverDebtWithLegalLiquidation(state: MonopolyGameState, playerId: string, amount: number): boolean {
    const simulation = structuredClone(state);
    const player = this.getPlayer(simulation, playerId);
    if (!player) return false;
    let soldBuilding = true;
    while (soldBuilding && player.cash < amount) {
      soldBuilding = false;
      for (const index of [...player.properties].sort((left, right) => left - right)) {
        if ((simulation.buildings[index] ?? 0) <= 0) continue;
        if (this.sellBuilding(simulation, playerId, index).valid) {
          soldBuilding = true;
          if (player.cash >= amount) return true;
        }
      }
    }
    for (const index of [...player.properties].sort((left, right) => left - right)) {
      if (this.mortgageProperty(simulation, playerId, index).valid && player.cash >= amount) {
        return true;
      }
    }
    return player.cash >= amount;
  }

  private liquidateAllBuildings(state: MonopolyGameState, playerId: string): void {
    const player = this.getPlayer(state, playerId);
    if (!player) return;
    for (const index of [...player.properties].sort((left, right) => left - right)) {
      const space = state.board[index];
      if (space.kind !== 'street') continue;
      const buildings = state.buildings[index] ?? 0;
      if (buildings <= 0) continue;
      if (buildings >= 5) {
        player.cash += Math.floor(space.houseCost / 2) * 5;
        state.hotelsRemaining += 1;
      } else {
        player.cash += Math.floor(space.houseCost / 2) * buildings;
        state.housesRemaining += buildings;
      }
      state.buildings[index] = 0;
    }
  }

  private rollDicePair(): [number, number] {
    const first = this.rollDie();
    const second = this.rollDie();
    if (!isBoundedInteger(first, 1, 6) || !isBoundedInteger(second, 1, 6)) {
      throw new Error('Dice roller must produce values from 1 to 6');
    }
    return [first, second];
  }

  private getPlayer(state: MonopolyGameState, playerId: string): MonopolyPlayer | undefined {
    return state.players.find((player) => player.id === playerId);
  }

  private isOwnable(space: MonopolyBoardSpace): space is MonopolyBoardSpace & { kind: 'street' | 'railroad' | 'utility'; price: number; mortgage: number } {
    return space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility';
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Monopoly requires two to four distinct players');
    }
  }
}
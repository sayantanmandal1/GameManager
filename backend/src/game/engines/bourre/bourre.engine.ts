import type {
  BourreAction,
  BourreGameState,
  BourrePlayerView,
  BourreResult,
  CardSuit,
  StandardCard,
} from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
const TARGET_SCORE = 30;

export class BourreEngine implements DistinctGameAdapter<BourreGameState, BourreAction, BourrePlayerView, BourreResult> {
  readonly key = 'bourre' as const;
  readonly rulesetId = 'bourre.strict-trump-token-30.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 7;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): BourreGameState {
    this.requirePlayers(playerIds);
    const state: BourreGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0],
      hands: {},
      stock: [],
      recyclePool: [],
      dealerIndex: 0,
      trumpSuit: 'clubs',
      trumpCard: { id: 'c-clubs-2', suit: 'clubs', rank: '2' },
      decisions: {},
      activePlayerIds: [],
      tricksWon: {},
      trick: [],
      currentTurnId: null,
      leaderId: null,
      pot: playerIds.length,
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      handNumber: 0,
      lastHand: null,
      phase: 'deciding',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
    this.dealHand(state);
    return state;
  }

  applyAction(state: BourreGameState, playerId: string, action: BourreAction): DistinctActionResult<BourreResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'hand_complete') return this.nextHand(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.phase === 'deciding') return this.decide(state, playerId, action);
    return this.playCard(state, playerId, action);
  }

  getPlayerView(state: BourreGameState, playerId: string): BourrePlayerView {
    const canAct = state.phase === 'hand_complete'
      ? playerId === state.hostId
      : state.currentTurnId === playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        handCount: state.hands[player.id].length,
        decision: state.decisions[player.id],
        tricksWon: state.tricksWon[player.id],
        score: state.scores[player.id],
      })),
      hostId: state.hostId,
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      dealerId: state.players[state.dealerIndex].id,
      trumpSuit: state.trumpSuit,
      trumpCard: { ...state.trumpCard },
      currentTurnId: state.currentTurnId,
      leaderId: state.leaderId,
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      pot: state.pot,
      handNumber: state.handNumber,
      lastHand: state.lastHand ? { ...state.lastHand, splitIds: [...state.lastHand.splitIds], bourreIds: [...state.lastHand.bourreIds] } : null,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct,
      canFold: state.phase === 'deciding' && canAct && !this.dealerMustStay(state, playerId),
      legalCardIds: state.phase === 'playing' && canAct ? this.legalCards(state, playerId).map((card) => card.id) : [],
    };
  }

  surrender(state: BourreGameState, playerId: string): DistinctActionResult<BourreResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const high = Math.max(...remaining.map((player) => state.scores[player.id]));
    state.winnerId = remaining.find((player) => state.scores[player.id] === high)!.id;
    state.phase = 'finished';
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: BourreGameState): BourreResult {
    if (!state.finishReason) throw new Error('Bourré session is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores } };
  }

  private decide(state: BourreGameState, playerId: string, action: BourreAction): DistinctActionResult<BourreResult> {
    if (!hasExactActionShape(action, 'bourre_decide', ['play', 'discardIds'])
      || typeof action.play !== 'boolean'
      || !Array.isArray(action.discardIds)
      || action.discardIds.length > 5
      || new Set(action.discardIds).size !== action.discardIds.length
      || !action.discardIds.every((id) => typeof id === 'string')) {
      return { valid: false, reason: 'Invalid decision' };
    }
    if (!action.play) {
      if (action.discardIds.length > 0) return { valid: false, reason: 'A folded hand cannot discard selectively' };
      if (this.dealerMustStay(state, playerId)) return { valid: false, reason: 'Dealer must play this hand' };
      state.decisions[playerId] = 'folded';
      state.recyclePool.push(...state.hands[playerId]);
      state.hands[playerId] = [];
    } else {
      if (!action.discardIds.every((id) => state.hands[playerId].some((card) => card.id === id))) {
        return { valid: false, reason: 'Discard not in hand' };
      }
      const discarded = state.hands[playerId].filter((card) => action.discardIds.includes(card.id));
      state.hands[playerId] = state.hands[playerId].filter((card) => !action.discardIds.includes(card.id));
      for (let count = 0; count < discarded.length; count += 1) state.hands[playerId].push(this.drawReplacement(state));
      state.recyclePool.push(...discarded);
      state.decisions[playerId] = 'stayed';
      state.activePlayerIds.push(playerId);
    }

    const next = this.nextPendingDecision(state, playerId);
    if (next) {
      state.currentTurnId = next;
      return { valid: true };
    }
    if (state.activePlayerIds.length === 1) return this.completeHand(state, state.activePlayerIds[0]);
    state.phase = 'playing';
    state.currentTurnId = this.firstActiveLeftOfDealer(state);
    state.leaderId = state.currentTurnId;
    return { valid: true };
  }

  private playCard(state: BourreGameState, playerId: string, action: BourreAction): DistinctActionResult<BourreResult> {
    if (!hasExactActionShape(action, 'play_bourre_card', ['cardId']) || typeof action.cardId !== 'string') {
      return { valid: false, reason: 'Invalid play' };
    }
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!this.legalCards(state, playerId).some((entry) => entry.id === card.id)) {
      return { valid: false, reason: 'Bourré requires following suit, trumping, and playing to win' };
    }
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId, card });
    if (state.trick.length < state.activePlayerIds.length) {
      state.currentTurnId = this.nextActiveId(state, playerId);
      return { valid: true };
    }
    const winnerId = this.trickWinner(state, state.trick);
    state.tricksWon[winnerId] += 1;
    state.trick = [];
    state.currentTurnId = winnerId;
    state.leaderId = winnerId;
    if (state.activePlayerIds.some((id) => state.hands[id].length > 0)) return { valid: true };
    return this.completeHand(state, null);
  }

  private nextHand(state: BourreGameState, playerId: string, action: BourreAction): DistinctActionResult<BourreResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next hand' };
    if (!hasExactActionShape(action, 'next_bourre_hand', [])) return { valid: false, reason: 'Invalid action' };
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    this.dealHand(state);
    return { valid: true };
  }

  private dealHand(state: BourreGameState): void {
    state.handNumber += 1;
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    for (let count = 0; count < 5; count += 1) {
      for (let offset = 1; offset <= state.players.length; offset += 1) {
        const player = state.players[(state.dealerIndex + offset) % state.players.length];
        state.hands[player.id].push(deck.shift()!);
      }
    }
    const dealerId = state.players[state.dealerIndex].id;
    state.trumpCard = { ...state.hands[dealerId][4] };
    state.trumpSuit = state.trumpCard.suit;
    state.stock = deck;
    state.recyclePool = [];
    state.decisions = Object.fromEntries(state.players.map((player) => [player.id, 'pending']));
    state.activePlayerIds = [];
    state.tricksWon = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    state.trick = [];
    state.currentTurnId = state.players[(state.dealerIndex + 1) % state.players.length].id;
    state.leaderId = null;
    state.phase = 'deciding';
  }

  private completeHand(state: BourreGameState, solePlayerId: string | null): DistinctActionResult<BourreResult> {
    const previousPot = state.pot;
    let leaders: string[];
    if (solePlayerId) leaders = [solePlayerId];
    else {
      const high = Math.max(...state.activePlayerIds.map((id) => state.tricksWon[id]));
      leaders = state.activePlayerIds.filter((id) => state.tricksWon[id] === high);
    }
    const bourreIds = state.activePlayerIds.filter((id) => state.tricksWon[id] === 0 && id !== solePlayerId);
    const winnerId = leaders.length === 1 ? leaders[0] : null;
    if (winnerId) state.scores[winnerId] += previousPot;
    state.lastHand = {
      handNumber: state.handNumber,
      winnerId,
      splitIds: winnerId ? [] : [...leaders],
      bourreIds: [...bourreIds],
      pot: previousPot,
    };
    state.pot = this.nextPot(state.players.map((player) => player.id), previousPot, leaders, bourreIds, !!winnerId);
    state.currentTurnId = state.hostId;
    state.leaderId = null;
    if (winnerId && state.scores[winnerId] >= TARGET_SCORE) {
      state.phase = 'finished';
      state.winnerId = winnerId;
      state.finishReason = 'target_score';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'hand_complete';
    return { valid: true };
  }

  private nextPot(
    playerIds: string[],
    previousPot: number,
    leaders: string[],
    bourreIds: string[],
    potWasWon: boolean,
  ): number {
    let pot = potWasWon ? 0 : previousPot;
    for (const playerId of playerIds) {
      if (!potWasWon && leaders.includes(playerId)) continue;
      pot += bourreIds.includes(playerId) ? previousPot : 1;
    }
    return pot;
  }

  private legalCards(state: BourreGameState, playerId: string): StandardCard[] {
    const hand = state.hands[playerId];
    const cinched = this.hasCinch(state, playerId);
    if (state.trick.length === 0) {
      const highestTrump = this.highestTrump(hand, state.trumpSuit);
      return cinched && highestTrump ? [highestTrump] : hand;
    }
    const leadSuit = state.trick[0].card.suit;
    const following = hand.filter((card) => card.suit === leadSuit);
    if (following.length > 0) {
      const winners = following.filter((card) => this.wouldWin(state, card));
      if (cinched && leadSuit === state.trumpSuit) return [this.highestTrump(following, state.trumpSuit)!];
      return winners.length > 0 ? winners : following;
    }
    const trumps = hand.filter((card) => card.suit === state.trumpSuit);
    if (trumps.length > 0) {
      if (cinched) return [this.highestTrump(trumps, state.trumpSuit)!];
      const winners = trumps.filter((card) => this.wouldWin(state, card));
      return winners.length > 0 ? winners : trumps;
    }
    return hand;
  }

  private hasCinch(state: BourreGameState, playerId: string): boolean {
    const needed = 3 - state.tricksWon[playerId];
    if (needed <= 0) return true;
    const heldRanks = state.hands[playerId]
      .filter((card) => card.suit === state.trumpSuit)
      .map((card) => this.rankValue(card))
      .sort((left, right) => left - right);
    if (heldRanks.length < needed) return false;
    const missingRanks = RANKS
      .map((_, index) => index + 2)
      .filter((rank) => !heldRanks.includes(rank))
      .sort((left, right) => left - right);
    let losses = 0;
    let missingIndex = 0;
    for (const heldRank of heldRanks) {
      while (missingIndex < missingRanks.length && missingRanks[missingIndex] <= heldRank) missingIndex += 1;
      if (missingIndex < missingRanks.length) {
        losses += 1;
        missingIndex += 1;
      }
    }
    return heldRanks.length - losses >= needed;
  }

  private highestTrump(cards: StandardCard[], trumpSuit: CardSuit): StandardCard | null {
    return cards.filter((card) => card.suit === trumpSuit).sort((left, right) => this.rankValue(right) - this.rankValue(left))[0] ?? null;
  }

  private wouldWin(state: BourreGameState, card: StandardCard): boolean {
    return this.trickWinner(state, [...state.trick, { playerId: '__candidate__', card }]) === '__candidate__';
  }

  private trickWinner(state: BourreGameState, trick: BourreGameState['trick']): string {
    const leadSuit = trick[0].card.suit;
    const contenders = trick.some((entry) => entry.card.suit === state.trumpSuit)
      ? trick.filter((entry) => entry.card.suit === state.trumpSuit)
      : trick.filter((entry) => entry.card.suit === leadSuit);
    return contenders.slice(1).reduce((highest, entry) =>
      this.rankValue(entry.card) > this.rankValue(highest.card) ? entry : highest,
    contenders[0]).playerId;
  }

  private dealerMustStay(state: BourreGameState, playerId: string): boolean {
    const dealerId = state.players[state.dealerIndex].id;
    return playerId === dealerId
      && (state.trumpCard.rank === 'A' || state.activePlayerIds.length === 0);
  }

  private drawReplacement(state: BourreGameState): StandardCard {
    if (state.stock.length === 0) {
      if (state.recyclePool.length === 0) throw new Error('Bourré replacement stock exhausted');
      state.stock = this.shuffleCards(state.recyclePool);
      state.recyclePool = [];
    }
    return state.stock.shift()!;
  }

  private nextPendingDecision(state: BourreGameState, playerId: string): string | null {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(index + offset) % state.players.length].id;
      if (state.decisions[candidate] === 'pending') return candidate;
    }
    return null;
  }

  private firstActiveLeftOfDealer(state: BourreGameState): string {
    const dealerId = state.players[state.dealerIndex].id;
    return this.nextActiveId(state, dealerId);
  }

  private nextActiveId(state: BourreGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(index + offset) % state.players.length].id;
      if (state.activePlayerIds.includes(candidate)) return candidate;
    }
    return state.activePlayerIds[0];
  }

  private rankValue(card: StandardCard): number {
    return RANKS.indexOf(card.rank as typeof RANKS[number]) + 2;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Bourré requires two to seven distinct players');
    }
  }
}
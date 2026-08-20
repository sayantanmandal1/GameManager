import type {
  OhHellAction,
  OhHellGameState,
  OhHellPlayerView,
  OhHellResult,
  StandardCard,
} from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const HAND_SCHEDULE = [7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export class OhHellEngine implements DistinctGameAdapter<OhHellGameState, OhHellAction, OhHellPlayerView, OhHellResult> {
  readonly key = 'oh-hell' as const;
  readonly rulesetId = 'oh-hell.contract-whist-7-1-7.v1';
  readonly minPlayers = 3;
  readonly maxPlayers = 7;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): OhHellGameState {
    this.requirePlayers(playerIds);
    const state: OhHellGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0], hands: {}, dealerIndex: 0, dealNumber: 0, handSize: HAND_SCHEDULE[0],
      trumpCard: { id: 'c-clubs-2', suit: 'clubs', rank: '2' }, trumpSuit: 'clubs',
      bids: {}, tricksWon: {}, scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      trick: [], currentTurnId: playerIds[1], leaderId: playerIds[1], lastDeal: null,
      phase: 'bidding', winnerId: null, isDraw: false, finishReason: null,
    };
    this.deal(state);
    return state;
  }

  applyAction(state: OhHellGameState, playerId: string, action: OhHellAction): DistinctActionResult<OhHellResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'deal_complete') return this.nextDeal(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.phase === 'bidding') return this.bid(state, playerId, action);
    return this.playCard(state, playerId, action);
  }

  getPlayerView(state: OhHellGameState, playerId: string): OhHellPlayerView {
    const canAct = state.phase === 'deal_complete'
      ? playerId === state.hostId
      : state.currentTurnId === playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, handCount: state.hands[player.id].length, bid: state.bids[player.id],
        tricksWon: state.tricksWon[player.id], score: state.scores[player.id],
      })),
      hostId: state.hostId, youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      dealerId: state.players[state.dealerIndex].id, dealNumber: state.dealNumber, handSize: state.handSize,
      trumpCard: { ...state.trumpCard }, trumpSuit: state.trumpSuit,
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      currentTurnId: state.currentTurnId, leaderId: state.leaderId,
      lastDeal: state.lastDeal ? {
        ...state.lastDeal, bids: { ...state.lastDeal.bids }, tricks: { ...state.lastDeal.tricks }, points: { ...state.lastDeal.points },
      } : null,
      phase: state.phase, winnerId: state.winnerId, isDraw: state.isDraw, canAct,
      legalBids: state.phase === 'bidding' && canAct ? this.legalBids(state, playerId) : [],
      legalCardIds: state.phase === 'playing' && canAct ? this.legalCards(state, playerId).map((card) => card.id) : [],
    };
  }

  surrender(state: OhHellGameState, playerId: string): DistinctActionResult<OhHellResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const high = Math.max(...remaining.map((player) => state.scores[player.id]));
    const leaders = remaining.filter((player) => state.scores[player.id] === high);
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: OhHellGameState): OhHellResult {
    if (!state.finishReason) throw new Error('Oh Hell session is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores } };
  }

  private bid(state: OhHellGameState, playerId: string, action: OhHellAction): DistinctActionResult<OhHellResult> {
    if (!hasExactActionShape(action, 'bid_oh_hell', ['bid']) || !isBoundedInteger(action.bid, 0, state.handSize)) {
      return { valid: false, reason: 'Invalid bid' };
    }
    if (!this.legalBids(state, playerId).includes(action.bid)) return { valid: false, reason: 'Dealer bid cannot make the total equal available tricks' };
    state.bids[playerId] = action.bid;
    const next = this.nextUnbidPlayer(state, playerId);
    if (next) {
      state.currentTurnId = next;
      return { valid: true };
    }
    state.phase = 'playing';
    state.currentTurnId = state.players[(state.dealerIndex + 1) % state.players.length].id;
    state.leaderId = state.currentTurnId;
    return { valid: true };
  }

  private playCard(state: OhHellGameState, playerId: string, action: OhHellAction): DistinctActionResult<OhHellResult> {
    if (!hasExactActionShape(action, 'play_oh_hell_card', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid play' };
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!this.legalCards(state, playerId).some((entry) => entry.id === card.id)) return { valid: false, reason: 'Must follow suit' };
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId, card });
    if (state.trick.length < state.players.length) {
      state.currentTurnId = this.nextPlayerId(state, playerId);
      return { valid: true };
    }
    const winnerId = this.trickWinner(state);
    state.tricksWon[winnerId] += 1; state.trick = [];
    state.currentTurnId = winnerId; state.leaderId = winnerId;
    if (state.players.some((player) => state.hands[player.id].length > 0)) return { valid: true };
    return this.completeDeal(state);
  }

  private nextDeal(state: OhHellGameState, playerId: string, action: OhHellAction): DistinctActionResult<OhHellResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next deal' };
    if (!hasExactActionShape(action, 'next_oh_hell_deal', [])) return { valid: false, reason: 'Invalid action' };
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    this.deal(state);
    return { valid: true };
  }

  private deal(state: OhHellGameState): void {
    state.dealNumber += 1;
    state.handSize = HAND_SCHEDULE[state.dealNumber - 1];
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    for (let count = 0; count < state.handSize; count += 1) {
      for (let offset = 1; offset <= state.players.length; offset += 1) {
        state.hands[state.players[(state.dealerIndex + offset) % state.players.length].id].push(deck.shift()!);
      }
    }
    state.trumpCard = { ...deck.shift()! }; state.trumpSuit = state.trumpCard.suit;
    state.bids = Object.fromEntries(state.players.map((player) => [player.id, null]));
    state.tricksWon = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    state.trick = []; state.currentTurnId = state.players[(state.dealerIndex + 1) % state.players.length].id;
    state.leaderId = state.currentTurnId; state.phase = 'bidding';
  }

  private completeDeal(state: OhHellGameState): DistinctActionResult<OhHellResult> {
    const points = Object.fromEntries(state.players.map((player) => {
      const tricks = state.tricksWon[player.id];
      return [player.id, tricks + (tricks === state.bids[player.id] ? 10 : 0)];
    }));
    for (const player of state.players) state.scores[player.id] += points[player.id];
    state.lastDeal = {
      dealNumber: state.dealNumber, handSize: state.handSize,
      bids: Object.fromEntries(state.players.map((player) => [player.id, state.bids[player.id]!])),
      tricks: { ...state.tricksWon }, points,
    };
    if (state.dealNumber === HAND_SCHEDULE.length) {
      const high = Math.max(...Object.values(state.scores));
      const leaders = state.players.filter((player) => state.scores[player.id] === high);
      state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
      state.phase = 'finished'; state.finishReason = 'schedule_complete';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'deal_complete'; state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private legalBids(state: OhHellGameState, playerId: string): number[] {
    const bids = Array.from({ length: state.handSize + 1 }, (_, index) => index);
    const dealerId = state.players[state.dealerIndex].id;
    if (playerId !== dealerId || state.players.some((player) => player.id !== dealerId && state.bids[player.id] === null)) return bids;
    const priorTotal = state.players.reduce((sum, player) => sum + (state.bids[player.id] ?? 0), 0);
    return bids.filter((bid) => priorTotal + bid !== state.handSize);
  }

  private legalCards(state: OhHellGameState, playerId: string): StandardCard[] {
    const hand = state.hands[playerId];
    if (state.trick.length === 0) return hand;
    const following = hand.filter((card) => card.suit === state.trick[0].card.suit);
    return following.length > 0 ? following : hand;
  }

  private trickWinner(state: OhHellGameState): string {
    const leadSuit = state.trick[0].card.suit;
    const contenders = state.trick.some((entry) => entry.card.suit === state.trumpSuit)
      ? state.trick.filter((entry) => entry.card.suit === state.trumpSuit)
      : state.trick.filter((entry) => entry.card.suit === leadSuit);
    return contenders.slice(1).reduce((highest, entry) => this.rankValue(entry.card) > this.rankValue(highest.card) ? entry : highest, contenders[0]).playerId;
  }

  private nextUnbidPlayer(state: OhHellGameState, playerId: string): string | null {
    let candidate = this.nextPlayerId(state, playerId);
    for (let count = 0; count < state.players.length; count += 1) {
      if (state.bids[candidate] === null) return candidate;
      candidate = this.nextPlayerId(state, candidate);
    }
    return null;
  }
  private rankValue(card: StandardCard): number { return RANKS.indexOf(card.rank as typeof RANKS[number]) + 2; }
  private nextPlayerId(state: OhHellGameState, playerId: string): string { const index = state.players.findIndex((player) => player.id === playerId); return state.players[(index + 1) % state.players.length].id; }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) throw new Error('Oh Hell requires three to seven distinct players'); }
}
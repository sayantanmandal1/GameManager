import type {
  CardRank,
  CardSuit,
  SevensAction,
  SevensGameState,
  SevensPlayerView,
  SevensResult,
  StandardCard,
} from '../../../shared';
import { CARD_SUITS } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TARGET_SCORE = 100;

export class SevensEngine implements DistinctGameAdapter<SevensGameState, SevensAction, SevensPlayerView, SevensResult> {
  readonly key = 'sevens' as const;
  readonly rulesetId = 'sevens.hearts-seven-mandatory-100.v1';
  readonly minPlayers = 3;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): SevensGameState {
    this.requirePlayers(playerIds);
    const state: SevensGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0],
      hands: {},
      layout: this.emptyLayout(),
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      currentTurnId: playerIds[0],
      dealerIndex: 0,
      roundNumber: 0,
      lastRound: null,
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
    this.dealRound(state);
    return state;
  }

  applyAction(state: SevensGameState, playerId: string, action: SevensAction): DistinctActionResult<SevensResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'round_complete') return this.nextRound(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    const legalCards = this.legalCards(state, playerId);
    if (action.type === 'pass_sevens') {
      if (!hasExactActionShape(action, 'pass_sevens', [])) return { valid: false, reason: 'Invalid pass' };
      if (legalCards.length > 0) return { valid: false, reason: 'A legal card must be played' };
      state.currentTurnId = this.nextPlayerId(state, playerId);
      return { valid: true };
    }
    if (!hasExactActionShape(action, 'play_sevens_card', ['cardId']) || typeof action.cardId !== 'string') {
      return { valid: false, reason: 'Invalid play' };
    }
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!legalCards.some((entry) => entry.id === card.id)) return { valid: false, reason: 'Card is not adjacent to the layout' };
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    this.addToLayout(state, card);
    if (state.hands[playerId].length === 0) return this.completeRound(state, playerId);
    state.currentTurnId = this.nextPlayerId(state, playerId);
    return { valid: true };
  }

  getPlayerView(state: SevensGameState, playerId: string): SevensPlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId;
    const legalCardIds = canAct ? this.legalCards(state, playerId).map((card) => card.id) : [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length, score: state.scores[player.id] })),
      hostId: state.hostId,
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      layout: Object.fromEntries(CARD_SUITS.map((suit) => [suit, { ...state.layout[suit] }])) as SevensPlayerView['layout'],
      currentTurnId: state.currentTurnId,
      dealerId: state.players[state.dealerIndex].id,
      roundNumber: state.roundNumber,
      lastRound: state.lastRound ? { ...state.lastRound, handPoints: { ...state.lastRound.handPoints } } : null,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct,
      legalCardIds,
      canPass: canAct && legalCardIds.length === 0,
    };
  }

  surrender(state: SevensGameState, playerId: string): DistinctActionResult<SevensResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    state.winnerId = remaining.sort((left, right) => state.scores[right.id] - state.scores[left.id])[0].id;
    state.phase = 'finished';
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: SevensGameState): SevensResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Sevens session is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason, scores: { ...state.scores } };
  }

  private nextRound(state: SevensGameState, playerId: string, action: SevensAction): DistinctActionResult<SevensResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next round' };
    if (!hasExactActionShape(action, 'next_sevens_round', [])) return { valid: false, reason: 'Invalid action' };
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    this.dealRound(state);
    return { valid: true };
  }

  private dealRound(state: SevensGameState): void {
    state.roundNumber += 1;
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    const deck = this.shuffleCards(createStandardDeck());
    deck.forEach((card, index) => state.hands[state.players[(state.dealerIndex + 1 + index) % state.players.length].id].push(card));
    state.layout = this.emptyLayout();
    state.currentTurnId = state.players.find((player) => state.hands[player.id].some((card) => card.id === 'c-hearts-7'))!.id;
    state.phase = 'playing';
  }

  private completeRound(state: SevensGameState, winnerId: string): DistinctActionResult<SevensResult> {
    const handPoints = Object.fromEntries(state.players.map((player) => [
      player.id,
      state.hands[player.id].reduce((sum, card) => sum + this.cardValue(card.rank), 0),
    ]));
    const points = Object.entries(handPoints).filter(([id]) => id !== winnerId).reduce((sum, [, value]) => sum + value, 0);
    state.scores[winnerId] += points;
    state.lastRound = { roundNumber: state.roundNumber, winnerId, points, handPoints };
    if (state.scores[winnerId] >= TARGET_SCORE) {
      state.phase = 'finished';
      state.winnerId = winnerId;
      state.finishReason = 'target_score';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'round_complete';
    state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private legalCards(state: SevensGameState, playerId: string): StandardCard[] {
    if (CARD_SUITS.every((suit) => state.layout[suit].low === null)) {
      return state.hands[playerId].filter((card) => card.id === 'c-hearts-7');
    }
    return state.hands[playerId].filter((card) => {
      const suit = state.layout[card.suit];
      if (!suit.low || !suit.high) return card.rank === '7';
      const rank = RANKS.indexOf(card.rank);
      return rank === RANKS.indexOf(suit.low) - 1 || rank === RANKS.indexOf(suit.high) + 1;
    });
  }

  private addToLayout(state: SevensGameState, card: StandardCard): void {
    const suit = state.layout[card.suit];
    if (card.rank === '7') {
      suit.low = '7';
      suit.high = '7';
    } else if (RANKS.indexOf(card.rank) < RANKS.indexOf(suit.low!)) suit.low = card.rank;
    else suit.high = card.rank;
  }

  private emptyLayout(): Record<CardSuit, { low: CardRank | null; high: CardRank | null }> {
    return Object.fromEntries(CARD_SUITS.map((suit) => [suit, { low: null, high: null }])) as Record<CardSuit, { low: CardRank | null; high: CardRank | null }>;
  }

  private cardValue(rank: CardRank): number {
    if (rank === 'A') return 1;
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
    return Number(rank);
  }

  private nextPlayerId(state: SevensGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    return state.players[(index + 1) % state.players.length].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Sevens requires three to eight distinct players');
    }
  }
}
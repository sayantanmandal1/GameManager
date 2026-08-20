import {
  CARD_RANKS,
  CardRank,
  GoFishAction,
  GoFishGameState,
  GoFishPlayerView,
  GoFishResult,
  StandardCard,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class GoFishEngine
  implements DistinctGameAdapter<GoFishGameState, GoFishAction, GoFishPlayerView, GoFishResult>
{
  readonly key = 'go-fish' as const;
  readonly rulesetId = 'go-fish.standard-52-card.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 5;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): GoFishGameState {
    this.requirePlayers(playerIds);
    const players = playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` }));
    const hands = Object.fromEntries(playerIds.map((id) => [id, [] as StandardCard[]]));
    const books = Object.fromEntries(playerIds.map((id) => [id, [] as CardRank[]]));
    const deck = this.shuffleCards(createStandardDeck());
    const dealCount = playerIds.length === 2 ? 7 : 5;
    for (let cardIndex = 0; cardIndex < dealCount; cardIndex += 1) {
      for (const player of players) hands[player.id].push(deck.pop()!);
    }
    const state: GoFishGameState = {
      players,
      hands,
      books,
      deck,
      currentTurnId: playerIds[0],
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
      lastEvent: 'Cards dealt',
    };
    for (const player of players) this.collectBooks(state, player.id);
    return state;
  }

  applyAction(
    state: GoFishGameState,
    playerId: string,
    action: GoFishAction,
  ): DistinctActionResult<GoFishResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || action.type !== 'ask' || typeof action.targetPlayerId !== 'string' || !CARD_RANKS.includes(action.rank as CardRank)) {
      return { valid: false, reason: 'Invalid ask' };
    }
    const target = state.players.find((player) => player.id === action.targetPlayerId);
    if (!target || target.id === playerId) return { valid: false, reason: 'Invalid target' };
    if (!state.hands[playerId].some((card) => card.rank === action.rank)) {
      return { valid: false, reason: 'You must hold the requested rank' };
    }

    const matches = state.hands[target.id].filter((card) => card.rank === action.rank);
    if (matches.length > 0) {
      state.hands[target.id] = state.hands[target.id].filter((card) => card.rank !== action.rank);
      state.hands[playerId].push(...matches);
      state.lastEvent = `${matches.length} ${action.rank} card${matches.length === 1 ? '' : 's'} transferred`;
      this.collectBooks(state, playerId);
      this.refillEmptyHand(state, target.id);
      if (this.finishIfExhausted(state)) return { valid: true, result: this.getResult(state) };
      if (state.hands[playerId].length === 0) this.refillEmptyHand(state, playerId);
      if (state.hands[playerId].length === 0) this.advanceTurn(state, playerId);
      return { valid: true };
    }

    const drawn = state.deck.pop();
    if (drawn) {
      state.hands[playerId].push(drawn);
      state.lastEvent = 'Go fish: one card drawn';
      this.collectBooks(state, playerId);
    } else {
      state.lastEvent = 'Go fish: the deck is empty';
    }
    this.refillEmptyHand(state, target.id);
    if (this.finishIfExhausted(state)) return { valid: true, result: this.getResult(state) };
    if (!drawn || drawn.rank !== action.rank) this.advanceTurn(state, playerId);
    return { valid: true };
  }

  getPlayerView(state: GoFishGameState, playerId: string): GoFishPlayerView {
    const hand = state.hands[playerId] ?? [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        handCount: state.hands[player.id].length,
        books: [...state.books[player.id]],
      })),
      youId: playerId,
      yourHand: hand.map((card) => ({ ...card })),
      deckCount: state.deck.length,
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase === 'playing' && state.currentTurnId === playerId && hand.length > 0,
      legalTargets: state.currentTurnId === playerId ? state.players.filter((player) => player.id !== playerId && state.hands[player.id].length > 0).map((player) => player.id) : [],
      legalRanks: state.currentTurnId === playerId ? [...new Set(hand.map((card) => card.rank))] : [],
      lastEvent: state.lastEvent,
    };
  }

  surrender(state: GoFishGameState, playerId: string): DistinctActionResult<GoFishResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: GoFishGameState): GoFishResult {
    if (!state.finishReason) throw new Error('Go Fish game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: Object.fromEntries(state.players.map((player) => [player.id, state.books[player.id].length])),
    };
  }

  private collectBooks(state: GoFishGameState, playerId: string): void {
    for (const rank of CARD_RANKS) {
      if (state.hands[playerId].filter((card) => card.rank === rank).length !== 4) continue;
      state.hands[playerId] = state.hands[playerId].filter((card) => card.rank !== rank);
      if (!state.books[playerId].includes(rank)) state.books[playerId].push(rank);
    }
  }

  private refillEmptyHand(state: GoFishGameState, playerId: string): void {
    if (state.hands[playerId].length > 0 || state.deck.length === 0) return;
    const refillCount = Math.min(state.players.length === 2 ? 7 : 5, state.deck.length);
    for (let index = 0; index < refillCount; index += 1) state.hands[playerId].push(state.deck.pop()!);
  }

  private advanceTurn(state: GoFishGameState, playerId: string): void {
    const start = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(start + offset) % state.players.length];
      this.refillEmptyHand(state, candidate.id);
      if (state.hands[candidate.id].length > 0) {
        state.currentTurnId = candidate.id;
        return;
      }
    }
  }

  private finishIfExhausted(state: GoFishGameState): boolean {
    if (state.deck.length > 0 || state.players.some((player) => state.hands[player.id].length > 0)) return false;
    const scores = state.players.map((player) => ({ id: player.id, score: state.books[player.id].length }));
    const highScore = Math.max(...scores.map((score) => score.score));
    const leaders = scores.filter((score) => score.score === highScore);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'all_books';
    return true;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Go Fish requires two to five distinct players');
    }
  }
}
import type { CardRank, PresidentAction, PresidentGameState, PresidentPlayerView, PresidentResult, StandardCard } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const PRESIDENT_RANKS: CardRank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const ROUNDS = 8;

export class PresidentEngine implements DistinctGameAdapter<PresidentGameState, PresidentAction, PresidentPlayerView, PresidentResult> {
  readonly key = 'president' as const;
  readonly rulesetId = 'president.basic-eight-round.v1';
  readonly minPlayers = 3;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): PresidentGameState {
    this.requirePlayers(playerIds);
    const state: PresidentGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0], hands: {}, dealerIndex: 0, roundNumber: 0, currentTurnId: playerIds[0],
      activePlayerIds: [...playerIds], pilePlay: null, passedSincePlay: [], ranking: [], previousRanking: [],
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])), exchangeFromId: null, lastRound: null,
      phase: 'playing', winnerId: null, isDraw: false, finishReason: null,
    };
    this.dealRound(state);
    return state;
  }

  applyAction(state: PresidentGameState, playerId: string, action: PresidentAction): DistinctActionResult<PresidentResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'round_complete') return this.nextRound(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.phase === 'exchange') return this.returnCard(state, playerId, action);
    if (action.type === 'pass_president') return this.pass(state, playerId, action);
    return this.play(state, playerId, action);
  }

  getPlayerView(state: PresidentGameState, playerId: string): PresidentPlayerView {
    const canAct = state.phase === 'round_complete' ? playerId === state.hostId : state.currentTurnId === playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, handCount: state.hands[player.id].length, score: state.scores[player.id],
        finishPlace: state.ranking.includes(player.id) ? state.ranking.indexOf(player.id) + 1 : null,
      })),
      hostId: state.hostId, youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      roundNumber: state.roundNumber, currentTurnId: state.currentTurnId,
      pilePlay: state.pilePlay ? { ...state.pilePlay, cards: state.pilePlay.cards.map((card) => ({ ...card })) } : null,
      ranking: [...state.ranking], previousRanking: [...state.previousRanking],
      lastRound: state.lastRound ? { ...state.lastRound, ranking: [...state.lastRound.ranking], points: { ...state.lastRound.points } } : null,
      phase: state.phase, winnerId: state.winnerId, isDraw: state.isDraw, canAct,
      legalPlays: state.phase === 'playing' && canAct ? this.legalPlays(state, playerId) : [],
      canPass: state.phase === 'playing' && canAct && state.pilePlay !== null,
      canReturn: state.phase === 'exchange' && canAct,
    };
  }

  surrender(state: PresidentGameState, playerId: string): DistinctActionResult<PresidentResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const high = Math.max(...remaining.map((player) => state.scores[player.id]));
    const leaders = remaining.filter((player) => state.scores[player.id] === high);
    state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: PresidentGameState): PresidentResult {
    if (!state.finishReason) throw new Error('President session is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores }, lastRanking: [...state.previousRanking] };
  }

  private play(state: PresidentGameState, playerId: string, action: PresidentAction): DistinctActionResult<PresidentResult> {
    if (!hasExactActionShape(action, 'play_president_cards', ['cardIds'])
      || !Array.isArray(action.cardIds) || action.cardIds.length < 1 || action.cardIds.length > 4
      || new Set(action.cardIds).size !== action.cardIds.length || !action.cardIds.every((id) => typeof id === 'string')) {
      return { valid: false, reason: 'Invalid play' };
    }
    const cards = action.cardIds.map((id) => state.hands[playerId].find((card) => card.id === id));
    if (cards.some((card) => !card)) return { valid: false, reason: 'Card not in hand' };
    const played = cards as StandardCard[];
    if (!played.every((card) => card.rank === played[0].rank)) return { valid: false, reason: 'Cards must share one rank' };
    if (!this.canBeat(state, played[0].rank, played.length)) return { valid: false, reason: 'Play must match the count and beat the rank' };
    state.hands[playerId] = state.hands[playerId].filter((card) => !action.cardIds.includes(card.id));
    state.pilePlay = { playerId, rank: played[0].rank, count: played.length, cards: played.map((card) => ({ ...card })) };
    state.passedSincePlay = [];
    if (state.hands[playerId].length === 0) {
      state.ranking.push(playerId);
      state.activePlayerIds = state.activePlayerIds.filter((id) => id !== playerId);
      if (state.activePlayerIds.length === 1) return this.completeRound(state);
    }
    state.currentTurnId = this.nextActiveId(state, playerId);
    return { valid: true };
  }

  private pass(state: PresidentGameState, playerId: string, action: PresidentAction): DistinctActionResult<PresidentResult> {
    if (!hasExactActionShape(action, 'pass_president', [])) return { valid: false, reason: 'Invalid pass' };
    if (!state.pilePlay) return { valid: false, reason: 'Cannot pass an open lead' };
    if (!state.passedSincePlay.includes(playerId)) state.passedSincePlay.push(playerId);
    const requiredPassers = state.activePlayerIds.filter((id) => id !== state.pilePlay!.playerId);
    if (requiredPassers.every((id) => state.passedSincePlay.includes(id))) {
      const lastPlayerId = state.pilePlay.playerId;
      state.pilePlay = null; state.passedSincePlay = [];
      state.currentTurnId = state.activePlayerIds.includes(lastPlayerId) ? lastPlayerId : this.nextActiveId(state, lastPlayerId);
      return { valid: true };
    }
    state.currentTurnId = this.nextActiveId(state, playerId);
    return { valid: true };
  }

  private returnCard(state: PresidentGameState, playerId: string, action: PresidentAction): DistinctActionResult<PresidentResult> {
    if (!hasExactActionShape(action, 'return_president_card', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid return' };
    const index = state.hands[playerId].findIndex((card) => card.id === action.cardId);
    if (index < 0) return { valid: false, reason: 'Card not in hand' };
    const [returned] = state.hands[playerId].splice(index, 1);
    state.hands[state.exchangeFromId!].push(returned);
    state.exchangeFromId = null; state.phase = 'playing';
    state.currentTurnId = state.previousRanking[0];
    return { valid: true };
  }

  private nextRound(state: PresidentGameState, playerId: string, action: PresidentAction): DistinctActionResult<PresidentResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next round' };
    if (!hasExactActionShape(action, 'next_president_round', [])) return { valid: false, reason: 'Invalid action' };
    this.dealRound(state);
    return { valid: true };
  }

  private dealRound(state: PresidentGameState): void {
    state.roundNumber += 1;
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    deck.forEach((card, index) => state.hands[state.players[index % state.players.length].id].push(card));
    state.activePlayerIds = state.players.map((player) => player.id); state.pilePlay = null;
    state.passedSincePlay = []; state.ranking = []; state.exchangeFromId = null;
    if (state.previousRanking.length === 0) {
      state.currentTurnId = state.players.find((player) => state.hands[player.id].some((card) => card.id === 'c-clubs-3'))!.id;
      state.phase = 'playing';
      return;
    }
    const presidentId = state.previousRanking[0];
    const lastId = state.previousRanking[state.previousRanking.length - 1];
    const best = [...state.hands[lastId]].sort((left, right) => this.rankValue(right.rank) - this.rankValue(left.rank))[0];
    state.hands[lastId] = state.hands[lastId].filter((card) => card.id !== best.id);
    state.hands[presidentId].push(best); state.exchangeFromId = lastId;
    state.currentTurnId = presidentId; state.phase = 'exchange';
  }

  private completeRound(state: PresidentGameState): DistinctActionResult<PresidentResult> {
    state.ranking.push(state.activePlayerIds[0]);
    const points = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    points[state.ranking[0]] = 2;
    if (state.ranking[1]) points[state.ranking[1]] = 1;
    for (const player of state.players) state.scores[player.id] += points[player.id];
    state.previousRanking = [...state.ranking];
    state.lastRound = { roundNumber: state.roundNumber, ranking: [...state.ranking], points };
    if (state.roundNumber >= ROUNDS) {
      const high = Math.max(...Object.values(state.scores));
      const leaders = state.players.filter((player) => state.scores[player.id] === high);
      state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
      state.phase = 'finished'; state.finishReason = 'eight_rounds';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'round_complete'; state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private legalPlays(state: PresidentGameState, playerId: string): Array<{ rank: CardRank; cardIds: string[] }> {
    const byRank = new Map<CardRank, StandardCard[]>();
    for (const card of state.hands[playerId]) byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
    const required = state.pilePlay?.count ?? null;
    const plays: Array<{ rank: CardRank; cardIds: string[] }> = [];
    for (const [rank, cards] of byRank) {
      const counts = required === null ? Array.from({ length: cards.length }, (_, index) => index + 1) : [required];
      for (const count of counts) if (cards.length >= count && this.canBeat(state, rank, count)) plays.push({ rank, cardIds: cards.slice(0, count).map((card) => card.id) });
    }
    return plays;
  }

  private canBeat(state: PresidentGameState, rank: CardRank, count: number): boolean {
    if (!state.pilePlay) return true;
    return count === state.pilePlay.count && this.rankValue(rank) > this.rankValue(state.pilePlay.rank);
  }

  private rankValue(rank: CardRank): number { return PRESIDENT_RANKS.indexOf(rank); }
  private nextActiveId(state: PresidentGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(index + offset) % state.players.length].id;
      if (state.activePlayerIds.includes(candidate)) return candidate;
    }
    return state.activePlayerIds[0];
  }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) throw new Error('President requires three to eight distinct players'); }
}
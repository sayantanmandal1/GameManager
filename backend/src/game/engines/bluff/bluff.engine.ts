import type {
  BluffAction,
  BluffGameState,
  BluffPlayerView,
  BluffResult,
  CardRank,
  StandardCard,
} from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const RANK_SEQUENCE: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class BluffEngine implements DistinctGameAdapter<BluffGameState, BluffAction, BluffPlayerView, BluffResult> {
  readonly key = 'bluff' as const;
  readonly rulesetId = 'bluff.i-doubt-it-forced-ranks.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): BluffGameState {
    this.requirePlayers(playerIds);
    const hands = Object.fromEntries(playerIds.map((id) => [id, [] as StandardCard[]]));
    this.shuffleCards(createStandardDeck()).forEach((card, index) => hands[playerIds[index % playerIds.length]].push(card));
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hands,
      pile: [],
      currentTurnId: playerIds[0],
      claimRank: 'A',
      pendingClaim: null,
      lastReveal: null,
      phase: 'claiming',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: BluffGameState, playerId: string, action: BluffAction): DistinctActionResult<BluffResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'claiming') return this.playClaim(state, playerId, action);
    return this.resolveChallengeWindow(state, playerId, action);
  }

  getPlayerView(state: BluffGameState, playerId: string): BluffPlayerView {
    const pending = state.pendingClaim;
    const canClaim = state.phase === 'claiming' && state.currentTurnId === playerId;
    const canAccept = state.phase === 'challenge' && state.currentTurnId === playerId;
    const canChallenge = state.phase === 'challenge' && pending?.playerId !== playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length })),
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      pileCount: state.pile.length,
      currentTurnId: state.currentTurnId,
      claimRank: state.claimRank,
      pendingClaim: pending ? { playerId: pending.playerId, count: pending.count, rank: state.claimRank } : null,
      lastReveal: state.lastReveal ? {
        ...state.lastReveal,
        cards: state.lastReveal.cards.map((card) => ({ ...card })),
      } : null,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct: canClaim || canAccept || canChallenge,
      canClaim,
      canAccept,
      canChallenge,
    };
  }

  surrender(state: BluffGameState, playerId: string): DistinctActionResult<BluffResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.phase = 'finished';
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: BluffGameState): BluffResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Bluff game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason };
  }

  private playClaim(state: BluffGameState, playerId: string, action: BluffAction): DistinctActionResult<BluffResult> {
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'bluff_play', ['cardIds'])
      || !Array.isArray(action.cardIds)
      || action.cardIds.length < 1
      || action.cardIds.length > 4
      || new Set(action.cardIds).size !== action.cardIds.length
      || !action.cardIds.every((id) => typeof id === 'string')) {
      return { valid: false, reason: 'A claim must contain one to four distinct cards' };
    }
    const cards = action.cardIds.map((id) => state.hands[playerId].find((card) => card.id === id));
    if (cards.some((card) => !card)) return { valid: false, reason: 'Card not in hand' };
    const claimedCards = cards as StandardCard[];
    state.hands[playerId] = state.hands[playerId].filter((card) => !action.cardIds.includes(card.id));
    state.pile.push(...claimedCards);
    state.pendingClaim = { playerId, cardIds: [...action.cardIds], count: claimedCards.length };
    state.lastReveal = null;
    state.currentTurnId = this.nextPlayerId(state, playerId);
    state.phase = 'challenge';
    return { valid: true };
  }

  private resolveChallengeWindow(
    state: BluffGameState,
    playerId: string,
    action: BluffAction,
  ): DistinctActionResult<BluffResult> {
    const pending = state.pendingClaim!;
    if (action.type === 'bluff_accept') {
      if (!hasExactActionShape(action, 'bluff_accept', [])) return { valid: false, reason: 'Invalid acceptance' };
      if (state.currentTurnId !== playerId) return { valid: false, reason: 'Only the next player can accept the claim' };
      if (state.hands[pending.playerId].length === 0) return this.finishWinner(state, pending.playerId);
      this.advanceAfterClaim(state);
      return { valid: true };
    }
    if (!hasExactActionShape(action, 'bluff_challenge', [])) return { valid: false, reason: 'Invalid challenge' };
    if (pending.playerId === playerId) return { valid: false, reason: 'A claimant cannot challenge their own play' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const cards = state.pile.slice(-pending.count);
    const truthful = cards.every((card) => card.rank === state.claimRank);
    const collectorId = truthful ? playerId : pending.playerId;
    state.hands[collectorId].push(...state.pile);
    state.pile = [];
    state.lastReveal = {
      claimantId: pending.playerId,
      challengerId: playerId,
      cards: cards.map((card) => ({ ...card })),
      truthful,
      collectorId,
    };
    if (truthful && state.hands[pending.playerId].length === 0) return this.finishWinner(state, pending.playerId);
    this.advanceAfterClaim(state);
    return { valid: true };
  }

  private advanceAfterClaim(state: BluffGameState): void {
    state.pendingClaim = null;
    state.claimRank = RANK_SEQUENCE[(RANK_SEQUENCE.indexOf(state.claimRank) + 1) % RANK_SEQUENCE.length];
    state.phase = 'claiming';
  }

  private finishWinner(state: BluffGameState, winnerId: string): DistinctActionResult<BluffResult> {
    state.pendingClaim = null;
    state.phase = 'finished';
    state.winnerId = winnerId;
    state.finishReason = 'empty_hand';
    return { valid: true, result: this.getResult(state) };
  }

  private nextPlayerId(state: BluffGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    return state.players[(index + 1) % state.players.length].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Bluff requires two to eight distinct players');
    }
  }
}
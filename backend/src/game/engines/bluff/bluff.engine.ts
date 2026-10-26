import type {
  BluffAction,
  BluffGameState,
  BluffPlayerView,
  BluffResult,
  StandardCard,
} from '../../../shared';
import { CARD_RANKS, CARD_SUITS } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class BluffEngine implements DistinctGameAdapter<BluffGameState, BluffAction, BluffPlayerView, BluffResult> {
  readonly key = 'bluff' as const;
  readonly rulesetId = 'bluff.chosen-rank-passing.v2';
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
      claimRank: null,
      consecutivePasses: 0,
      discardedCount: 0,
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
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (action.type === 'bluff_challenge') return this.challenge(state, playerId, action);
    if (state.phase === 'challenge') return this.acceptFinalClaim(state, playerId, action);
    if (action.type === 'bluff_pass') return this.pass(state, playerId, action);
    return this.playClaim(state, playerId, action);
  }

  getPlayerView(state: BluffGameState, playerId: string): BluffPlayerView {
    const pending = state.pendingClaim;
    const seated = state.players.some((player) => player.id === playerId);
    const canClaim = seated && state.phase === 'claiming' && state.currentTurnId === playerId;
    const canPass = canClaim && !!pending;
    const canAccept = seated && state.phase === 'challenge' && state.currentTurnId === playerId;
    const canChallenge = seated && state.phase !== 'finished' && !!pending && pending.playerId !== playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length })),
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })).sort((left, right) =>
        CARD_RANKS.indexOf(left.rank) - CARD_RANKS.indexOf(right.rank)
        || CARD_SUITS.indexOf(left.suit) - CARD_SUITS.indexOf(right.suit)),
      pileCount: state.pile.length,
      currentTurnId: state.currentTurnId,
      claimRank: state.claimRank,
      consecutivePasses: state.consecutivePasses,
      discardedCount: state.discardedCount,
      pendingClaim: pending && state.claimRank ? { playerId: pending.playerId, count: pending.count, rank: state.claimRank } : null,
      lastReveal: state.lastReveal ? {
        ...state.lastReveal,
        cards: state.lastReveal.cards.map((card) => ({ ...card })),
      } : null,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct: canClaim || canAccept || canChallenge,
      canClaim,
      canPass,
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
    if (!hasExactActionShape(action, 'bluff_play', ['cardIds', 'rank'])
      || !Array.isArray(action.cardIds)
      || action.cardIds.length < 1
      || action.cardIds.length > 4
      || new Set(action.cardIds).size !== action.cardIds.length
      || !action.cardIds.every((id) => typeof id === 'string')) {
      return { valid: false, reason: 'A claim must contain one to four distinct cards' };
    }
    if (!CARD_RANKS.includes(action.rank)) return { valid: false, reason: 'Choose a valid rank' };
    if (state.claimRank && action.rank !== state.claimRank) return { valid: false, reason: 'Keep the same rank until the round ends' };
    const cards = action.cardIds.map((id) => state.hands[playerId].find((card) => card.id === id));
    const claimedCards = cards.filter((card): card is StandardCard => !!card);
    if (claimedCards.length !== action.cardIds.length) return { valid: false, reason: 'Card not in hand' };
    state.hands[playerId] = state.hands[playerId].filter((card) => !action.cardIds.includes(card.id));
    state.pile.push(...claimedCards);
    state.pendingClaim = { playerId, cardIds: [...action.cardIds], count: claimedCards.length };
    state.claimRank = action.rank;
    state.consecutivePasses = 0;
    state.lastReveal = null;
    state.currentTurnId = this.nextPlayerId(state, playerId);
    state.phase = state.hands[playerId].length === 0 ? 'challenge' : 'claiming';
    return { valid: true };
  }

  private pass(state: BluffGameState, playerId: string, action: BluffAction): DistinctActionResult<BluffResult> {
    if (!hasExactActionShape(action, 'bluff_pass', [])) return { valid: false, reason: 'Invalid pass' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!state.pendingClaim) return { valid: false, reason: 'Start the round by playing cards' };
    state.consecutivePasses += 1;
    state.currentTurnId = this.nextPlayerId(state, playerId);
    // Include the last claimant's pass: they may add more cards when play circles back.
    if (state.consecutivePasses === state.players.length) {
      state.discardedCount += state.pile.length;
      state.pile = [];
      this.startRound(state, this.nextPlayerId(state, state.pendingClaim.playerId));
    }
    return { valid: true };
  }

  private acceptFinalClaim(state: BluffGameState, playerId: string, action: BluffAction): DistinctActionResult<BluffResult> {
    if (!hasExactActionShape(action, 'bluff_accept', [])) return { valid: false, reason: 'Accept or challenge the final claim' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Only the next player can accept the claim' };
    state.consecutivePasses += 1;
    if (state.consecutivePasses === state.players.length - 1) return this.finishWinner(state, state.pendingClaim!.playerId);
    state.currentTurnId = this.nextPlayerId(state, playerId);
    return { valid: true };
  }

  private challenge(
    state: BluffGameState,
    playerId: string,
    action: BluffAction,
  ): DistinctActionResult<BluffResult> {
    if (!hasExactActionShape(action, 'bluff_challenge', [])) return { valid: false, reason: 'Invalid challenge' };
    const pending = state.pendingClaim;
    if (!pending) return { valid: false, reason: 'No claim to challenge' };
    if (pending.playerId === playerId) return { valid: false, reason: 'A claimant cannot challenge their own play' };
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
    this.startRound(state, truthful ? pending.playerId : playerId);
    return { valid: true };
  }

  private startRound(state: BluffGameState, starterId: string): void {
    state.pendingClaim = null;
    state.claimRank = null;
    state.consecutivePasses = 0;
    state.currentTurnId = starterId;
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
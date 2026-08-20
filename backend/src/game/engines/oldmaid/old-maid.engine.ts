import type { CardRank, OldMaidAction, OldMaidGameState, OldMaidPlayerView, OldMaidResult, StandardCard } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class OldMaidEngine implements DistinctGameAdapter<OldMaidGameState, OldMaidAction, OldMaidPlayerView, OldMaidResult> {
  readonly key = 'old-maid' as const;
  readonly rulesetId = 'old-maid.single-queen-51-card.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): OldMaidGameState {
    this.requirePlayers(playerIds);
    const players = playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` }));
    const hands = Object.fromEntries(playerIds.map((id) => [id, [] as StandardCard[]]));
    const deck = this.shuffleCards(createStandardDeck().filter((card) => card.id !== 'c-clubs-Q'));
    deck.forEach((card, index) => hands[playerIds[index % playerIds.length]].push(card));
    for (const playerId of playerIds) this.discardPairs(hands[playerId]);
    const safeOrder = playerIds.filter((id) => hands[id].length === 0);
    const activePlayerIds = playerIds.filter((id) => hands[id].length > 0);
    const state: OldMaidGameState = {
      players,
      hands,
      activePlayerIds,
      safeOrder,
      currentTurnId: activePlayerIds[0] ?? playerIds[0],
      phase: 'playing',
      winnerId: null,
      loserId: null,
      isDraw: false,
      finishReason: null,
      lastEvent: 'Cards dealt and pairs discarded',
    };
    this.finishIfOneRemains(state);
    return state;
  }

  applyAction(state: OldMaidGameState, playerId: string, action: OldMaidAction): DistinctActionResult<OldMaidResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'draw_from_player', ['handIndex']) || !isBoundedInteger(action.handIndex, 0, 50)) {
      return { valid: false, reason: 'Invalid draw' };
    }
    const targetId = this.nextActiveId(state, playerId);
    if (!targetId || action.handIndex >= state.hands[targetId].length) return { valid: false, reason: 'Invalid hand index' };
    const [drawn] = state.hands[targetId].splice(action.handIndex, 1);
    state.hands[playerId].push(drawn);
    this.markSafeIfEmpty(state, targetId);
    const discarded = this.discardPairs(state.hands[playerId]);
    this.markSafeIfEmpty(state, playerId);
    state.lastEvent = `${playerId} drew one hidden card${discarded > 0 ? ' and discarded a pair' : ''}`;
    if (this.finishIfOneRemains(state)) return { valid: true, result: this.getResult(state) };
    state.currentTurnId = this.nextSeatActiveId(state, playerId);
    return { valid: true };
  }

  getPlayerView(state: OldMaidGameState, playerId: string): OldMaidPlayerView {
    const targetPlayerId = state.phase === 'playing' && state.currentTurnId === playerId ? this.nextActiveId(state, playerId) : null;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        handCount: state.hands[player.id].length,
        safeRank: state.safeOrder.includes(player.id) ? state.safeOrder.indexOf(player.id) + 1 : null,
      })),
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      currentTurnId: state.currentTurnId,
      targetPlayerId,
      targetHandCount: targetPlayerId ? state.hands[targetPlayerId].length : 0,
      safeOrder: [...state.safeOrder],
      phase: state.phase,
      winnerId: state.winnerId,
      loserId: state.loserId,
      canAct: state.phase === 'playing' && state.currentTurnId === playerId,
      lastEvent: state.lastEvent,
    };
  }

  surrender(state: OldMaidGameState, playerId: string): DistinctActionResult<OldMaidResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const ranking = [...state.safeOrder, ...state.players.map((player) => player.id).filter((id) => id !== playerId && !state.safeOrder.includes(id))];
    state.safeOrder = ranking;
    state.phase = 'finished';
    state.winnerId = ranking[0];
    state.loserId = playerId;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: OldMaidGameState): OldMaidResult {
    if (!state.finishReason || !state.winnerId || !state.loserId) throw new Error('Old Maid game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      loserId: state.loserId,
      ranking: [...state.safeOrder, state.loserId],
      isDraw: false,
      reason: state.finishReason,
    };
  }

  private discardPairs(hand: StandardCard[]): number {
    let discarded = 0;
    const ranks = [...new Set(hand.map((card) => card.rank))];
    for (const rank of ranks) {
      while (hand.filter((card) => card.rank === rank).length >= 2) {
        this.removeFirstRank(hand, rank);
        this.removeFirstRank(hand, rank);
        discarded += 2;
      }
    }
    return discarded;
  }

  private removeFirstRank(hand: StandardCard[], rank: CardRank): void {
    hand.splice(hand.findIndex((card) => card.rank === rank), 1);
  }

  private markSafeIfEmpty(state: OldMaidGameState, playerId: string): void {
    if (state.hands[playerId].length > 0 || state.safeOrder.includes(playerId)) return;
    state.safeOrder.push(playerId);
    state.activePlayerIds = state.activePlayerIds.filter((id) => id !== playerId);
  }

  private finishIfOneRemains(state: OldMaidGameState): boolean {
    if (state.activePlayerIds.length > 1) return false;
    const loserId = state.activePlayerIds[0];
    if (!loserId) return false;
    state.phase = 'finished';
    state.loserId = loserId;
    state.winnerId = state.safeOrder[0];
    state.finishReason = 'old_maid';
    return true;
  }

  private nextActiveId(state: OldMaidGameState, playerId: string): string | null {
    if (state.activePlayerIds.length < 2) return null;
    const index = state.activePlayerIds.indexOf(playerId);
    return state.activePlayerIds[(index + 1) % state.activePlayerIds.length];
  }

  private nextSeatActiveId(state: OldMaidGameState, playerId: string): string {
    const seat = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(seat + offset) % state.players.length].id;
      if (state.activePlayerIds.includes(candidate)) return candidate;
    }
    return state.activePlayerIds[0];
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < 2 || playerIds.length > 8 || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Old Maid requires two to eight distinct players');
    }
  }
}
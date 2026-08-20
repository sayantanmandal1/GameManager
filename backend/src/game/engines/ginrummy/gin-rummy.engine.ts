import type { GinRummyAction, GinRummyGameState, GinRummyPlayerView, GinRummyResult, StandardCard } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';
import { analyzeGinHand, deadwoodAfterLayoff } from './gin-rummy.analysis';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class GinRummyEngine implements DistinctGameAdapter<GinRummyGameState, GinRummyAction, GinRummyPlayerView, GinRummyResult> {
  readonly key = 'gin-rummy' as const;
  readonly rulesetId = 'gin-rummy.standard-100.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): GinRummyGameState {
    this.requirePlayers(playerIds);
    const state: GinRummyGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })) as GinRummyGameState['players'],
      hands: {}, stock: [], discardPile: [], scores: { [playerIds[0]]: 0, [playerIds[1]]: 0 },
      currentTurnId: playerIds[0], roundNumber: 1, phase: 'drawing', drawnCardId: null, drawSource: null,
      lastRound: null, winnerId: null, isDraw: false, finishReason: null,
    };
    this.dealRound(state);
    return state;
  }

  applyAction(state: GinRummyGameState, playerId: string, action: GinRummyAction): DistinctActionResult<GinRummyResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    return state.phase === 'drawing' ? this.draw(state, playerId, action) : this.discard(state, playerId, action);
  }

  getPlayerView(state: GinRummyGameState, playerId: string): GinRummyPlayerView {
    const hand = state.hands[playerId] ?? [];
    const legalDiscardIds = state.phase === 'discarding' && state.currentTurnId === playerId
      ? hand.filter((card) => !(state.drawSource === 'discard' && card.id === state.drawnCardId)).map((card) => card.id) : [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length, score: state.scores[player.id] })),
      youId: playerId,
      yourHand: hand.map((card) => ({ ...card })),
      yourAnalysis: analyzeGinHand(hand),
      stockCount: state.stock.length,
      topDiscard: state.discardPile.length > 0 ? { ...state.discardPile.at(-1)! } : null,
      currentTurnId: state.currentTurnId,
      roundNumber: state.roundNumber,
      phase: state.phase,
      lastRound: state.lastRound ? { ...state.lastRound, deadwood: { ...state.lastRound.deadwood } } : null,
      winnerId: state.winnerId,
      canAct: state.phase !== 'finished' && state.currentTurnId === playerId,
      canDrawStock: state.phase === 'drawing' && state.currentTurnId === playerId && state.stock.length > 0,
      canDrawDiscard: state.phase === 'drawing' && state.currentTurnId === playerId && state.discardPile.length > 0,
      legalDiscardIds,
      canKnock: legalDiscardIds.some((id) => analyzeGinHand(hand.filter((card) => card.id !== id)).deadwoodValue <= 10),
    };
  }

  surrender(state: GinRummyGameState, playerId: string): DistinctActionResult<GinRummyResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const opponent = state.players.find((player) => player.id !== playerId);
    if (!opponent || !state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished'; state.winnerId = opponent.id; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: GinRummyGameState): GinRummyResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Gin Rummy game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason, scores: { ...state.scores } };
  }

  private draw(state: GinRummyGameState, playerId: string, action: GinRummyAction): DistinctActionResult<GinRummyResult> {
    if (!hasExactActionShape(action, 'gin_draw', ['source']) || !['stock', 'discard'].includes(String(action.source))) return { valid: false, reason: 'Invalid draw' };
    const pile = action.source === 'stock' ? state.stock : state.discardPile;
    const card = pile.pop();
    if (!card) return { valid: false, reason: 'Selected pile is empty' };
    state.hands[playerId].push(card);
    state.drawnCardId = card.id; state.drawSource = action.source; state.phase = 'discarding';
    return { valid: true };
  }

  private discard(state: GinRummyGameState, playerId: string, action: GinRummyAction): DistinctActionResult<GinRummyResult> {
    if (!hasExactActionShape(action, 'gin_discard', ['cardId', 'knock']) || typeof action.cardId !== 'string' || typeof action.knock !== 'boolean') {
      return { valid: false, reason: 'Invalid discard' };
    }
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (state.drawSource === 'discard' && state.drawnCardId === card.id) return { valid: false, reason: 'Cannot return the picked-up discard' };
    const remaining = state.hands[playerId].filter((entry) => entry.id !== card.id);
    const analysis = analyzeGinHand(remaining);
    if (action.knock && analysis.deadwoodValue > 10) return { valid: false, reason: 'Deadwood is too high to knock' };
    state.hands[playerId] = remaining;
    state.discardPile.push(card);
    state.drawnCardId = null; state.drawSource = null;
    if (action.knock) return this.resolveKnock(state, playerId, analysis);
    if (state.stock.length <= 2) { state.roundNumber += 1; this.dealRound(state); return { valid: true }; }
    state.currentTurnId = state.players.find((player) => player.id !== playerId)!.id;
    state.phase = 'drawing';
    return { valid: true };
  }

  private resolveKnock(state: GinRummyGameState, knockerId: string, knockerAnalysis: ReturnType<typeof analyzeGinHand>): DistinctActionResult<GinRummyResult> {
    const opponentId = state.players.find((player) => player.id !== knockerId)!.id;
    const opponentAnalysis = analyzeGinHand(state.hands[opponentId]);
    const gin = knockerAnalysis.deadwoodValue === 0;
    const opponentDeadwood = gin ? opponentAnalysis.deadwoodValue : deadwoodAfterLayoff(opponentAnalysis.deadwood, knockerAnalysis.melds);
    const undercut = !gin && opponentDeadwood <= knockerAnalysis.deadwoodValue;
    const winnerId = undercut ? opponentId : knockerId;
    const points = this.roundPoints(gin, undercut, knockerAnalysis.deadwoodValue, opponentDeadwood);
    state.scores[winnerId] += points;
    state.lastRound = {
      winnerId, knockerId, points, gin, undercut,
      deadwood: { [knockerId]: knockerAnalysis.deadwoodValue, [opponentId]: opponentDeadwood },
    };
    if (state.scores[winnerId] >= 100) {
      state.phase = 'finished'; state.winnerId = winnerId; state.finishReason = 'score_limit';
      return { valid: true, result: this.getResult(state) };
    }
    state.roundNumber += 1;
    this.dealRound(state);
    return { valid: true };
  }

  private roundPoints(gin: boolean, undercut: boolean, knockerDeadwood: number, opponentDeadwood: number): number {
    if (gin) return opponentDeadwood + 25;
    if (undercut) return knockerDeadwood - opponentDeadwood + 25;
    return opponentDeadwood - knockerDeadwood;
  }

  private dealRound(state: GinRummyGameState): void {
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    for (let count = 0; count < 10; count += 1) for (const player of state.players) state.hands[player.id].push(deck.pop()!);
    state.discardPile = [deck.pop()!];
    state.stock = deck;
    state.currentTurnId = state.players[(state.roundNumber - 1) % 2].id;
    state.phase = 'drawing'; state.drawnCardId = null; state.drawSource = null;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) throw new Error('Gin Rummy requires exactly two distinct players');
  }
}
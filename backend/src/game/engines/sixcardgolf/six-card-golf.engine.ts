import type {
  GolfAction,
  GolfGameState,
  GolfPlayerView,
  GolfResult,
  StandardCard,
} from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const HOLES = 9;

export class SixCardGolfEngine implements DistinctGameAdapter<
  GolfGameState,
  GolfAction,
  GolfPlayerView,
  GolfResult,
  'six-card-golf'
> {
  readonly key = 'six-card-golf' as const;
  readonly rulesetId = 'six-card-golf.standard-nine-hole.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): GolfGameState {
    this.requirePlayers(playerIds);
    const state: GolfGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0], grids: {}, stock: [], discardPile: [], setupCompleteIds: [],
      dealerIndex: 0, currentTurnId: playerIds[1 % playerIds.length], drawn: null,
      totalScores: Object.fromEntries(playerIds.map((id) => [id, 0])), holeNumber: 0,
      lastHole: null, phase: 'setup', winnerId: null, isDraw: false, finishReason: null,
    };
    this.dealHole(state);
    return state;
  }

  applyAction(state: GolfGameState, playerId: string, action: GolfAction): DistinctActionResult<GolfResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'setup') return this.revealSetup(state, playerId, action);
    if (state.phase === 'hole_complete') return this.nextHole(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.phase === 'drawing') return this.draw(state, playerId, action);
    if (action.type === 'replace_golf_card') return this.replace(state, playerId, action);
    return this.discardDraw(state, playerId, action);
  }

  getPlayerView(state: GolfGameState, playerId: string): GolfPlayerView {
    const canAct = state.phase === 'setup'
      ? !state.setupCompleteIds.includes(playerId)
      : state.phase === 'hole_complete'
        ? playerId === state.hostId
        : state.currentTurnId === playerId;
    const publicGrids = Object.fromEntries(state.players.map((player) => [
      player.id,
      state.grids[player.id].map((entry) => ({ card: entry.faceUp ? { ...entry.card } : null, faceUp: entry.faceUp })),
    ]));
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, totalScore: state.totalScores[player.id], setupComplete: state.setupCompleteIds.includes(player.id),
      })),
      hostId: state.hostId, youId: playerId,
      yourGrid: publicGrids[playerId], publicGrids,
      stockCount: state.stock.length, topDiscard: { ...state.discardPile[state.discardPile.length - 1] },
      currentTurnId: state.currentTurnId, dealerId: state.players[state.dealerIndex].id,
      drawnCard: state.drawn?.playerId === playerId ? { ...state.drawn.card } : null,
      drawnSource: state.drawn?.playerId === playerId ? state.drawn.source : null,
      holeNumber: state.holeNumber,
      lastHole: state.lastHole ? {
        ...state.lastHole, scores: { ...state.lastHole.scores },
        grids: Object.fromEntries(Object.entries(state.lastHole.grids).map(([id, cards]) => [id, cards.map((card) => ({ ...card }))])),
      } : null,
      phase: state.phase, winnerId: state.winnerId, isDraw: state.isDraw, canAct,
      canRevealSetup: state.phase === 'setup' && canAct,
      canDraw: state.phase === 'drawing' && canAct,
      canReplace: state.phase === 'placing' && canAct,
      canDiscardDraw: state.phase === 'placing' && canAct && state.drawn?.source === 'stock',
    };
  }

  surrender(state: GolfGameState, playerId: string): DistinctActionResult<GolfResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const low = Math.min(...remaining.map((player) => state.totalScores[player.id]));
    const leaders = remaining.filter((player) => state.totalScores[player.id] === low);
    state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: GolfGameState): GolfResult {
    if (!state.finishReason) throw new Error('Six-Card Golf is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, totalScores: { ...state.totalScores } };
  }

  private revealSetup(state: GolfGameState, playerId: string, action: GolfAction): DistinctActionResult<GolfResult> {
    if (!hasExactActionShape(action, 'reveal_golf_cards', ['indices'])
      || !Array.isArray(action.indices) || action.indices.length !== 2
      || new Set(action.indices).size !== 2 || !action.indices.every((index) => isBoundedInteger(index, 0, 5))) {
      return { valid: false, reason: 'Reveal exactly two distinct grid cards' };
    }
    if (state.setupCompleteIds.includes(playerId)) return { valid: false, reason: 'Setup already complete' };
    for (const index of action.indices) state.grids[playerId][index].faceUp = true;
    state.setupCompleteIds.push(playerId);
    if (state.setupCompleteIds.length === state.players.length) {
      state.phase = 'drawing';
      state.currentTurnId = state.players[(state.dealerIndex + 1) % state.players.length].id;
    }
    return { valid: true };
  }

  private draw(state: GolfGameState, playerId: string, action: GolfAction): DistinctActionResult<GolfResult> {
    if (!hasExactActionShape(action, 'draw_golf_card', ['source']) || !['stock', 'discard'].includes(action.source)) {
      return { valid: false, reason: 'Invalid draw' };
    }
    const card = action.source === 'discard' ? state.discardPile.pop()! : this.drawStock(state);
    state.drawn = { playerId, card, source: action.source };
    state.phase = 'placing';
    return { valid: true };
  }

  private replace(state: GolfGameState, playerId: string, action: GolfAction): DistinctActionResult<GolfResult> {
    if (!hasExactActionShape(action, 'replace_golf_card', ['index']) || !isBoundedInteger(action.index, 0, 5)) return { valid: false, reason: 'Invalid grid index' };
    const replaced = state.grids[playerId][action.index].card;
    state.grids[playerId][action.index] = { card: state.drawn!.card, faceUp: true };
    state.discardPile.push(replaced);
    return this.finishTurn(state, playerId);
  }

  private discardDraw(state: GolfGameState, playerId: string, action: GolfAction): DistinctActionResult<GolfResult> {
    if (!hasExactActionShape(action, 'discard_golf_draw', ['revealIndex'])
      || (action.revealIndex !== null && !isBoundedInteger(action.revealIndex, 0, 5))) {
      return { valid: false, reason: 'Invalid discard' };
    }
    if (state.drawn?.source !== 'stock') return { valid: false, reason: 'A discard-pile draw must replace a grid card' };
    if (action.revealIndex !== null) {
      if (state.grids[playerId][action.revealIndex].faceUp) return { valid: false, reason: 'Reveal target is already face up' };
      state.grids[playerId][action.revealIndex].faceUp = true;
    }
    state.discardPile.push(state.drawn.card);
    return this.finishTurn(state, playerId);
  }

  private nextHole(state: GolfGameState, playerId: string, action: GolfAction): DistinctActionResult<GolfResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next hole' };
    if (!hasExactActionShape(action, 'next_golf_hole', [])) return { valid: false, reason: 'Invalid action' };
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    this.dealHole(state);
    return { valid: true };
  }

  private dealHole(state: GolfGameState): void {
    state.holeNumber += 1;
    const deck = this.shuffleCards(createStandardDeck());
    state.grids = Object.fromEntries(state.players.map((player) => [player.id, []]));
    for (let count = 0; count < 6; count += 1) {
      for (let offset = 1; offset <= state.players.length; offset += 1) {
        state.grids[state.players[(state.dealerIndex + offset) % state.players.length].id].push({ card: deck.shift()!, faceUp: false });
      }
    }
    state.stock = deck; state.discardPile = [state.stock.shift()!]; state.setupCompleteIds = [];
    state.drawn = null; state.currentTurnId = state.players[(state.dealerIndex + 1) % state.players.length].id;
    state.phase = 'setup';
  }

  private finishTurn(state: GolfGameState, playerId: string): DistinctActionResult<GolfResult> {
    state.drawn = null;
    if (state.players.some((player) => state.grids[player.id].every((entry) => entry.faceUp))) return this.completeHole(state);
    state.phase = 'drawing'; state.currentTurnId = this.nextPlayerId(state, playerId);
    return { valid: true };
  }

  private completeHole(state: GolfGameState): DistinctActionResult<GolfResult> {
    for (const player of state.players) for (const entry of state.grids[player.id]) entry.faceUp = true;
    const scores = Object.fromEntries(state.players.map((player) => [player.id, this.gridScore(state.grids[player.id].map((entry) => entry.card))]));
    for (const player of state.players) state.totalScores[player.id] += scores[player.id];
    state.lastHole = {
      holeNumber: state.holeNumber, scores,
      grids: Object.fromEntries(state.players.map((player) => [player.id, state.grids[player.id].map((entry) => ({ ...entry.card }))])),
    };
    if (state.holeNumber === HOLES) {
      const low = Math.min(...Object.values(state.totalScores));
      const leaders = state.players.filter((player) => state.totalScores[player.id] === low);
      state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
      state.phase = 'finished'; state.finishReason = 'nine_holes';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'hole_complete'; state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private gridScore(cards: StandardCard[]): number {
    let total = 0;
    for (const [top, bottom] of [[0, 3], [1, 4], [2, 5]]) {
      if (cards[top].rank === cards[bottom].rank) continue;
      total += this.cardValue(cards[top]) + this.cardValue(cards[bottom]);
    }
    return total;
  }

  private cardValue(card: StandardCard): number {
    if (card.rank === 'A') return 1;
    if (card.rank === '2') return -2;
    if (card.rank === 'K') return 0;
    if (card.rank === 'J' || card.rank === 'Q') return 10;
    return Number(card.rank);
  }

  private drawStock(state: GolfGameState): StandardCard {
    if (state.stock.length === 0) {
      const top = state.discardPile.pop()!;
      state.stock = this.shuffleCards(state.discardPile);
      state.discardPile = [top];
    }
    return state.stock.shift()!;
  }
  private nextPlayerId(state: GolfGameState, playerId: string): string { const index = state.players.findIndex((player) => player.id === playerId); return state.players[(index + 1) % state.players.length].id; }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) throw new Error('Six-Card Golf requires two to four distinct players'); }
}
import type {
  NinetyNineAction,
  NinetyNineGameState,
  NinetyNinePlayerView,
  NinetyNineResult,
  StandardCard,
} from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class NinetyNineEngine implements DistinctGameAdapter<NinetyNineGameState, NinetyNineAction, NinetyNinePlayerView, NinetyNineResult> {
  readonly key = 'ninety-nine' as const;
  readonly rulesetId = 'ninety-nine.standard-three-token.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): NinetyNineGameState {
    this.requirePlayers(playerIds);
    const state: NinetyNineGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hands: {},
      stock: [],
      discardPile: [],
      tokens: Object.fromEntries(playerIds.map((id) => [id, 3])),
      activePlayerIds: [...playerIds],
      total: 0,
      direction: 1,
      dealerIndex: playerIds.length - 1,
      currentTurnId: playerIds[0],
      handNumber: 0,
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
    this.dealHand(state);
    return state;
  }

  applyAction(
    state: NinetyNineGameState,
    playerId: string,
    action: NinetyNineAction,
  ): DistinctActionResult<NinetyNineResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    const legalPlays = this.legalPlays(state, playerId);
    if (action.type === 'concede_ninety_nine') {
      if (!hasExactActionShape(action, 'concede_ninety_nine', [])) return { valid: false, reason: 'Invalid concession' };
      if (legalPlays.length > 0) return { valid: false, reason: 'A legal card must be played' };
      return this.loseToken(state, playerId);
    }
    if (!hasExactActionShape(action, 'play_ninety_nine', ['cardId', 'chosenValue'])
      || typeof action.cardId !== 'string'
      || !Number.isInteger(action.chosenValue)) {
      return { valid: false, reason: 'Invalid play' };
    }
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    const legal = legalPlays.find((entry) => entry.cardId === card.id);
    if (!legal?.values.includes(action.chosenValue)) return { valid: false, reason: 'Card value would exceed ninety-nine' };

    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.discardPile.push(card);
    state.total = card.rank === '9' ? 99 : state.total + action.chosenValue;
    this.drawReplacement(state, playerId);

    let offset = 1;
    if (card.rank === '4') {
      if (state.activePlayerIds.length === 2) offset = 0;
      else state.direction = state.direction === 1 ? -1 : 1;
    } else if (card.rank === '3') offset = 2;
    state.currentTurnId = offset === 0
      ? playerId
      : this.activePlayerAtOffset(state, playerId, offset);
    return { valid: true };
  }

  getPlayerView(state: NinetyNineGameState, playerId: string): NinetyNinePlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId;
    const legalPlays = canAct ? this.legalPlays(state, playerId) : [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        handCount: state.hands[player.id].length,
        tokens: state.tokens[player.id],
        active: state.activePlayerIds.includes(player.id),
      })),
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      total: state.total,
      direction: state.direction,
      dealerId: state.players[state.dealerIndex].id,
      currentTurnId: state.currentTurnId,
      handNumber: state.handNumber,
      phase: state.phase,
      winnerId: state.winnerId,
      canAct,
      legalPlays,
      mustConcede: canAct && legalPlays.length === 0,
    };
  }

  surrender(state: NinetyNineGameState, playerId: string): DistinctActionResult<NinetyNineResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.activePlayerIds.filter((id) => id !== playerId);
    state.winnerId = remaining[0] ?? state.players.find((player) => player.id !== playerId)!.id;
    state.phase = 'finished';
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: NinetyNineGameState): NinetyNineResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Ninety-Nine game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason, tokens: { ...state.tokens } };
  }

  private legalPlays(state: NinetyNineGameState, playerId: string): Array<{ cardId: string; values: number[] }> {
    return state.hands[playerId].map((card) => ({
      cardId: card.id,
      values: this.cardValues(card).filter((value) => {
        const nextTotal = card.rank === '9' ? 99 : state.total + value;
        return nextTotal >= 0 && nextTotal <= 99;
      }),
    })).filter((entry) => entry.values.length > 0);
  }

  private cardValues(card: StandardCard): number[] {
    if (card.rank === 'A') return [1, 11];
    if (card.rank === '4' || card.rank === 'K') return [0];
    if (card.rank === '9') return [99];
    if (card.rank === '10') return [-10, 10];
    if (card.rank === 'J' || card.rank === 'Q') return [10];
    return [Number(card.rank)];
  }

  private loseToken(state: NinetyNineGameState, playerId: string): DistinctActionResult<NinetyNineResult> {
    state.tokens[playerId] -= 1;
    if (state.tokens[playerId] === 0) state.activePlayerIds = state.activePlayerIds.filter((id) => id !== playerId);
    if (state.activePlayerIds.length === 1) {
      state.winnerId = state.activePlayerIds[0];
      state.phase = 'finished';
      state.finishReason = 'last_with_tokens';
      return { valid: true, result: this.getResult(state) };
    }
    const dealerId = state.players[state.dealerIndex].id;
    state.dealerIndex = state.players.findIndex((player) => player.id === this.nextActiveSeatId(state, dealerId));
    this.dealHand(state);
    return { valid: true };
  }

  private dealHand(state: NinetyNineGameState): void {
    state.handNumber += 1;
    state.stock = this.shuffleCards(createStandardDeck());
    state.discardPile = [];
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    for (let count = 0; count < 3; count += 1) {
      for (const playerId of state.activePlayerIds) state.hands[playerId].push(state.stock.pop()!);
    }
    state.total = 0;
    state.direction = 1;
    state.currentTurnId = this.nextActiveSeatId(state, state.players[state.dealerIndex].id);
  }

  private drawReplacement(state: NinetyNineGameState, playerId: string): void {
    if (state.stock.length === 0 && state.discardPile.length > 1) {
      const top = state.discardPile.pop()!;
      state.stock = this.shuffleCards(state.discardPile);
      state.discardPile = [top];
    }
    const card = state.stock.pop();
    if (card) state.hands[playerId].push(card);
  }

  private activePlayerAtOffset(state: NinetyNineGameState, playerId: string, offset: number): string {
    let candidate = playerId;
    for (let count = 0; count < offset; count += 1) candidate = this.nextActiveSeatId(state, candidate, state.direction);
    return candidate;
  }

  private nextActiveSeatId(state: NinetyNineGameState, playerId: string, direction: 1 | -1 = 1): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(index + direction * offset + state.players.length * 2) % state.players.length].id;
      if (state.activePlayerIds.includes(candidate)) return candidate;
    }
    return state.activePlayerIds[0];
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Ninety-Nine requires two to eight distinct players');
    }
  }
}
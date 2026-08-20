import type { SpoonsAction, SpoonsGameState, SpoonsPlayerView, SpoonsResult, StandardCard } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const ELIMINATION_LETTERS = 5;

export class SpoonsEngine implements DistinctGameAdapter<SpoonsGameState, SpoonsAction, SpoonsPlayerView, SpoonsResult> {
  readonly key = 'spoons' as const;
  readonly rulesetId = 'spoons.standard-spoon-elimination.v1';
  readonly minPlayers = 3;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): SpoonsGameState {
    this.requirePlayers(playerIds);
    const state: SpoonsGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0], hands: {}, stock: [], trash: [], activePlayerIds: [...playerIds],
      dealerIndex: 0, currentTurnId: playerIds[0], spoonsRemaining: playerIds.length - 1,
      grabbedIds: [], letters: Object.fromEntries(playerIds.map((id) => [id, 0])),
      roundNumber: 0, lastRound: null, phase: 'passing', winnerId: null,
      isDraw: false, finishReason: null,
    };
    this.dealRound(state);
    return state;
  }

  applyAction(state: SpoonsGameState, playerId: string, action: SpoonsAction): DistinctActionResult<SpoonsResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'round_complete') return this.nextRound(state, playerId, action);
    if (action.type === 'grab_spoon') return this.grab(state, playerId, action);
    return this.passCard(state, playerId, action);
  }

  getPlayerView(state: SpoonsGameState, playerId: string): SpoonsPlayerView {
    const canPass = state.phase === 'passing' && state.currentTurnId === playerId && state.hands[playerId].length === 5;
    const canGrab = state.activePlayerIds.includes(playerId) && !state.grabbedIds.includes(playerId)
      && (state.phase === 'spoon_rush' || (state.phase === 'passing' && this.hasQuartet(state.hands[playerId])));
    const canStartNext = state.phase === 'round_complete' && playerId === state.hostId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, handCount: state.hands[player.id].length, letters: state.letters[player.id],
        active: state.activePlayerIds.includes(player.id), grabbed: state.grabbedIds.includes(player.id),
      })),
      hostId: state.hostId, youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      currentTurnId: state.currentTurnId, dealerId: state.players[state.dealerIndex].id,
      spoonsRemaining: state.spoonsRemaining, roundNumber: state.roundNumber,
      lastRound: state.lastRound ? { ...state.lastRound, letters: { ...state.lastRound.letters } } : null,
      phase: state.phase, winnerId: state.winnerId,
      canAct: canPass || canGrab || canStartNext,
      canPass, canGrab, canStartNext,
    };
  }

  surrender(state: SpoonsGameState, playerId: string): DistinctActionResult<SpoonsResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    state.winnerId = state.activePlayerIds.find((id) => id !== playerId)
      ?? state.players.find((player) => player.id !== playerId)!.id;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: SpoonsGameState): SpoonsResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Spoons session is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason, letters: { ...state.letters } };
  }

  private passCard(state: SpoonsGameState, playerId: string, action: SpoonsAction): DistinctActionResult<SpoonsResult> {
    if (state.phase !== 'passing') return { valid: false, reason: 'Cards cannot be passed during the spoon rush' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn to pass' };
    if (!hasExactActionShape(action, 'pass_spoon_card', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid pass' };
    const index = state.hands[playerId].findIndex((card) => card.id === action.cardId);
    if (index < 0) return { valid: false, reason: 'Card not in hand' };
    if (state.hands[playerId].length !== 5) return { valid: false, reason: 'Player must hold five cards before passing' };
    const [passed] = state.hands[playerId].splice(index, 1);
    const nextId = this.nextActiveId(state, playerId);
    const dealerId = state.players[state.dealerIndex].id;
    if (nextId === dealerId) {
      state.trash.push(passed);
      state.hands[dealerId].push(this.drawForDealer(state));
      state.currentTurnId = dealerId;
    } else {
      state.hands[nextId].push(passed);
      state.currentTurnId = nextId;
    }
    return { valid: true };
  }

  private grab(state: SpoonsGameState, playerId: string, action: SpoonsAction): DistinctActionResult<SpoonsResult> {
    if (!hasExactActionShape(action, 'grab_spoon', [])) return { valid: false, reason: 'Invalid grab' };
    if (!state.activePlayerIds.includes(playerId)) return { valid: false, reason: 'Player is eliminated' };
    if (state.grabbedIds.includes(playerId)) return { valid: false, reason: 'Player already has a spoon' };
    if (state.phase === 'passing') {
      if (!this.hasQuartet(state.hands[playerId])) return { valid: false, reason: 'A quartet is required to start the rush' };
      state.phase = 'spoon_rush';
    }
    if (state.spoonsRemaining <= 0) return { valid: false, reason: 'No spoons remain' };
    state.grabbedIds.push(playerId); state.spoonsRemaining -= 1;
    if (state.spoonsRemaining > 0) return { valid: true };
    return this.completeRush(state);
  }

  private nextRound(state: SpoonsGameState, playerId: string, action: SpoonsAction): DistinctActionResult<SpoonsResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next round' };
    if (!hasExactActionShape(action, 'next_spoons_round', [])) return { valid: false, reason: 'Invalid action' };
    const dealerId = state.players[state.dealerIndex].id;
    const nextDealerId = this.nextActiveId(state, dealerId);
    state.dealerIndex = state.players.findIndex((player) => player.id === nextDealerId);
    this.dealRound(state);
    return { valid: true };
  }

  private dealRound(state: SpoonsGameState): void {
    state.roundNumber += 1;
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    for (let count = 0; count < 4; count += 1) for (const playerId of state.activePlayerIds) state.hands[playerId].push(deck.shift()!);
    state.stock = deck; state.trash = []; state.grabbedIds = [];
    state.spoonsRemaining = state.activePlayerIds.length - 1;
    const dealerId = state.players[state.dealerIndex].id;
    state.hands[dealerId].push(this.drawForDealer(state));
    state.currentTurnId = dealerId; state.phase = 'passing';
  }

  private completeRush(state: SpoonsGameState): DistinctActionResult<SpoonsResult> {
    const loserId = state.activePlayerIds.find((id) => !state.grabbedIds.includes(id))!;
    state.letters[loserId] += 1;
    const eliminated = state.letters[loserId] >= ELIMINATION_LETTERS;
    if (eliminated) state.activePlayerIds = state.activePlayerIds.filter((id) => id !== loserId);
    state.lastRound = { roundNumber: state.roundNumber, loserId, eliminated, letters: { ...state.letters } };
    if (state.activePlayerIds.length === 1) {
      state.winnerId = state.activePlayerIds[0]; state.phase = 'finished'; state.finishReason = 'last_player';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'round_complete'; state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private drawForDealer(state: SpoonsGameState): StandardCard {
    if (state.stock.length === 0) {
      state.stock = this.shuffleCards(state.trash);
      state.trash = [];
    }
    const card = state.stock.shift();
    if (!card) throw new Error('Spoons draw stock exhausted');
    return card;
  }

  private hasQuartet(hand: StandardCard[]): boolean {
    return [...new Set(hand.map((card) => card.rank))].some((rank) => hand.filter((card) => card.rank === rank).length >= 4);
  }
  private nextActiveId(state: SpoonsGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(index + offset) % state.players.length].id;
      if (state.activePlayerIds.includes(candidate)) return candidate;
    }
    return state.activePlayerIds[0];
  }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) throw new Error('Spoons requires three to eight distinct players'); }
}
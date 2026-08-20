import type { HeartsAction, HeartsGameState, HeartsPassDirection, HeartsPlayerView, HeartsResult, StandardCard } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const PASS_DIRECTIONS: HeartsPassDirection[] = ['left', 'right', 'across', 'hold'];

export class HeartsEngine implements DistinctGameAdapter<HeartsGameState, HeartsAction, HeartsPlayerView, HeartsResult> {
  readonly key = 'hearts' as const;
  readonly rulesetId = 'hearts.standard-100.v1';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): HeartsGameState {
    this.requirePlayers(playerIds);
    const state: HeartsGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })) as HeartsGameState['players'],
      hands: {},
      passSelections: {},
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      roundPoints: {},
      trick: [],
      currentTurnId: null,
      leaderId: null,
      roundNumber: 1,
      passDirection: 'left',
      heartsBroken: false,
      phase: 'passing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
    this.dealRound(state);
    return state;
  }

  applyAction(state: HeartsGameState, playerId: string, action: HeartsAction): DistinctActionResult<HeartsResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'passing') return this.passCards(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    return this.playCard(state, playerId, action);
  }

  getPlayerView(state: HeartsGameState, playerId: string): HeartsPlayerView {
    const hand = state.hands[playerId] ?? [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        handCount: state.hands[player.id].length,
        score: state.scores[player.id],
        roundPoints: state.roundPoints[player.id],
        passed: state.passSelections[player.id] !== null,
      })),
      youId: playerId,
      yourHand: hand.map((card) => ({ ...card })),
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      currentTurnId: state.currentTurnId,
      leaderId: state.leaderId,
      roundNumber: state.roundNumber,
      passDirection: state.passDirection,
      heartsBroken: state.heartsBroken,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase === 'passing'
        ? state.passSelections[playerId] === null
        : state.phase === 'playing' && state.currentTurnId === playerId,
      legalCardIds: state.phase === 'playing' && state.currentTurnId === playerId
        ? this.legalCards(state, playerId).map((card) => card.id)
        : [],
    };
  }

  surrender(state: HeartsGameState, playerId: string): DistinctActionResult<HeartsResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const lowScore = Math.min(...remaining.map((player) => state.scores[player.id]));
    state.phase = 'finished';
    state.winnerId = remaining.find((player) => state.scores[player.id] === lowScore)!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: HeartsGameState): HeartsResult {
    if (!state.finishReason) throw new Error('Hearts game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores } };
  }

  private passCards(state: HeartsGameState, playerId: string, action: HeartsAction): DistinctActionResult<HeartsResult> {
    if (!hasExactActionShape(action, 'pass_cards', ['cardIds']) || !Array.isArray(action.cardIds)
      || action.cardIds.length !== 3 || new Set(action.cardIds).size !== 3 || !action.cardIds.every((id) => typeof id === 'string')) {
      return { valid: false, reason: 'Invalid pass' };
    }
    if (state.passSelections[playerId] !== null) return { valid: false, reason: 'Cards already selected' };
    if (!action.cardIds.every((id) => state.hands[playerId].some((card) => card.id === id))) return { valid: false, reason: 'Card not in hand' };
    state.passSelections[playerId] = [...action.cardIds];
    if (state.players.every((player) => state.passSelections[player.id] !== null)) {
      this.resolvePass(state);
      this.beginTricks(state);
    }
    return { valid: true };
  }

  private playCard(state: HeartsGameState, playerId: string, action: HeartsAction): DistinctActionResult<HeartsResult> {
    if (!hasExactActionShape(action, 'play_card', ['cardId']) || typeof action.cardId !== 'string') {
      return { valid: false, reason: 'Invalid play' };
    }
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!this.legalCards(state, playerId).some((entry) => entry.id === card.id)) return { valid: false, reason: 'Card is not legal' };
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId, card });
    if (card.suit === 'hearts') state.heartsBroken = true;
    if (state.trick.length < 4) {
      state.currentTurnId = this.nextPlayerId(state, playerId);
      return { valid: true };
    }
    const winnerId = this.trickWinner(state.trick);
    state.roundPoints[winnerId] += state.trick.reduce((points, entry) => points + this.penalty(entry.card), 0);
    state.trick = [];
    state.leaderId = winnerId;
    state.currentTurnId = winnerId;
    if (state.players.some((player) => state.hands[player.id].length > 0)) return { valid: true };
    if (this.scoreRound(state)) return { valid: true, result: this.getResult(state) };
    state.roundNumber += 1;
    this.dealRound(state);
    return { valid: true };
  }

  private dealRound(state: HeartsGameState): void {
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    deck.forEach((card, index) => state.hands[state.players[index % 4].id].push(card));
    state.passDirection = PASS_DIRECTIONS[(state.roundNumber - 1) % PASS_DIRECTIONS.length];
    state.passSelections = Object.fromEntries(state.players.map((player) => [player.id, null]));
    state.roundPoints = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    state.trick = [];
    state.currentTurnId = null;
    state.leaderId = null;
    state.heartsBroken = false;
    state.phase = state.passDirection === 'hold' ? 'playing' : 'passing';
    if (state.passDirection === 'hold') this.beginTricks(state);
  }

  private resolvePass(state: HeartsGameState): void {
    const outgoing = Object.fromEntries(state.players.map((player) => [player.id, state.passSelections[player.id]!.map((id) => state.hands[player.id].find((card) => card.id === id)!)]));
    for (const player of state.players) state.hands[player.id] = state.hands[player.id].filter((card) => !state.passSelections[player.id]!.includes(card.id));
    state.players.forEach((player, index) => {
      const recipientIndex = this.passRecipientIndex(index, state.passDirection);
      state.hands[state.players[recipientIndex].id].push(...outgoing[player.id]);
    });
  }

  private beginTricks(state: HeartsGameState): void {
    const holder = state.players.find((player) => state.hands[player.id].some((card) => card.id === 'c-clubs-2'))!;
    state.phase = 'playing';
    state.currentTurnId = holder.id;
    state.leaderId = holder.id;
  }

  private legalCards(state: HeartsGameState, playerId: string): StandardCard[] {
    const hand = state.hands[playerId];
    if (state.trick.length === 0 && this.cardsRemaining(state) === 52) return hand.filter((card) => card.id === 'c-clubs-2');
    if (state.trick.length > 0) {
      const leadSuit = state.trick[0].card.suit;
      const following = hand.filter((card) => card.suit === leadSuit);
      return following.length > 0 ? following : hand;
    }
    if (state.heartsBroken) return hand;
    const nonHearts = hand.filter((card) => card.suit !== 'hearts');
    return nonHearts.length > 0 ? nonHearts : hand;
  }

  private scoreRound(state: HeartsGameState): boolean {
    const shooter = state.players.find((player) => state.roundPoints[player.id] === 26);
    for (const player of state.players) {
      const points = shooter ? this.moonPoints(player.id, shooter.id) : state.roundPoints[player.id];
      state.scores[player.id] += points;
    }
    if (!state.players.some((player) => state.scores[player.id] >= 100)) return false;
    const lowScore = Math.min(...Object.values(state.scores));
    const leaders = state.players.filter((player) => state.scores[player.id] === lowScore);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'score_limit';
    return true;
  }

  private passRecipientIndex(index: number, direction: HeartsPassDirection): number {
    if (direction === 'left') return (index + 1) % 4;
    if (direction === 'right') return (index + 3) % 4;
    return (index + 2) % 4;
  }

  private moonPoints(playerId: string, shooterId: string): number {
    return playerId === shooterId ? 0 : 26;
  }

  private trickWinner(trick: HeartsGameState['trick']): string {
    const leadSuit = trick[0].card.suit;
    return trick.filter((entry) => entry.card.suit === leadSuit)
      .sort((left, right) => this.rankValue(right.card) - this.rankValue(left.card))[0].playerId;
  }

  private penalty(card: StandardCard): number {
    if (card.suit === 'hearts') return 1;
    return card.suit === 'spades' && card.rank === 'Q' ? 13 : 0;
  }

  private rankValue(card: StandardCard): number {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return ranks.indexOf(card.rank) + 2;
  }

  private cardsRemaining(state: HeartsGameState): number {
    return state.players.reduce((total, player) => total + state.hands[player.id].length, 0);
  }

  private nextPlayerId(state: HeartsGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    return state.players[(index + 1) % 4].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 4 || new Set(playerIds).size !== 4) throw new Error('Hearts requires exactly four distinct players');
  }
}
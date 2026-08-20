import type {
  ColorMatchAction,
  ColorMatchCard,
  ColorMatchColor,
  ColorMatchGameState,
  ColorMatchPlayerView,
  ColorMatchResult,
} from '../../../shared';
import { COLOR_MATCH_COLORS } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { secureShuffle } from '../standard-cards';

type CardShuffler = (cards: ColorMatchCard[]) => ColorMatchCard[];
type TargetShuffler = (colors: ColorMatchColor[]) => ColorMatchColor[];
const ROUNDS = 6;

export class ColorMatchEngine implements DistinctGameAdapter<
  ColorMatchGameState,
  ColorMatchAction,
  ColorMatchPlayerView,
  ColorMatchResult,
  'color-match'
> {
  readonly key = 'color-match' as const;
  readonly rulesetId = 'color-match.simultaneous-six-round.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    private readonly shuffleCards: CardShuffler = secureShuffle,
    private readonly shuffleTargets: TargetShuffler = secureShuffle,
  ) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): ColorMatchGameState {
    this.requirePlayers(playerIds);
    const deck = this.shuffleCards(this.createDeck());
    const hands = Object.fromEntries(playerIds.map((id) => [id, deck.splice(0, 6)]));
    const state: ColorMatchGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hands, deck, targets: ['red', 'yellow', 'blue'], targetDeck: this.createTargetDeck(),
      commitments: Object.fromEntries(playerIds.map((id) => [id, null])),
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      roundNumber: 0, lastReveal: null, phase: 'planning', winnerId: null,
      isDraw: false, finishReason: null,
    };
    this.startRound(state);
    return state;
  }

  applyAction(state: ColorMatchGameState, playerId: string, action: ColorMatchAction): DistinctActionResult<ColorMatchResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!hasExactActionShape(action, 'commit_color_match', ['cardIds'])
      || !Array.isArray(action.cardIds) || action.cardIds.length !== 3
      || new Set(action.cardIds).size !== 3 || !action.cardIds.every((id) => typeof id === 'string')) {
      return { valid: false, reason: 'Commit exactly three distinct cards' };
    }
    if (state.commitments[playerId]) return { valid: false, reason: 'Commitment already locked' };
    const cards = action.cardIds.map((id) => state.hands[playerId].find((card) => card.id === id));
    if (cards.some((card) => !card)) return { valid: false, reason: 'Card not in hand' };
    state.commitments[playerId] = (cards as ColorMatchCard[]).map((card) => ({ ...card }));
    if (!state.players.every((player) => state.commitments[player.id])) return { valid: true };
    return this.resolveRound(state);
  }

  getPlayerView(state: ColorMatchGameState, playerId: string): ColorMatchPlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, score: state.scores[player.id], committed: state.commitments[player.id] !== null,
      })),
      youId: playerId, yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      yourCommitment: state.commitments[playerId]?.map((card) => ({ ...card })) ?? null,
      targets: [...state.targets], roundNumber: state.roundNumber,
      lastReveal: state.lastReveal ? {
        ...state.lastReveal, targets: [...state.lastReveal.targets], points: { ...state.lastReveal.points },
        commitments: Object.fromEntries(Object.entries(state.lastReveal.commitments).map(([id, cards]) => [id, cards.map((card) => ({ ...card }))])),
      } : null,
      phase: state.phase, winnerId: state.winnerId, isDraw: state.isDraw,
      canAct: state.phase === 'planning' && state.commitments[playerId] === null,
    };
  }

  surrender(state: ColorMatchGameState, playerId: string): DistinctActionResult<ColorMatchResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const high = Math.max(...remaining.map((player) => state.scores[player.id]));
    const leaders = remaining.filter((player) => state.scores[player.id] === high);
    state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: ColorMatchGameState): ColorMatchResult {
    if (!state.finishReason) throw new Error('Color Match is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores } };
  }

  private resolveRound(state: ColorMatchGameState): DistinctActionResult<ColorMatchResult> {
    const commitments = Object.fromEntries(state.players.map((player) => [player.id, state.commitments[player.id]!.map((card) => ({ ...card }))]));
    const points = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    for (let lane = 0; lane < 3; lane += 1) {
      const target = state.targets[lane];
      const exactPlayers: string[] = [];
      for (const player of state.players) {
        const card = commitments[player.id][lane];
        if (card.color === target) {
          points[player.id] += 3;
          exactPlayers.push(player.id);
        } else if (this.isAdjacent(card.color, target)) points[player.id] += 1;
      }
      if (exactPlayers.length > 0) {
        const high = Math.max(...exactPlayers.map((id) => commitments[id][lane].value));
        const highPlayers = exactPlayers.filter((id) => commitments[id][lane].value === high);
        if (highPlayers.length === 1) points[highPlayers[0]] += 2;
      }
    }
    for (const player of state.players) {
      state.scores[player.id] += points[player.id];
      const used = new Set(commitments[player.id].map((card) => card.id));
      state.hands[player.id] = state.hands[player.id].filter((card) => !used.has(card.id));
      while (state.hands[player.id].length < 6 && state.deck.length > 0) state.hands[player.id].push(state.deck.shift()!);
    }
    state.lastReveal = { roundNumber: state.roundNumber, targets: [...state.targets], commitments, points };
    if (state.roundNumber === ROUNDS) {
      const high = Math.max(...Object.values(state.scores));
      const leaders = state.players.filter((player) => state.scores[player.id] === high);
      state.winnerId = leaders.length === 1 ? leaders[0].id : null; state.isDraw = leaders.length > 1;
      state.phase = 'finished'; state.finishReason = 'six_rounds';
      return { valid: true, result: this.getResult(state) };
    }
    this.startRound(state);
    return { valid: true };
  }

  private startRound(state: ColorMatchGameState): void {
    state.roundNumber += 1;
    if (state.targetDeck.length < 3) state.targetDeck = this.createTargetDeck();
    state.targets = state.targetDeck.splice(0, 3) as ColorMatchGameState['targets'];
    state.commitments = Object.fromEntries(state.players.map((player) => [player.id, null]));
  }

  private createDeck(): ColorMatchCard[] {
    return COLOR_MATCH_COLORS.flatMap((color) => Array.from({ length: 6 }, (_, index) => ({ id: `cm-${color}-${index + 1}`, color, value: index + 1 })));
  }

  private createTargetDeck(): ColorMatchColor[] {
    return this.shuffleTargets(COLOR_MATCH_COLORS.flatMap((color) => [color, color, color]));
  }

  private isAdjacent(left: ColorMatchColor, right: ColorMatchColor): boolean {
    const leftIndex = COLOR_MATCH_COLORS.indexOf(left);
    const rightIndex = COLOR_MATCH_COLORS.indexOf(right);
    const distance = Math.abs(leftIndex - rightIndex);
    return distance === 1 || distance === COLOR_MATCH_COLORS.length - 1;
  }

  private requirePlayers(playerIds: string[]): void { if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) throw new Error('Color Match requires two to six distinct players'); }
}
import type { StandardCard, WhistAction, WhistGameState, WhistPlayerView, WhistResult } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export class WhistEngine implements DistinctGameAdapter<WhistGameState, WhistAction, WhistPlayerView, WhistResult> {
  readonly key = 'whist' as const;
  readonly rulesetId = 'whist.classic-short-five.v1';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): WhistGameState {
    this.requirePlayers(playerIds);
    const state: WhistGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}`, team: (index % 2) as 0 | 1 })) as WhistGameState['players'],
      hostId: playerIds[0], hands: {}, dealerIndex: 0,
      trumpCard: { id: 'c-clubs-2', suit: 'clubs', rank: '2' }, trumpSuit: 'clubs',
      trick: [], teamTricks: [0, 0], gamePoints: [0, 0], currentTurnId: playerIds[1], leaderId: playerIds[1],
      handNumber: 0, lastHand: null, phase: 'playing', winnerId: null, winnerTeam: null,
      isDraw: false, finishReason: null,
    };
    this.dealHand(state);
    return state;
  }

  applyAction(state: WhistGameState, playerId: string, action: WhistAction): DistinctActionResult<WhistResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'hand_complete') return this.nextHand(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'play_whist_card', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid play' };
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!this.legalCards(state, playerId).some((entry) => entry.id === card.id)) return { valid: false, reason: 'Must follow suit' };
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId, card });
    if (state.trick.length < 4) {
      state.currentTurnId = this.nextPlayerId(state, playerId);
      return { valid: true };
    }
    const winnerId = this.trickWinner(state);
    const winnerTeam = state.players.find((player) => player.id === winnerId)!.team;
    state.teamTricks[winnerTeam] += 1;
    state.trick = [];
    state.currentTurnId = winnerId;
    state.leaderId = winnerId;
    if (state.players.some((player) => state.hands[player.id].length > 0)) return { valid: true };
    return this.completeHand(state);
  }

  getPlayerView(state: WhistGameState, playerId: string): WhistPlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length, tricksWon: state.teamTricks[player.team] })),
      hostId: state.hostId, youId: playerId, yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      dealerId: state.players[state.dealerIndex].id, trumpCard: { ...state.trumpCard }, trumpSuit: state.trumpSuit,
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      teamTricks: [...state.teamTricks], gamePoints: [...state.gamePoints], currentTurnId: state.currentTurnId,
      leaderId: state.leaderId, handNumber: state.handNumber,
      lastHand: state.lastHand ? { ...state.lastHand, tricks: [...state.lastHand.tricks], oddPoints: [...state.lastHand.oddPoints] } : null,
      phase: state.phase, winnerId: state.winnerId, winnerTeam: state.winnerTeam, canAct,
      legalCardIds: canAct ? this.legalCards(state, playerId).map((card) => card.id) : [],
    };
  }

  surrender(state: WhistGameState, playerId: string): DistinctActionResult<WhistResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };
    state.winnerTeam = (1 - player.team) as 0 | 1;
    state.winnerId = state.players.find((entry) => entry.team === state.winnerTeam)!.id;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: WhistGameState): WhistResult {
    if (!state.finishReason || state.winnerTeam === null || !state.winnerId) throw new Error('Whist game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, winnerTeam: state.winnerTeam, isDraw: false, reason: state.finishReason, gamePoints: [...state.gamePoints] };
  }

  private nextHand(state: WhistGameState, playerId: string, action: WhistAction): DistinctActionResult<WhistResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next hand' };
    if (!hasExactActionShape(action, 'next_whist_hand', [])) return { valid: false, reason: 'Invalid action' };
    state.dealerIndex = (state.dealerIndex + 1) % 4;
    this.dealHand(state);
    return { valid: true };
  }

  private dealHand(state: WhistGameState): void {
    state.handNumber += 1;
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    this.shuffleCards(createStandardDeck()).forEach((card, index) => {
      state.hands[state.players[(state.dealerIndex + 1 + index) % 4].id].push(card);
    });
    const dealerId = state.players[state.dealerIndex].id;
    state.trumpCard = { ...state.hands[dealerId][12] };
    state.trumpSuit = state.trumpCard.suit;
    state.trick = []; state.teamTricks = [0, 0];
    state.currentTurnId = state.players[(state.dealerIndex + 1) % 4].id;
    state.leaderId = state.currentTurnId; state.phase = 'playing';
  }

  private completeHand(state: WhistGameState): DistinctActionResult<WhistResult> {
    const scoringTeam = state.teamTricks[0] > 6 ? 0 : 1;
    const oddPoints: [number, number] = [0, 0];
    oddPoints[scoringTeam] = state.teamTricks[scoringTeam] - 6;
    state.gamePoints[scoringTeam] += oddPoints[scoringTeam];
    state.lastHand = { handNumber: state.handNumber, tricks: [...state.teamTricks], oddPoints };
    if (state.gamePoints[scoringTeam] >= 5) {
      state.phase = 'finished'; state.winnerTeam = scoringTeam;
      state.winnerId = state.players.find((player) => player.team === scoringTeam)!.id;
      state.finishReason = 'five_points';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'hand_complete'; state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private legalCards(state: WhistGameState, playerId: string): StandardCard[] {
    const hand = state.hands[playerId];
    if (state.trick.length === 0) return hand;
    const following = hand.filter((card) => card.suit === state.trick[0].card.suit);
    return following.length > 0 ? following : hand;
  }

  private trickWinner(state: WhistGameState): string {
    const leadSuit = state.trick[0].card.suit;
    const contenders = state.trick.some((entry) => entry.card.suit === state.trumpSuit)
      ? state.trick.filter((entry) => entry.card.suit === state.trumpSuit)
      : state.trick.filter((entry) => entry.card.suit === leadSuit);
    return contenders.slice(1).reduce((highest, entry) => this.rankValue(entry.card) > this.rankValue(highest.card) ? entry : highest, contenders[0]).playerId;
  }

  private rankValue(card: StandardCard): number { return RANKS.indexOf(card.rank as typeof RANKS[number]) + 2; }
  private nextPlayerId(state: WhistGameState, playerId: string): string { const index = state.players.findIndex((player) => player.id === playerId); return state.players[(index + 1) % 4].id; }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length !== 4 || new Set(playerIds).size !== 4) throw new Error('Whist requires exactly four distinct players'); }
}
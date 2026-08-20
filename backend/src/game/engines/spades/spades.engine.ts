import type { SpadesAction, SpadesGameState, SpadesPlayerView, SpadesResult, StandardCard } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class SpadesEngine implements DistinctGameAdapter<SpadesGameState, SpadesAction, SpadesPlayerView, SpadesResult> {
  readonly key = 'spades' as const;
  readonly rulesetId = 'spades.partnership-500.v1';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): SpadesGameState {
    this.requirePlayers(playerIds);
    const state: SpadesGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })) as SpadesGameState['players'],
      hands: {}, bids: {}, tricksWon: {}, teamScores: [0, 0], teamBags: [0, 0], trick: [],
      currentTurnId: playerIds[0], leaderId: playerIds[0], roundNumber: 1, spadesBroken: false,
      phase: 'bidding', winnerId: null, winnerTeam: null, isDraw: false, finishReason: null,
    };
    this.dealRound(state);
    return state;
  }

  applyAction(state: SpadesGameState, playerId: string, action: SpadesAction): DistinctActionResult<SpadesResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    return state.phase === 'bidding' ? this.placeBid(state, playerId, action) : this.playCard(state, playerId, action);
  }

  getPlayerView(state: SpadesGameState, playerId: string): SpadesPlayerView {
    const hand = state.hands[playerId] ?? [];
    return {
      gameKey: this.key,
      players: state.players.map((player, index) => ({
        ...player, handCount: state.hands[player.id].length, bid: state.bids[player.id], tricksWon: state.tricksWon[player.id], team: index % 2 as 0 | 1,
      })),
      youId: playerId,
      yourHand: hand.map((card) => ({ ...card })),
      teamScores: [...state.teamScores], teamBags: [...state.teamBags],
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      currentTurnId: state.currentTurnId, leaderId: state.leaderId, roundNumber: state.roundNumber,
      spadesBroken: state.spadesBroken, phase: state.phase, winnerId: state.winnerId,
      winnerTeam: state.winnerTeam, isDraw: state.isDraw,
      canAct: state.phase !== 'finished' && state.currentTurnId === playerId,
      legalCardIds: state.phase === 'playing' && state.currentTurnId === playerId ? this.legalCards(state, playerId).map((card) => card.id) : [],
    };
  }

  surrender(state: SpadesGameState, playerId: string): DistinctActionResult<SpadesResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const playerIndex = state.players.findIndex((player) => player.id === playerId);
    if (playerIndex < 0) return { valid: false, reason: 'Player not found' };
    state.winnerTeam = (1 - (playerIndex % 2)) as 0 | 1;
    state.winnerId = state.players[state.winnerTeam].id;
    state.phase = 'finished'; state.isDraw = false; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: SpadesGameState): SpadesResult {
    if (!state.finishReason) throw new Error('Spades game is not finished');
    return {
      gameKey: this.key, winnerId: state.winnerId, winnerTeam: state.winnerTeam, isDraw: state.isDraw,
      reason: state.finishReason, teamScores: [...state.teamScores], teamBags: [...state.teamBags],
    };
  }

  private placeBid(state: SpadesGameState, playerId: string, action: SpadesAction): DistinctActionResult<SpadesResult> {
    if (!hasExactActionShape(action, 'bid_spades', ['bid']) || !isBoundedInteger(action.bid, 0, 13)) return { valid: false, reason: 'Invalid bid' };
    state.bids[playerId] = action.bid;
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 3) state.currentTurnId = state.players[index + 1].id;
    else { state.phase = 'playing'; state.currentTurnId = state.players[0].id; state.leaderId = state.players[0].id; }
    return { valid: true };
  }

  private playCard(state: SpadesGameState, playerId: string, action: SpadesAction): DistinctActionResult<SpadesResult> {
    if (!hasExactActionShape(action, 'play_card', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid play' };
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!this.legalCards(state, playerId).some((entry) => entry.id === card.id)) return { valid: false, reason: 'Card is not legal' };
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId, card });
    if (card.suit === 'spades') state.spadesBroken = true;
    if (state.trick.length < 4) { state.currentTurnId = this.nextPlayerId(state, playerId); return { valid: true }; }
    const winnerId = this.trickWinner(state);
    state.tricksWon[winnerId] += 1;
    state.trick = []; state.currentTurnId = winnerId; state.leaderId = winnerId;
    if (state.players.some((player) => state.hands[player.id].length > 0)) return { valid: true };
    this.scoreRound(state);
    if (this.finishIfThreshold(state)) return { valid: true, result: this.getResult(state) };
    state.roundNumber += 1; this.dealRound(state);
    return { valid: true };
  }

  private dealRound(state: SpadesGameState): void {
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    deck.forEach((card, index) => state.hands[state.players[index % 4].id].push(card));
    state.bids = Object.fromEntries(state.players.map((player) => [player.id, null]));
    state.tricksWon = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    state.trick = []; state.currentTurnId = state.players[0].id; state.leaderId = state.players[0].id;
    state.spadesBroken = false; state.phase = 'bidding';
  }

  private legalCards(state: SpadesGameState, playerId: string): StandardCard[] {
    const hand = state.hands[playerId];
    if (state.trick.length > 0) {
      const following = hand.filter((card) => card.suit === state.trick[0].card.suit);
      return following.length > 0 ? following : hand;
    }
    if (state.spadesBroken) return hand;
    const nonSpades = hand.filter((card) => card.suit !== 'spades');
    return nonSpades.length > 0 ? nonSpades : hand;
  }

  private trickWinner(state: SpadesGameState): string {
    const leadSuit = state.trick[0].card.suit;
    const contenders = state.trick.some((entry) => entry.card.suit === 'spades')
      ? state.trick.filter((entry) => entry.card.suit === 'spades')
      : state.trick.filter((entry) => entry.card.suit === leadSuit);
    return contenders.slice(1).reduce(
      (highest, entry) => this.rankValue(entry.card) > this.rankValue(highest.card) ? entry : highest,
      contenders[0],
    ).playerId;
  }

  private scoreRound(state: SpadesGameState): void {
    for (const team of [0, 1] as const) {
      const members = state.players.filter((_, index) => index % 2 === team);
      const contract = members.reduce((sum, player) => sum + (state.bids[player.id] || 0), 0);
      const tricks = members.reduce((sum, player) => sum + state.tricksWon[player.id], 0);
      if (tricks >= contract) {
        const bags = tricks - contract;
        state.teamScores[team] += contract * 10 + bags;
        state.teamBags[team] += bags;
      } else state.teamScores[team] -= contract * 10;
      for (const player of members) {
        if (state.bids[player.id] === 0) state.teamScores[team] += state.tricksWon[player.id] === 0 ? 100 : -100;
      }
      const bagPenalties = Math.floor(state.teamBags[team] / 10);
      state.teamScores[team] -= bagPenalties * 100;
      state.teamBags[team] %= 10;
    }
  }

  private finishIfThreshold(state: SpadesGameState): boolean {
    if (!state.teamScores.some((score) => score >= 500 || score <= -200)) return false;
    state.phase = 'finished';
    if (state.teamScores[0] === state.teamScores[1]) { state.winnerId = null; state.winnerTeam = null; state.isDraw = true; }
    else {
      state.winnerTeam = state.teamScores[0] > state.teamScores[1] ? 0 : 1;
      state.winnerId = state.players[state.winnerTeam].id;
      state.isDraw = false;
    }
    state.finishReason = 'score_limit';
    return true;
  }

  private rankValue(card: StandardCard): number {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return ranks.indexOf(card.rank) + 2;
  }

  private nextPlayerId(state: SpadesGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    return state.players[(index + 1) % 4].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 4 || new Set(playerIds).size !== 4) throw new Error('Spades requires exactly four distinct players');
  }
}
import type {
  CardSuit,
  EuchreAction,
  EuchreCall,
  EuchreGameState,
  EuchrePlayerView,
  EuchreResult,
  StandardCard,
} from '../../../shared';
import { CARD_SUITS } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const EUCHRE_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'] as const;

export class EuchreEngine implements DistinctGameAdapter<EuchreGameState, EuchreAction, EuchrePlayerView, EuchreResult> {
  readonly key = 'euchre' as const;
  readonly rulesetId = 'euchre.north-american-24-to-10.v1';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): EuchreGameState {
    this.requirePlayers(playerIds);
    const state: EuchreGameState = {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}`, team: (index % 2) as 0 | 1 })) as EuchreGameState['players'],
      hostId: playerIds[0], hands: {}, kitty: [], dealerIndex: 0,
      upcard: { id: 'c-clubs-9', suit: 'clubs', rank: '9' }, biddingRound: 1, passes: 0,
      makerId: null, makerTeam: null, trumpSuit: null, alone: false, sittingOutId: null,
      activePlayerIds: [...playerIds], currentTurnId: playerIds[1], leaderId: null,
      trick: [], tricksWon: [0, 0], teamScores: [0, 0], handNumber: 0, lastHand: null,
      phase: 'bidding', winnerId: null, winnerTeam: null, isDraw: false, finishReason: null,
    };
    this.dealHand(state);
    return state;
  }

  applyAction(state: EuchreGameState, playerId: string, action: EuchreAction): DistinctActionResult<EuchreResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'hand_complete') return this.nextHand(state, playerId, action);
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (state.phase === 'bidding') return this.makeCall(state, playerId, action);
    if (state.phase === 'dealer_discard') return this.dealerDiscard(state, playerId, action);
    return this.playCard(state, playerId, action);
  }

  getPlayerView(state: EuchreGameState, playerId: string): EuchrePlayerView {
    const canAct = state.phase === 'hand_complete'
      ? playerId === state.hostId
      : state.currentTurnId === playerId && state.sittingOutId !== playerId;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, handCount: state.hands[player.id].length,
        tricksWon: state.tricksWon[player.team], sittingOut: state.sittingOutId === player.id,
      })),
      hostId: state.hostId, youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      dealerId: state.players[state.dealerIndex].id, upcard: { ...state.upcard }, biddingRound: state.biddingRound,
      rejectedSuit: state.biddingRound === 2 ? state.upcard.suit : null,
      makerId: state.makerId, makerTeam: state.makerTeam, trumpSuit: state.trumpSuit, alone: state.alone,
      currentTurnId: state.currentTurnId, leaderId: state.leaderId,
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      teamScores: [...state.teamScores], tricksWon: [...state.tricksWon], handNumber: state.handNumber,
      lastHand: state.lastHand ? { ...state.lastHand, tricks: [...state.lastHand.tricks], points: [...state.lastHand.points] } : null,
      phase: state.phase, winnerId: state.winnerId, winnerTeam: state.winnerTeam, canAct,
      canPass: state.phase === 'bidding' && canAct,
      canOrderUp: state.phase === 'bidding' && state.biddingRound === 1 && canAct,
      legalTrumpSuits: state.phase === 'bidding' && state.biddingRound === 2 && canAct
        ? CARD_SUITS.filter((suit) => suit !== state.upcard.suit)
        : [],
      legalCardIds: state.phase === 'playing' && canAct ? this.legalCards(state, playerId).map((card) => card.id) : [],
      canDiscard: state.phase === 'dealer_discard' && canAct,
    };
  }

  surrender(state: EuchreGameState, playerId: string): DistinctActionResult<EuchreResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };
    state.winnerTeam = (1 - player.team) as 0 | 1;
    state.winnerId = state.players.find((entry) => entry.team === state.winnerTeam)!.id;
    state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: EuchreGameState): EuchreResult {
    if (!state.finishReason || state.winnerTeam === null || !state.winnerId) throw new Error('Euchre game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, winnerTeam: state.winnerTeam, isDraw: false, reason: state.finishReason, teamScores: [...state.teamScores] };
  }

  private makeCall(state: EuchreGameState, playerId: string, action: EuchreAction): DistinctActionResult<EuchreResult> {
    if (!hasExactActionShape(action, 'euchre_call', ['euchreCall']) || !this.isCall(action.euchreCall)) return { valid: false, reason: 'Invalid call' };
    const call = action.euchreCall;
    if (call.type === 'pass') return this.pass(state, playerId);
    if (call.type === 'order_up') {
      if (state.biddingRound !== 1) return { valid: false, reason: 'The upcard can only be ordered in round one' };
      this.setMaker(state, playerId, state.upcard.suit, call.alone);
      const dealerId = state.players[state.dealerIndex].id;
      state.kitty = state.kitty.filter((card) => card.id !== state.upcard.id);
      state.hands[dealerId].push(state.upcard);
      state.phase = 'dealer_discard'; state.currentTurnId = dealerId;
      return { valid: true };
    }
    if (state.biddingRound !== 2 || call.suit === state.upcard.suit) return { valid: false, reason: 'Trump suit is not legal' };
    this.setMaker(state, playerId, call.suit, call.alone);
    this.beginPlay(state);
    return { valid: true };
  }

  private pass(state: EuchreGameState, playerId: string): DistinctActionResult<EuchreResult> {
    state.passes += 1;
    if (state.biddingRound === 1 && state.passes === 4) {
      state.biddingRound = 2; state.passes = 0;
      state.currentTurnId = state.players[(state.dealerIndex + 1) % 4].id;
      return { valid: true };
    }
    if (state.biddingRound === 2 && state.passes === 4) {
      state.dealerIndex = (state.dealerIndex + 1) % 4;
      this.dealHand(state);
      return { valid: true };
    }
    state.currentTurnId = this.nextPlayerId(state, playerId);
    return { valid: true };
  }

  private dealerDiscard(state: EuchreGameState, playerId: string, action: EuchreAction): DistinctActionResult<EuchreResult> {
    if (!hasExactActionShape(action, 'euchre_discard', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid discard' };
    const index = state.hands[playerId].findIndex((card) => card.id === action.cardId);
    if (index < 0) return { valid: false, reason: 'Card not in hand' };
    const [discarded] = state.hands[playerId].splice(index, 1);
    state.kitty.push(discarded);
    this.beginPlay(state);
    return { valid: true };
  }

  private playCard(state: EuchreGameState, playerId: string, action: EuchreAction): DistinctActionResult<EuchreResult> {
    if (!hasExactActionShape(action, 'play_euchre_card', ['cardId']) || typeof action.cardId !== 'string') return { valid: false, reason: 'Invalid play' };
    const card = state.hands[playerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in hand' };
    if (!this.legalCards(state, playerId).some((entry) => entry.id === card.id)) return { valid: false, reason: 'Must follow effective suit' };
    state.hands[playerId] = state.hands[playerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId, card });
    if (state.trick.length < state.activePlayerIds.length) {
      state.currentTurnId = this.nextActiveId(state, playerId);
      return { valid: true };
    }
    const winnerId = this.trickWinner(state);
    const team = state.players.find((player) => player.id === winnerId)!.team;
    state.tricksWon[team] += 1; state.trick = [];
    state.currentTurnId = winnerId; state.leaderId = winnerId;
    if (state.activePlayerIds.some((id) => state.hands[id].length > 0)) return { valid: true };
    return this.completeHand(state);
  }

  private nextHand(state: EuchreGameState, playerId: string, action: EuchreAction): DistinctActionResult<EuchreResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next hand' };
    if (!hasExactActionShape(action, 'next_euchre_hand', [])) return { valid: false, reason: 'Invalid action' };
    state.dealerIndex = (state.dealerIndex + 1) % 4;
    this.dealHand(state);
    return { valid: true };
  }

  private dealHand(state: EuchreGameState): void {
    state.handNumber += 1;
    const deck = this.shuffleCards(createStandardDeck().filter((card) => EUCHRE_RANKS.includes(card.rank as typeof EUCHRE_RANKS[number])));
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    for (const packetSize of [2, 3]) {
      for (let offset = 1; offset <= 4; offset += 1) {
        const playerId = state.players[(state.dealerIndex + offset) % 4].id;
        state.hands[playerId].push(...deck.splice(0, packetSize));
      }
    }
    state.kitty = deck;
    state.upcard = { ...state.kitty[0] };
    state.biddingRound = 1; state.passes = 0; state.makerId = null; state.makerTeam = null;
    state.trumpSuit = null; state.alone = false; state.sittingOutId = null;
    state.activePlayerIds = state.players.map((player) => player.id);
    state.currentTurnId = state.players[(state.dealerIndex + 1) % 4].id;
    state.leaderId = null; state.trick = []; state.tricksWon = [0, 0]; state.phase = 'bidding';
  }

  private setMaker(state: EuchreGameState, playerId: string, trumpSuit: CardSuit, alone: boolean): void {
    const player = state.players.find((entry) => entry.id === playerId)!;
    state.makerId = playerId; state.makerTeam = player.team; state.trumpSuit = trumpSuit; state.alone = alone;
    if (alone) {
      const index = state.players.findIndex((entry) => entry.id === playerId);
      state.sittingOutId = state.players[(index + 2) % 4].id;
      state.activePlayerIds = state.players.map((entry) => entry.id).filter((id) => id !== state.sittingOutId);
    }
  }

  private beginPlay(state: EuchreGameState): void {
    state.phase = 'playing';
    const dealerId = state.players[state.dealerIndex].id;
    state.currentTurnId = this.nextActiveId(state, dealerId);
    state.leaderId = state.currentTurnId;
  }

  private completeHand(state: EuchreGameState): DistinctActionResult<EuchreResult> {
    const makerTeam = state.makerTeam!;
    const defenderTeam = (1 - makerTeam) as 0 | 1;
    const makerTricks = state.tricksWon[makerTeam];
    const points: [number, number] = [0, 0];
    if (makerTricks < 3) points[defenderTeam] = 2;
    else if (makerTricks === 5) points[makerTeam] = state.alone ? 4 : 2;
    else points[makerTeam] = 1;
    state.teamScores[0] += points[0]; state.teamScores[1] += points[1];
    state.lastHand = { makerTeam, makerId: state.makerId!, alone: state.alone, tricks: [...state.tricksWon], points };
    const winningTeam = state.teamScores.findIndex((score) => score >= 10);
    if (winningTeam >= 0) {
      state.phase = 'finished'; state.winnerTeam = winningTeam as 0 | 1;
      state.winnerId = state.players.find((player) => player.team === state.winnerTeam)!.id;
      state.finishReason = 'target_score';
      return { valid: true, result: this.getResult(state) };
    }
    state.phase = 'hand_complete'; state.currentTurnId = state.hostId;
    return { valid: true };
  }

  private legalCards(state: EuchreGameState, playerId: string): StandardCard[] {
    const hand = state.hands[playerId];
    if (state.trick.length === 0) return hand;
    const ledSuit = this.effectiveSuit(state.trick[0].card, state.trumpSuit!);
    const following = hand.filter((card) => this.effectiveSuit(card, state.trumpSuit!) === ledSuit);
    return following.length > 0 ? following : hand;
  }

  private trickWinner(state: EuchreGameState): string {
    const trump = state.trumpSuit!;
    const leadSuit = this.effectiveSuit(state.trick[0].card, trump);
    return state.trick.slice(1).reduce((highest, entry) => {
      const entryPower = this.cardPower(entry.card, trump, leadSuit);
      const highestPower = this.cardPower(highest.card, trump, leadSuit);
      return entryPower > highestPower ? entry : highest;
    }, state.trick[0]).playerId;
  }

  private cardPower(card: StandardCard, trump: CardSuit, leadSuit: CardSuit): number {
    if (card.rank === 'J' && card.suit === trump) return 200;
    if (this.isLeftBower(card, trump)) return 199;
    const suit = this.effectiveSuit(card, trump);
    const rank = EUCHRE_RANKS.indexOf(card.rank as typeof EUCHRE_RANKS[number]);
    if (suit === trump) return 100 + rank;
    if (suit === leadSuit) return rank;
    return -1;
  }

  private effectiveSuit(card: StandardCard, trump: CardSuit): CardSuit {
    return this.isLeftBower(card, trump) ? trump : card.suit;
  }

  private isLeftBower(card: StandardCard, trump: CardSuit): boolean {
    return card.rank === 'J' && card.suit === this.sameColorSuit(trump);
  }

  private sameColorSuit(suit: CardSuit): CardSuit {
    if (suit === 'clubs') return 'spades';
    if (suit === 'spades') return 'clubs';
    if (suit === 'diamonds') return 'hearts';
    return 'diamonds';
  }

  private isCall(call: unknown): call is EuchreCall {
    if (hasExactActionShape(call, 'pass', [])) return true;
    if (hasExactActionShape(call, 'order_up', ['alone'])) return typeof call.alone === 'boolean';
    return hasExactActionShape(call, 'name_trump', ['suit', 'alone'])
      && CARD_SUITS.includes(call.suit as CardSuit) && typeof call.alone === 'boolean';
  }

  private nextActiveId(state: EuchreGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= 4; offset += 1) {
      const candidate = state.players[(index + offset) % 4].id;
      if (state.activePlayerIds.includes(candidate)) return candidate;
    }
    return state.activePlayerIds[0];
  }
  private nextPlayerId(state: EuchreGameState, playerId: string): string { const index = state.players.findIndex((player) => player.id === playerId); return state.players[(index + 1) % 4].id; }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length !== 4 || new Set(playerIds).size !== 4) throw new Error('Euchre requires exactly four distinct players'); }
}
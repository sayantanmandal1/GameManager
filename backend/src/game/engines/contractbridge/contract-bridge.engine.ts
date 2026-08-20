import type {
  BridgeAction,
  BridgeBid,
  BridgeCall,
  BridgeDealSummary,
  BridgeGameState,
  BridgeMode,
  BridgePlayerView,
  BridgeResult,
  BridgeStrain,
  BridgeTeam,
  StandardCard,
} from '../../../shared';
import { BRIDGE_MODES, BRIDGE_STRAINS } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';
import { scoreDuplicateDeal, scoreHomeDeal, scoreRubberDeal } from './bridge-scoring';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];
const SEATS = ['north', 'east', 'south', 'west'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
const DUPLICATE_VULNERABILITY: Array<[boolean, boolean]> = [
  [false, false], [true, false], [false, true], [true, true],
  [true, false], [false, true], [true, true], [false, false],
  [false, true], [true, true], [false, false], [true, false],
  [true, true], [false, false], [true, false], [false, true],
];

export class ContractBridgeEngine implements DistinctGameAdapter<BridgeGameState, BridgeAction, BridgePlayerView, BridgeResult> {
  readonly key = 'contract-bridge' as const;
  readonly rulesetId = 'contract-bridge.acbl-rubber-duplicate-home.v1';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): BridgeGameState {
    this.requirePlayers(playerIds);
    const players = playerIds.map((id, index) => ({
      id,
      name: playerNames[id] || `Player ${index + 1}`,
      seat: SEATS[index],
      team: (index % 2) as BridgeTeam,
    })) as BridgeGameState['players'];
    return {
      players,
      hostId: playerIds[0],
      mode: null,
      hands: Object.fromEntries(playerIds.map((id) => [id, [] as StandardCard[]])),
      dealerIndex: 0,
      dealNumber: 0,
      vulnerability: [false, false],
      auction: [],
      highestBid: null,
      doubling: 'undoubled',
      consecutivePasses: 0,
      contract: null,
      trick: [],
      tricksWon: [0, 0],
      currentTurnId: playerIds[0],
      leaderId: null,
      dummyRevealed: false,
      sessionScores: [0, 0],
      rubber: { belowLine: [0, 0], gamesWon: [0, 0], vulnerable: [false, false] },
      dealHistory: [],
      pendingHonorBonus: null,
      phase: 'setup',
      winnerId: null,
      winnerTeam: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: BridgeGameState,
    playerId: string,
    action: BridgeAction,
  ): DistinctActionResult<BridgeResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.phase === 'setup') return this.selectMode(state, playerId, action);
    if (state.phase === 'auction') return this.makeCall(state, playerId, action);
    if (state.phase === 'opening_lead' || state.phase === 'playing') {
      return this.playCard(state, playerId, action);
    }
    if (state.phase === 'deal_complete') return this.nextDeal(state, playerId, action);
    return { valid: false, reason: 'Invalid game phase' };
  }

  getPlayerView(state: BridgeGameState, playerId: string): BridgePlayerView {
    const contract = state.contract;
    const currentActorId = this.currentActorId(state);
    const canAct = this.canPlayerAct(state, playerId, currentActorId);
    const actingAsDummy = canAct && !!contract && state.currentTurnId === contract.dummyId;
    const legalCards = canAct && (state.phase === 'opening_lead' || state.phase === 'playing')
      ? this.legalCards(state, state.currentTurnId!)
      : [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player,
        handCount: state.hands[player.id].length,
        tricksWon: state.tricksWon[player.team],
      })),
      hostId: state.hostId,
      youId: playerId,
      mode: state.mode,
      phase: state.phase,
      dealerId: state.players[state.dealerIndex].id,
      dealNumber: state.dealNumber,
      vulnerability: [...state.vulnerability],
      auction: state.auction.map((entry) => ({ playerId: entry.playerId, call: { ...entry.call } })),
      contract: contract ? { ...contract } : null,
      trick: state.trick.map((entry) => ({ playerId: entry.playerId, card: { ...entry.card } })),
      tricksWon: [...state.tricksWon],
      currentTurnId: state.currentTurnId,
      currentActorId,
      leaderId: state.leaderId,
      dummyRevealed: state.dummyRevealed,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      dummyHand: state.dummyRevealed && contract
        ? state.hands[contract.dummyId].map((card) => ({ ...card }))
        : [],
      sessionScores: [...state.sessionScores],
      rubber: {
        belowLine: [...state.rubber.belowLine],
        gamesWon: [...state.rubber.gamesWon],
        vulnerable: [...state.rubber.vulnerable],
      },
      dealHistory: state.dealHistory.map((summary) => this.cloneDealSummary(summary)),
      canAct,
      legalModes: state.phase === 'setup' && playerId === state.hostId ? [...BRIDGE_MODES] : [],
      legalBids: canAct && state.phase === 'auction' ? this.legalBids(state) : [],
      canPass: canAct && state.phase === 'auction',
      canDouble: canAct && state.phase === 'auction' && this.canDouble(state, playerId),
      canRedouble: canAct && state.phase === 'auction' && this.canRedouble(state, playerId),
      legalCardIds: legalCards.map((card) => card.id),
      actingHand: canAct && (state.phase === 'opening_lead' || state.phase === 'playing')
        ? (actingAsDummy ? 'dummy' : 'own')
        : null,
      winnerId: state.winnerId,
      winnerTeam: state.winnerTeam,
      isDraw: state.isDraw,
    };
  }

  surrender(state: BridgeGameState, playerId: string): DistinctActionResult<BridgeResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };
    state.winnerTeam = (1 - player.team) as BridgeTeam;
    state.winnerId = state.players.find((entry) => entry.team === state.winnerTeam)!.id;
    state.phase = 'finished';
    state.finishReason = 'surrender';
    state.isDraw = false;
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: BridgeGameState): BridgeResult {
    if (!state.finishReason) throw new Error('Bridge session is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      winnerTeam: state.winnerTeam,
      isDraw: state.isDraw,
      reason: state.finishReason,
      mode: state.mode,
      sessionScores: [...state.sessionScores],
    };
  }

  private selectMode(
    state: BridgeGameState,
    playerId: string,
    action: BridgeAction,
  ): DistinctActionResult<BridgeResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can select the mode' };
    if (!hasExactActionShape(action, 'select_bridge_mode', ['mode'])
      || !BRIDGE_MODES.includes(action.mode as BridgeMode)) {
      return { valid: false, reason: 'Invalid Bridge mode' };
    }
    state.mode = action.mode as BridgeMode;
    this.startDeal(state);
    return { valid: true };
  }

  private makeCall(
    state: BridgeGameState,
    playerId: string,
    action: BridgeAction,
  ): DistinctActionResult<BridgeResult> {
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'bridge_call', ['call']) || !this.isLegalCallShape(action.call)) {
      return { valid: false, reason: 'Invalid call' };
    }
    const call = action.call;
    if (call.type === 'bid' && !this.isHigherBid(call, state.highestBid)) {
      return { valid: false, reason: 'Bid must outrank the current contract' };
    }
    if (call.type === 'double' && !this.canDouble(state, playerId)) {
      return { valid: false, reason: 'Double is not legal' };
    }
    if (call.type === 'redouble' && !this.canRedouble(state, playerId)) {
      return { valid: false, reason: 'Redouble is not legal' };
    }

    state.auction.push({ playerId, call: { ...call } });
    if (call.type === 'pass') {
      state.consecutivePasses += 1;
    } else {
      state.consecutivePasses = 0;
      if (call.type === 'bid') {
        state.highestBid = {
          level: call.level,
          strain: call.strain,
          bidderId: playerId,
          bidderTeam: this.playerTeam(state, playerId),
        };
        state.doubling = 'undoubled';
      } else {
        state.doubling = call.type === 'double' ? 'doubled' : 'redoubled';
      }
    }

    if (!state.highestBid && state.consecutivePasses === 4) {
      this.completePassedOutDeal(state);
      return { valid: true };
    }
    if (state.highestBid && state.consecutivePasses === 3) {
      this.finalizeContract(state);
      return { valid: true };
    }
    state.currentTurnId = this.nextPlayerId(state, playerId);
    return { valid: true };
  }

  private playCard(
    state: BridgeGameState,
    playerId: string,
    action: BridgeAction,
  ): DistinctActionResult<BridgeResult> {
    const actorId = this.currentActorId(state);
    if (actorId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'play_bridge_card', ['cardId']) || typeof action.cardId !== 'string') {
      return { valid: false, reason: 'Invalid play' };
    }
    const handOwnerId = state.currentTurnId!;
    const card = state.hands[handOwnerId].find((entry) => entry.id === action.cardId);
    if (!card) return { valid: false, reason: 'Card not in controlled hand' };
    if (!this.legalCards(state, handOwnerId).some((entry) => entry.id === card.id)) {
      return { valid: false, reason: 'Must follow suit' };
    }

    state.hands[handOwnerId] = state.hands[handOwnerId].filter((entry) => entry.id !== card.id);
    state.trick.push({ playerId: handOwnerId, card });
    if (state.phase === 'opening_lead') {
      state.phase = 'playing';
      state.dummyRevealed = true;
    }
    if (state.trick.length < 4) {
      state.currentTurnId = this.nextPlayerId(state, handOwnerId);
      return { valid: true };
    }

    const winnerId = this.trickWinner(state);
    state.tricksWon[this.playerTeam(state, winnerId)] += 1;
    state.trick = [];
    state.leaderId = winnerId;
    state.currentTurnId = winnerId;
    if (state.players.some((player) => state.hands[player.id].length > 0)) return { valid: true };
    const result = this.scoreCompletedDeal(state);
    return result ? { valid: true, result } : { valid: true };
  }

  private nextDeal(
    state: BridgeGameState,
    playerId: string,
    action: BridgeAction,
  ): DistinctActionResult<BridgeResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can start the next deal' };
    if (!hasExactActionShape(action, 'next_bridge_deal', [])) {
      return { valid: false, reason: 'Invalid action' };
    }
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    this.startDeal(state);
    return { valid: true };
  }

  private startDeal(state: BridgeGameState): void {
    state.dealNumber += 1;
    const deck = this.shuffleCards(createStandardDeck());
    state.hands = Object.fromEntries(state.players.map((player) => [player.id, [] as StandardCard[]]));
    deck.forEach((card, index) => {
      const recipient = state.players[(state.dealerIndex + 1 + index) % state.players.length];
      state.hands[recipient.id].push(card);
    });
    state.vulnerability = this.dealVulnerability(state);
    state.auction = [];
    state.highestBid = null;
    state.doubling = 'undoubled';
    state.consecutivePasses = 0;
    state.contract = null;
    state.trick = [];
    state.tricksWon = [0, 0];
    state.currentTurnId = state.players[state.dealerIndex].id;
    state.leaderId = null;
    state.dummyRevealed = false;
    state.pendingHonorBonus = null;
    state.phase = 'auction';
  }

  private finalizeContract(state: BridgeGameState): void {
    const highestBid = state.highestBid!;
    const declarerEntry = state.auction.find((entry) =>
      entry.call.type === 'bid'
      && entry.call.strain === highestBid.strain
      && this.playerTeam(state, entry.playerId) === highestBid.bidderTeam,
    )!;
    const declarerIndex = state.players.findIndex((player) => player.id === declarerEntry.playerId);
    const dummyId = state.players[(declarerIndex + 2) % state.players.length].id;
    const openingLeaderId = state.players[(declarerIndex + 1) % state.players.length].id;
    state.contract = {
      level: highestBid.level,
      strain: highestBid.strain,
      doubling: state.doubling,
      declarerId: declarerEntry.playerId,
      dummyId,
      openingLeaderId,
      declaringTeam: highestBid.bidderTeam,
    };
    state.pendingHonorBonus = state.mode === 'rubber'
      ? this.findHonorBonus(state, highestBid.strain)
      : null;
    state.phase = 'opening_lead';
    state.currentTurnId = openingLeaderId;
    state.leaderId = openingLeaderId;
  }

  private scoreCompletedDeal(state: BridgeGameState): BridgeResult | null {
    const contract = state.contract!;
    const declarerTeam = contract.declaringTeam;
    const defenderTeam = (1 - declarerTeam) as BridgeTeam;
    const tricksTaken = state.tricksWon[declarerTeam];
    const score: [number, number] = [0, 0];
    let rubberComplete = false;

    if (state.mode === 'duplicate') {
      const breakdown = scoreDuplicateDeal(contract, tricksTaken, state.vulnerability[declarerTeam]);
      score[declarerTeam] += breakdown.declarerScore;
      score[defenderTeam] += breakdown.defenderScore;
    } else if (state.mode === 'home') {
      const breakdown = scoreHomeDeal(contract, tricksTaken);
      score[declarerTeam] += breakdown.declarerScore;
      score[defenderTeam] += breakdown.defenderScore;
    } else {
      const breakdown = scoreRubberDeal(contract, tricksTaken, state.vulnerability[declarerTeam]);
      score[declarerTeam] += breakdown.declarerScore;
      score[defenderTeam] += breakdown.defenderScore;
      if (breakdown.made) {
        state.rubber.belowLine[declarerTeam] += breakdown.contractPoints;
        if (state.rubber.belowLine[declarerTeam] >= 100) {
          state.rubber.gamesWon[declarerTeam] += 1;
          state.rubber.vulnerable[declarerTeam] = true;
          state.rubber.belowLine = [0, 0];
          if (state.rubber.gamesWon[declarerTeam] === 2) {
            score[declarerTeam] += state.rubber.gamesWon[defenderTeam] === 0 ? 700 : 500;
            rubberComplete = true;
          }
        }
      }
      if (state.pendingHonorBonus) {
        score[state.pendingHonorBonus.team] += state.pendingHonorBonus.points;
      }
    }

    state.sessionScores[0] += score[0];
    state.sessionScores[1] += score[1];
    state.dealHistory.push(this.createDealSummary(state, score, false));
    state.currentTurnId = null;
    state.leaderId = null;
    state.pendingHonorBonus = null;
    if (!rubberComplete) {
      state.phase = 'deal_complete';
      return null;
    }

    state.phase = 'finished';
    state.finishReason = 'rubber_complete';
    if (state.sessionScores[0] === state.sessionScores[1]) {
      state.winnerTeam = null;
      state.winnerId = null;
      state.isDraw = true;
    } else {
      state.winnerTeam = state.sessionScores[0] > state.sessionScores[1] ? 0 : 1;
      state.winnerId = state.players.find((player) => player.team === state.winnerTeam)!.id;
      state.isDraw = false;
    }
    return this.getResult(state);
  }

  private completePassedOutDeal(state: BridgeGameState): void {
    state.dealHistory.push(this.createDealSummary(state, [0, 0], true));
    state.currentTurnId = null;
    state.leaderId = null;
    state.phase = 'deal_complete';
  }

  private createDealSummary(
    state: BridgeGameState,
    score: [number, number],
    passedOut: boolean,
  ): BridgeDealSummary {
    return {
      dealNumber: state.dealNumber,
      dealerId: state.players[state.dealerIndex].id,
      vulnerability: [...state.vulnerability],
      contract: state.contract ? { ...state.contract } : null,
      tricksWon: [...state.tricksWon],
      score: [...score],
      passedOut,
    };
  }

  private cloneDealSummary(summary: BridgeDealSummary): BridgeDealSummary {
    return {
      ...summary,
      vulnerability: [...summary.vulnerability],
      contract: summary.contract ? { ...summary.contract } : null,
      tricksWon: [...summary.tricksWon],
      score: [...summary.score],
    };
  }

  private currentActorId(state: BridgeGameState): string | null {
    if (state.phase === 'setup' || state.phase === 'deal_complete') return state.hostId;
    if (!state.currentTurnId) return null;
    if ((state.phase === 'opening_lead' || state.phase === 'playing')
      && state.contract?.dummyId === state.currentTurnId) {
      return state.contract.declarerId;
    }
    return state.currentTurnId;
  }

  private canPlayerAct(state: BridgeGameState, playerId: string, currentActorId: string | null): boolean {
    if (state.phase === 'finished') return false;
    return currentActorId === playerId;
  }

  private legalBids(state: BridgeGameState): BridgeBid[] {
    const currentRank = state.highestBid ? this.bidRank(state.highestBid) : -1;
    const bids: BridgeBid[] = [];
    for (let level = 1; level <= 7; level += 1) {
      for (const strain of BRIDGE_STRAINS) {
        const bid = { level, strain };
        if (this.bidRank(bid) > currentRank) bids.push(bid);
      }
    }
    return bids;
  }

  private legalCards(state: BridgeGameState, handOwnerId: string): StandardCard[] {
    const hand = state.hands[handOwnerId];
    if (state.trick.length === 0) return hand;
    const ledSuit = state.trick[0].card.suit;
    const following = hand.filter((card) => card.suit === ledSuit);
    return following.length > 0 ? following : hand;
  }

  private trickWinner(state: BridgeGameState): string {
    const ledSuit = state.trick[0].card.suit;
    const trump = state.contract!.strain;
    const contenders = trump !== 'notrump' && state.trick.some((entry) => entry.card.suit === trump)
      ? state.trick.filter((entry) => entry.card.suit === trump)
      : state.trick.filter((entry) => entry.card.suit === ledSuit);
    return contenders.slice(1).reduce((highest, entry) =>
      this.rankValue(entry.card) > this.rankValue(highest.card) ? entry : highest,
    contenders[0]).playerId;
  }

  private findHonorBonus(
    state: BridgeGameState,
    strain: BridgeStrain,
  ): { team: BridgeTeam; points: number } | null {
    for (const player of state.players) {
      const hand = state.hands[player.id];
      if (strain === 'notrump') {
        if (hand.filter((card) => card.rank === 'A').length === 4) return { team: player.team, points: 150 };
        continue;
      }
      const honors = hand.filter((card) =>
        card.suit === strain && ['10', 'J', 'Q', 'K', 'A'].includes(card.rank),
      ).length;
      if (honors === 5) return { team: player.team, points: 150 };
      if (honors === 4) return { team: player.team, points: 100 };
    }
    return null;
  }

  private dealVulnerability(state: BridgeGameState): [boolean, boolean] {
    if (state.mode === 'duplicate') {
      return [...DUPLICATE_VULNERABILITY[(state.dealNumber - 1) % 16]];
    }
    if (state.mode === 'rubber') return [...state.rubber.vulnerable];
    return [false, false];
  }

  private canDouble(state: BridgeGameState, playerId: string): boolean {
    return !!state.highestBid
      && state.doubling === 'undoubled'
      && state.highestBid.bidderTeam !== this.playerTeam(state, playerId);
  }

  private canRedouble(state: BridgeGameState, playerId: string): boolean {
    return !!state.highestBid
      && state.doubling === 'doubled'
      && state.highestBid.bidderTeam === this.playerTeam(state, playerId);
  }

  private isLegalCallShape(call: unknown): call is BridgeCall {
    if (hasExactActionShape(call, 'pass', [])) return true;
    if (hasExactActionShape(call, 'double', [])) return true;
    if (hasExactActionShape(call, 'redouble', [])) return true;
    return hasExactActionShape(call, 'bid', ['level', 'strain'])
      && isBoundedInteger(call.level, 1, 7)
      && BRIDGE_STRAINS.includes(call.strain as BridgeStrain);
  }

  private isHigherBid(bid: BridgeBid, current: BridgeBid | null): boolean {
    return !current || this.bidRank(bid) > this.bidRank(current);
  }

  private bidRank(bid: BridgeBid): number {
    return (bid.level - 1) * BRIDGE_STRAINS.length + BRIDGE_STRAINS.indexOf(bid.strain);
  }

  private rankValue(card: StandardCard): number {
    return RANKS.indexOf(card.rank) + 2;
  }

  private playerTeam(state: BridgeGameState, playerId: string): BridgeTeam {
    return state.players.find((player) => player.id === playerId)!.team;
  }

  private nextPlayerId(state: BridgeGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    return state.players[(index + 1) % state.players.length].id;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 4 || new Set(playerIds).size !== 4) {
      throw new Error('Contract Bridge requires exactly four distinct players');
    }
  }
}
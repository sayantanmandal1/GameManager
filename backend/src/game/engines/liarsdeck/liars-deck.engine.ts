import { randomInt } from 'node:crypto';
import type {
  LiarsDeckAction, LiarsDeckCard, LiarsDeckGameState, LiarsDeckPlayerView,
  LiarsDeckResult, LiarsDeckTableRank,
} from '../../../shared';
import { liarsDeckRevealDurationMs } from '../../../shared';
import type { DistinctActionResult, DistinctAutomaticAction, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { secureShuffle } from '../standard-cards';

const TABLE_RANKS: LiarsDeckTableRank[] = ['A', 'K', 'Q'];

export class LiarsDeckEngine implements DistinctGameAdapter<LiarsDeckGameState, LiarsDeckAction, LiarsDeckPlayerView, LiarsDeckResult> {
  readonly key = 'liars-deck' as const;
  readonly rulesetId = 'liars-deck.classic-devil-deal.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(
    private readonly shuffle: (cards: LiarsDeckCard[]) => LiarsDeckCard[] = secureShuffle,
    private readonly chamber: () => number = () => randomInt(1, 7),
    private readonly table: () => LiarsDeckTableRank = () => TABLE_RANKS[randomInt(0, 3)],
  ) {}

  initGame(playerIds: string[], names: Record<string, string>): LiarsDeckGameState {
    if (playerIds.length < 2 || playerIds.length > 4 || new Set(playerIds).size !== playerIds.length) {
      throw new Error("Liar's Deck requires two to four distinct players");
    }
    return {
      players: playerIds.map((id, index) => ({ id, name: names[id] || `Player ${index + 1}` })),
      hostId: playerIds[0], mode: null, phase: 'setup',
      hands: Object.fromEntries(playerIds.map((id) => [id, []])),
      chambers: Object.fromEntries(playerIds.map((id) => [id, this.chamber()])),
      pulls: Object.fromEntries(playerIds.map((id) => [id, 0])),
      eliminatedIds: [], tableRank: 'A', pile: [], pendingClaim: null,
      currentTurnId: playerIds[0], round: 0, lastReveal: null,
      winnerId: null, finishReason: null,
    };
  }

  applyAction(state: LiarsDeckGameState, playerId: string, action: LiarsDeckAction): DistinctActionResult<LiarsDeckResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (!action || typeof action !== 'object' || Array.isArray(action)) return { valid: false, reason: 'Invalid action' };
    if (action.type === 'select_liars_deck_mode') {
      if (!hasExactActionShape(action, 'select_liars_deck_mode', ['mode'])
        || (action.mode !== 'classic' && action.mode !== 'devil')) return { valid: false, reason: 'Invalid mode' };
      if (state.phase !== 'setup' || playerId !== state.hostId) return { valid: false, reason: 'Only the host can choose the mode before play' };
      state.mode = action.mode;
      this.deal(state);
      return { valid: true };
    }
    if (action.type === 'next_liars_deck_round') {
      if (!hasExactActionShape(action, 'next_liars_deck_round', [])
        || state.phase !== 'reveal' || playerId !== state.hostId) return { valid: false, reason: 'Only the host can advance a revealed round' };
      this.deal(state);
      return { valid: true };
    }
    if (state.phase !== 'playing') return { valid: false, reason: 'Wait for the next round' };
    if (state.currentTurnId !== playerId || state.eliminatedIds.includes(playerId)) return { valid: false, reason: 'Not your turn' };
    if (action.type === 'call_liars_deck') {
      if (!hasExactActionShape(action, 'call_liars_deck', [])) return { valid: false, reason: 'Invalid action' };
      return this.challenge(state, playerId);
    }
    if (action.type === 'devils_deal') {
      if (!hasExactActionShape(action, 'devils_deal', [])) return { valid: false, reason: 'Invalid action' };
      if (this.forcedChallenge(state)) return { valid: false, reason: 'The last hand must challenge the previous claim' };
      if (!this.canDevilsDeal(state, playerId)) return { valid: false, reason: "Devil's Deal requires the Devil card and four cards already on the table" };
      const cards = state.pile.slice(-4);
      const successful = cards.every((card) => !this.truthful(card, state.tableRank));
      state.hands[playerId] = state.hands[playerId].filter((card) => card.rank !== 'devil');
      return this.resolve(state, {
        kind: 'devils_deal', callerId: playerId, claimantId: playerId,
        cards, tableRank: state.tableRank, successful,
        riskPlayerIds: successful ? this.activeIds(state).filter((id) => id !== playerId) : [playerId],
        eliminatedIds: [], shots: [],
      });
    }
    if (action.type !== 'play_liars_deck' || !hasExactActionShape(action, 'play_liars_deck', ['cardIds'])) {
      return { valid: false, reason: 'Invalid action' };
    }
    if (this.forcedChallenge(state)) return { valid: false, reason: 'The last hand must challenge the previous claim' };
    if (!Array.isArray(action.cardIds) || action.cardIds.length < 1 || action.cardIds.length > 3
      || action.cardIds.some((id) => typeof id !== 'string')
      || new Set(action.cardIds).size !== action.cardIds.length) return { valid: false, reason: 'Choose one to three distinct cards' };
    const cards = state.hands[playerId].filter((card) => action.cardIds.includes(card.id));
    if (cards.length !== action.cardIds.length) return { valid: false, reason: 'Card is not in your hand' };
    if (cards.some((card) => card.rank === 'devil') && cards.length !== 1) return { valid: false, reason: 'The Devil card must be played alone' };
    state.hands[playerId] = state.hands[playerId].filter((card) => !action.cardIds.includes(card.id));
    state.pile.push(...cards);
    state.pendingClaim = { playerId, cards };
    state.currentTurnId = this.nextWithCards(state, playerId);
    return { valid: true };
  }

  getPlayerView(state: LiarsDeckGameState, playerId: string): LiarsDeckPlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId && !state.eliminatedIds.includes(playerId);
    const forcedChallenge = canAct && this.forcedChallenge(state);
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, handCount: state.hands[player.id].length,
        pulls: state.pulls[player.id], active: !state.eliminatedIds.includes(player.id),
      })),
      hostId: state.hostId, mode: state.mode, phase: state.phase, youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      tableRank: state.tableRank, pileCount: state.pile.length,
      pendingClaim: state.pendingClaim ? { playerId: state.pendingClaim.playerId, count: state.pendingClaim.cards.length } : null,
      currentTurnId: state.currentTurnId, round: state.round,
      lastReveal: state.lastReveal ? {
        ...state.lastReveal, cards: state.lastReveal.cards.map((card) => ({ ...card })),
        riskPlayerIds: [...state.lastReveal.riskPlayerIds], eliminatedIds: [...state.lastReveal.eliminatedIds],
        shots: (state.lastReveal.shots ?? []).map((shot) => ({ ...shot })),
      } : null,
      canAct: state.phase === 'setup' ? playerId === state.hostId : canAct,
      canChallenge: canAct && !!state.pendingClaim && state.pendingClaim.playerId !== playerId,
      canPlay: canAct && !forcedChallenge && state.hands[playerId].length > 0,
      canDevilsDeal: canAct && !forcedChallenge && this.canDevilsDeal(state, playerId),
      forcedChallenge, winnerId: state.winnerId,
    };
  }

  getAutomaticAction(state: LiarsDeckGameState): DistinctAutomaticAction | null {
    if (state.phase === 'reveal') return { playerId: state.hostId, action: { type: 'next_liars_deck_round' }, delayMs: this.revealDelay(state) };
    if (state.phase === 'playing' && this.forcedChallenge(state)) {
      return { playerId: state.currentTurnId, action: { type: 'call_liars_deck' }, delayMs: randomInt(1_500, 3_001) };
    }
    return null;
  }

  surrender(state: LiarsDeckGameState, playerId: string): DistinctActionResult<LiarsDeckResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (state.eliminatedIds.includes(playerId)) return { valid: false, reason: 'Player already eliminated' };
    state.eliminatedIds.push(playerId);
    state.hands[playerId] = [];
    if (this.activeIds(state).length === 1) return this.finish(state, 'surrender');
    if (state.hostId === playerId) state.hostId = this.activeIds(state)[0];
    if (state.currentTurnId === playerId) state.currentTurnId = this.nextActive(state, playerId);
    if (state.phase === 'playing') {
      state.pendingClaim = null;
      state.lastReveal = null;
      state.phase = 'reveal';
    }
    return { valid: true };
  }

  getResult(state: LiarsDeckGameState): LiarsDeckResult {
    if (!state.winnerId || !state.finishReason) throw new Error("Liar's Deck game is not finished");
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason, rounds: state.round };
  }

  private challenge(state: LiarsDeckGameState, playerId: string): DistinctActionResult<LiarsDeckResult> {
    const claim = state.pendingClaim;
    if (!claim || claim.playerId === playerId) return { valid: false, reason: 'There is no opposing claim to challenge' };
    const devil = claim.cards.length === 1 && claim.cards[0].rank === 'devil';
    const successful = !claim.cards.every((card) => this.truthful(card, state.tableRank));
    const riskPlayerIds = devil
      ? this.activeIds(state).filter((id) => id !== claim.playerId && state.hands[id].length > 0)
      : [successful ? claim.playerId : playerId];
    return this.resolve(state, {
      kind: devil ? 'devil' : 'challenge', callerId: playerId, claimantId: claim.playerId,
      cards: claim.cards, tableRank: state.tableRank, successful: devil || successful,
      riskPlayerIds, eliminatedIds: [], shots: [],
    });
  }

  private resolve(state: LiarsDeckGameState, reveal: NonNullable<LiarsDeckGameState['lastReveal']>): DistinctActionResult<LiarsDeckResult> {
    for (const id of reveal.riskPlayerIds) {
      state.pulls[id] += 1;
      const fired = state.pulls[id] >= state.chambers[id];
      reveal.shots.push({ playerId: id, pull: state.pulls[id], fired });
      if (fired) {
        state.eliminatedIds.push(id);
        state.hands[id] = [];
        reveal.eliminatedIds.push(id);
      }
    }
    state.lastReveal = reveal;
    if (this.activeIds(state).length === 1) return this.finish(state, 'last_player');
    const starter = reveal.riskPlayerIds[0] ?? reveal.callerId;
    state.currentTurnId = state.eliminatedIds.includes(starter) ? this.nextActive(state, starter) : starter;
    state.phase = 'reveal';
    return { valid: true };
  }

  private revealDelay(state: LiarsDeckGameState): number {
    return state.lastReveal ? liarsDeckRevealDurationMs(state.lastReveal.shots?.length ?? 0) : 5_000;
  }

  private deal(state: LiarsDeckGameState): void {
    state.tableRank = this.table();
    const deck: LiarsDeckCard[] = TABLE_RANKS.flatMap((rank) => Array.from({ length: 6 }, (_, index) => ({ id: `${rank}-${index}`, rank })));
    deck.push({ id: 'joker-0', rank: 'joker' }, { id: 'joker-1', rank: 'joker' });
    if (state.mode === 'devil') {
      const index = deck.findIndex((card) => card.rank === state.tableRank);
      deck[index] = { id: 'devil', rank: 'devil' };
    }
    const shuffled = this.shuffle(deck);
    for (const player of state.players) state.hands[player.id] = [];
    const active = this.activeIds(state);
    for (let cardIndex = 0; cardIndex < 5; cardIndex += 1) {
      for (let index = 0; index < active.length; index += 1) {
        state.hands[active[index]].push(shuffled[cardIndex * active.length + index]);
      }
    }
    state.round += 1;
    state.pile = [];
    state.pendingClaim = null;
    state.phase = 'playing';
  }

  private truthful(card: LiarsDeckCard, tableRank: LiarsDeckTableRank): boolean {
    return card.rank === tableRank || card.rank === 'joker' || card.rank === 'devil';
  }

  private canDevilsDeal(state: LiarsDeckGameState, playerId: string): boolean {
    return state.mode === 'devil' && state.pile.length >= 4
      && state.hands[playerId].some((card) => card.rank === 'devil');
  }

  private forcedChallenge(state: LiarsDeckGameState): boolean {
    return !!state.pendingClaim && state.pendingClaim.playerId !== state.currentTurnId
      && this.activeIds(state).filter((id) => state.hands[id].length > 0).length === 1;
  }

  private nextWithCards(state: LiarsDeckGameState, playerId: string): string {
    const start = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const id = state.players[(start + offset) % state.players.length].id;
      if (!state.eliminatedIds.includes(id) && state.hands[id].length > 0) return id;
    }
    throw new Error('No remaining hand to challenge');
  }

  private nextActive(state: LiarsDeckGameState, playerId: string): string {
    const start = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const id = state.players[(start + offset) % state.players.length].id;
      if (!state.eliminatedIds.includes(id)) return id;
    }
    throw new Error('No active player');
  }

  private activeIds(state: LiarsDeckGameState): string[] {
    return state.players.filter((player) => !state.eliminatedIds.includes(player.id)).map((player) => player.id);
  }

  private finish(state: LiarsDeckGameState, reason: 'last_player' | 'surrender'): DistinctActionResult<LiarsDeckResult> {
    state.winnerId = this.activeIds(state)[0];
    state.finishReason = reason;
    state.phase = 'finished';
    return { valid: true, result: this.getResult(state) };
  }
}

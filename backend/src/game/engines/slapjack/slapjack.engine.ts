import type { SlapjackAction, SlapjackGameState, SlapjackPlayerView, SlapjackResult, StandardCard } from '../../../shared';
import type { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class SlapjackEngine implements DistinctGameAdapter<SlapjackGameState, SlapjackAction, SlapjackPlayerView, SlapjackResult> {
  readonly key = 'slapjack' as const;
  readonly rulesetId = 'slapjack.standard-reaction-window.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): SlapjackGameState {
    this.requirePlayers(playerIds);
    const stacks = Object.fromEntries(playerIds.map((id) => [id, [] as StandardCard[]]));
    this.shuffleCards(createStandardDeck()).forEach((card, index) => stacks[playerIds[index % playerIds.length]].push(card));
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      stacks, pile: [], currentTurnId: playerIds[0], topPlayerId: null,
      eliminatedIds: [], lastChanceIds: [], phase: 'playing', winnerId: null,
      isDraw: false, finishReason: null,
    };
  }

  applyAction(state: SlapjackGameState, playerId: string, action: SlapjackAction): DistinctActionResult<SlapjackResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (action.type === 'slap_jack') return this.slap(state, playerId, action);
    if (action.type === 'continue_slapjack') return this.continueAfterJack(state, playerId, action);
    return this.flip(state, playerId, action);
  }

  getPlayerView(state: SlapjackGameState, playerId: string): SlapjackPlayerView {
    const eliminated = state.eliminatedIds.includes(playerId);
    const canFlip = state.phase === 'playing' && state.currentTurnId === playerId && !eliminated && state.stacks[playerId].length > 0;
    const canSlap = state.pile.length > 0 && !eliminated;
    const canContinue = state.phase === 'slap_window' && state.currentTurnId === playerId && !eliminated;
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({
        ...player, cardCount: state.stacks[player.id].length,
        eliminated: state.eliminatedIds.includes(player.id), lastChance: state.lastChanceIds.includes(player.id),
      })),
      youId: playerId, pileCount: state.pile.length,
      topCard: state.pile.length > 0 ? { ...state.pile[state.pile.length - 1].card } : null,
      topPlayerId: state.topPlayerId, currentTurnId: state.currentTurnId,
      phase: state.phase, winnerId: state.winnerId,
      canAct: canFlip || canSlap || canContinue,
      canFlip, canSlap, canContinue,
    };
  }

  surrender(state: SlapjackGameState, playerId: string): DistinctActionResult<SlapjackResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const winnerId = state.players.find((player) => player.id !== playerId && !state.eliminatedIds.includes(player.id))?.id
      ?? state.players.find((player) => player.id !== playerId)!.id;
    state.winnerId = winnerId; state.phase = 'finished'; state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: SlapjackGameState): SlapjackResult {
    if (!state.finishReason || !state.winnerId) throw new Error('Slapjack game is not finished');
    return {
      gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason,
      cardCounts: Object.fromEntries(state.players.map((player) => [player.id, state.stacks[player.id].length])),
    };
  }

  private flip(state: SlapjackGameState, playerId: string, action: SlapjackAction): DistinctActionResult<SlapjackResult> {
    if (!hasExactActionShape(action, 'flip_slapjack', [])) return { valid: false, reason: 'Invalid flip' };
    if (state.phase !== 'playing') return { valid: false, reason: 'Resolve the jack before flipping' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    const card = state.stacks[playerId].shift();
    if (!card) return { valid: false, reason: 'No card to flip' };
    state.pile.push({ playerId, card }); state.topPlayerId = playerId;
    if (state.stacks[playerId].length === 0 && !state.lastChanceIds.includes(playerId)) state.lastChanceIds.push(playerId);
    state.currentTurnId = this.nextPlayerWithCards(state, playerId);
    if (card.rank === 'J') state.phase = 'slap_window';
    return { valid: true };
  }

  private slap(state: SlapjackGameState, playerId: string, action: SlapjackAction): DistinctActionResult<SlapjackResult> {
    if (!hasExactActionShape(action, 'slap_jack', [])) return { valid: false, reason: 'Invalid slap' };
    if (state.eliminatedIds.includes(playerId)) return { valid: false, reason: 'Player is eliminated' };
    if (state.pile.length === 0) return { valid: false, reason: 'There is no pile to slap' };
    const top = state.pile[state.pile.length - 1];
    if (state.phase !== 'slap_window' || top.card.rank !== 'J') return this.falseSlap(state, playerId);
    const wonCards = this.shuffleCards(state.pile.map((entry) => entry.card));
    state.stacks[playerId].push(...wonCards);
    state.pile = []; state.topPlayerId = null; state.phase = 'playing';
    state.lastChanceIds = state.lastChanceIds.filter((id) => {
      if (id === playerId) return false;
      if (!state.eliminatedIds.includes(id)) state.eliminatedIds.push(id);
      return false;
    });
    if (state.stacks[playerId].length === 52) return this.finish(state, playerId, 'all_cards');
    const active = state.players.filter((player) => !state.eliminatedIds.includes(player.id));
    if (active.length === 1) return this.finish(state, active[0].id, 'last_active');
    if (state.eliminatedIds.includes(state.currentTurnId) || state.stacks[state.currentTurnId].length === 0) {
      state.currentTurnId = this.nextPlayerWithCards(state, playerId);
    }
    return { valid: true };
  }

  private falseSlap(state: SlapjackGameState, playerId: string): DistinctActionResult<SlapjackResult> {
    const penalty = state.stacks[playerId].shift();
    if (!penalty) return { valid: false, reason: 'No card available for false-slap penalty' };
    state.stacks[state.topPlayerId!].push(penalty);
    if (state.stacks[playerId].length === 0 && !state.lastChanceIds.includes(playerId)) state.lastChanceIds.push(playerId);
    return { valid: true };
  }

  private continueAfterJack(state: SlapjackGameState, playerId: string, action: SlapjackAction): DistinctActionResult<SlapjackResult> {
    if (!hasExactActionShape(action, 'continue_slapjack', [])) return { valid: false, reason: 'Invalid action' };
    if (state.phase !== 'slap_window') return { valid: false, reason: 'There is no open jack window' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Only the next flipper can continue' };
    for (const id of state.lastChanceIds) if (!state.eliminatedIds.includes(id)) state.eliminatedIds.push(id);
    state.lastChanceIds = []; state.phase = 'playing';
    const active = state.players.filter((player) => !state.eliminatedIds.includes(player.id));
    if (active.length === 1) return this.finish(state, active[0].id, 'last_active');
    return { valid: true };
  }

  private finish(state: SlapjackGameState, winnerId: string, reason: 'all_cards' | 'last_active'): DistinctActionResult<SlapjackResult> {
    if (reason === 'last_active' && state.pile.length > 0) {
      state.stacks[winnerId].push(...state.pile.map((entry) => entry.card));
      state.pile = [];
    }
    state.winnerId = winnerId; state.phase = 'finished'; state.finishReason = reason;
    return { valid: true, result: this.getResult(state) };
  }

  private nextPlayerWithCards(state: SlapjackGameState, playerId: string): string {
    const index = state.players.findIndex((player) => player.id === playerId);
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidate = state.players[(index + offset) % state.players.length].id;
      if (!state.eliminatedIds.includes(candidate) && state.stacks[candidate].length > 0) return candidate;
    }
    return playerId;
  }
  private requirePlayers(playerIds: string[]): void { if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) throw new Error('Slapjack requires two to eight distinct players'); }
}
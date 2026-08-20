import { CARD_RANKS, type CardWarAction, type CardWarBattleReveal, type CardWarGameState, type CardWarPlayerView, type CardWarResult, type StandardCard } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape } from '../action-shape';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class CardWarEngine implements DistinctGameAdapter<CardWarGameState, CardWarAction, CardWarPlayerView, CardWarResult> {
  readonly key = 'card-war' as const;
  readonly rulesetId = 'card-war.standard-52-card.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): CardWarGameState {
    this.requirePlayers(playerIds);
    const deck = this.shuffleCards(createStandardDeck());
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })) as CardWarGameState['players'],
      decks: { [playerIds[0]]: deck.slice(0, 26), [playerIds[1]]: deck.slice(26) },
      currentTurnId: playerIds[0],
      battleNumber: 0,
      lastBattle: null,
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: CardWarGameState, playerId: string, action: CardWarAction): DistinctActionResult<CardWarResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!hasExactActionShape(action, 'battle', [])) return { valid: false, reason: 'Invalid battle action' };
    const [firstId, secondId] = state.players.map((player) => player.id);
    if (state.decks[firstId].length === 0 || state.decks[secondId].length === 0) {
      this.finishUnable(state);
      return { valid: true, result: this.getResult(state) };
    }
    const { pot, reveals, winnerId } = this.resolveBattle(state);
    state.battleNumber += 1;
    state.lastBattle = { reveals, winnerId, potSize: pot.length };
    if (!winnerId) {
      state.phase = 'finished';
      state.winnerId = null;
      state.isDraw = true;
      state.finishReason = 'cannot_battle';
      return { valid: true, result: this.getResult(state) };
    }
    state.decks[winnerId].push(...pot);
    const loserId = winnerId === firstId ? secondId : firstId;
    if (state.decks[loserId].length === 0) {
      state.phase = 'finished';
      state.winnerId = winnerId;
      state.finishReason = 'all_cards';
      return { valid: true, result: this.getResult(state) };
    }
    state.currentTurnId = state.players.find((player) => player.id !== playerId)!.id;
    return { valid: true };
  }

  getPlayerView(state: CardWarGameState, playerId: string): CardWarPlayerView {
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, cardCount: state.decks[player.id].length })),
      youId: playerId,
      currentTurnId: state.currentTurnId,
      battleNumber: state.battleNumber,
      lastBattle: state.lastBattle ? {
        winnerId: state.lastBattle.winnerId,
        potSize: state.lastBattle.potSize,
        reveals: state.lastBattle.reveals.map((reveal) => ({ ...reveal, faceUp: reveal.faceUp.map((card) => ({ ...card })) })),
      } : null,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase === 'playing' && state.currentTurnId === playerId,
    };
  }

  surrender(state: CardWarGameState, playerId: string): DistinctActionResult<CardWarResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const opponent = state.players.find((player) => player.id !== playerId);
    if (!opponent || !state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = opponent.id;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: CardWarGameState): CardWarResult {
    if (!state.finishReason) throw new Error('Card War game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      cardCounts: Object.fromEntries(state.players.map((player) => [player.id, state.decks[player.id].length])),
    };
  }

  private drawFaceUp(state: CardWarGameState, pot: StandardCard[], reveals: CardWarBattleReveal[]): [StandardCard, StandardCard] | null {
    const cards = state.players.map((player, index) => {
      const card = state.decks[player.id].shift();
      if (card) {
        pot.push(card);
        reveals[index].faceUp.push(card);
      }
      return card;
    });
    return cards[0] && cards[1] ? [cards[0], cards[1]] : null;
  }

  private resolveBattle(state: CardWarGameState): {
    pot: StandardCard[];
    reveals: CardWarBattleReveal[];
    winnerId: string | null;
  } {
    const playerIds = state.players.map((player) => player.id);
    const pot: StandardCard[] = [];
    const reveals: CardWarBattleReveal[] = playerIds.map((playerId) => ({ playerId, faceUp: [], faceDownCount: 0 }));
    let faceUp = this.drawFaceUp(state, pot, reveals);
    while (faceUp) {
      const comparison = this.rankValue(faceUp[0]) - this.rankValue(faceUp[1]);
      if (comparison !== 0) return { pot, reveals, winnerId: comparison > 0 ? playerIds[0] : playerIds[1] };
      const canContinue = playerIds.map((id, index) => this.prepareWar(state, id, pot, reveals[index]));
      if (!canContinue.every(Boolean)) return { pot, reveals, winnerId: this.winnerWithCardsRemaining(canContinue, playerIds) };
      faceUp = this.drawFaceUp(state, pot, reveals);
    }
    return { pot, reveals, winnerId: null };
  }

  private winnerWithCardsRemaining(canContinue: boolean[], playerIds: string[]): string | null {
    if (canContinue[0] === canContinue[1]) return null;
    return canContinue[0] ? playerIds[0] : playerIds[1];
  }

  private prepareWar(state: CardWarGameState, playerId: string, pot: StandardCard[], reveal: CardWarBattleReveal): boolean {
    const faceDownCount = Math.min(3, Math.max(0, state.decks[playerId].length - 1));
    for (let index = 0; index < faceDownCount; index += 1) pot.push(state.decks[playerId].shift()!);
    reveal.faceDownCount += faceDownCount;
    return state.decks[playerId].length > 0;
  }

  private rankValue(card: StandardCard): number {
    return card.rank === 'A' ? 14 : CARD_RANKS.indexOf(card.rank) + 1;
  }

  private finishUnable(state: CardWarGameState): void {
    const [first, second] = state.players;
    const firstCount = state.decks[first.id].length;
    const secondCount = state.decks[second.id].length;
    state.phase = 'finished';
    state.winnerId = firstCount === secondCount ? null : this.playerWithMoreCards(first.id, firstCount, second.id, secondCount);
    state.isDraw = state.winnerId === null;
    state.finishReason = 'cannot_battle';
  }

  private playerWithMoreCards(firstId: string, firstCount: number, secondId: string, secondCount: number): string {
    return firstCount > secondCount ? firstId : secondId;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) throw new Error('Card War requires exactly two distinct players');
  }
}
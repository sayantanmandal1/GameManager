import {
  CARD_SUITS,
  CardSuit,
  CrazyEightsAction,
  CrazyEightsGameState,
  CrazyEightsPlayerView,
  CrazyEightsResult,
  StandardCard,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { createStandardDeck, secureShuffle } from '../standard-cards';

type CardShuffler = (cards: StandardCard[]) => StandardCard[];

export class CrazyEightsEngine
  implements DistinctGameAdapter<CrazyEightsGameState, CrazyEightsAction, CrazyEightsPlayerView, CrazyEightsResult>
{
  readonly key = 'crazy-eights' as const;
  readonly rulesetId = 'crazy-eights.standard-52-card.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 5;

  constructor(private readonly shuffleCards: CardShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): CrazyEightsGameState {
    this.requirePlayers(playerIds);
    const players = playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` }));
    const hands = Object.fromEntries(playerIds.map((id) => [id, [] as StandardCard[]]));
    const drawPile = this.shuffleCards(createStandardDeck());
    const cardsPerPlayer = playerIds.length === 2 ? 7 : 5;
    for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex += 1) {
      for (const player of players) hands[player.id].push(drawPile.pop()!);
    }
    let firstIndex = drawPile.length - 1;
    while (firstIndex >= 0 && drawPile[firstIndex].rank === '8') firstIndex -= 1;
    const [firstCard] = drawPile.splice(firstIndex, 1);
    return {
      players,
      hands,
      drawPile,
      discardPile: [firstCard],
      activeSuit: firstCard.suit,
      currentTurnId: playerIds[0],
      consecutivePasses: 0,
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: CrazyEightsGameState,
    playerId: string,
    action: CrazyEightsAction,
  ): DistinctActionResult<CrazyEightsResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (action.type === 'play_card') {
      if (typeof action.cardId !== 'string' || action.cardId.length > 24) return { valid: false, reason: 'Invalid card' };
      const cardIndex = state.hands[playerId].findIndex((card) => card.id === action.cardId);
      if (cardIndex < 0) return { valid: false, reason: 'Card not in hand' };
      const card = state.hands[playerId][cardIndex];
      if (!this.isPlayable(state, card)) return { valid: false, reason: 'Card does not match suit or rank' };
      if (card.rank === '8') {
        if (!CARD_SUITS.includes(action.chosenSuit as CardSuit)) return { valid: false, reason: 'An eight must choose a suit' };
      } else if (action.chosenSuit !== undefined) {
        return { valid: false, reason: 'Only an eight can choose a suit' };
      }
      state.hands[playerId].splice(cardIndex, 1);
      state.discardPile.push(card);
      state.activeSuit = card.rank === '8' ? action.chosenSuit! : card.suit;
      state.consecutivePasses = 0;
      if (state.hands[playerId].length === 0) {
        state.phase = 'finished';
        state.winnerId = playerId;
        state.finishReason = 'empty_hand';
        return { valid: true, result: this.getResult(state) };
      }
      this.advanceTurn(state, playerId);
      return { valid: true };
    }

    if (action.type !== 'draw_card') return { valid: false, reason: 'Invalid action' };
    if (this.legalCards(state, playerId).length > 0) return { valid: false, reason: 'A legal card must be played' };
    this.recycleDrawPile(state);
    const drawn = state.drawPile.pop();
    if (drawn) {
      state.hands[playerId].push(drawn);
      state.consecutivePasses = 0;
      if (!this.isPlayable(state, drawn)) this.advanceTurn(state, playerId);
      return { valid: true };
    }

    state.consecutivePasses += 1;
    if (state.consecutivePasses >= state.players.length) {
      this.finishBlocked(state);
      return { valid: true, result: this.getResult(state) };
    }
    this.advanceTurn(state, playerId);
    return { valid: true };
  }

  getPlayerView(state: CrazyEightsGameState, playerId: string): CrazyEightsPlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId;
    const legalCardIds = canAct ? this.legalCards(state, playerId).map((card) => card.id) : [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length })),
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
      topCard: { ...state.discardPile[state.discardPile.length - 1] },
      activeSuit: state.activeSuit,
      drawPileCount: state.drawPile.length,
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct,
      legalCardIds,
      canDraw: canAct && legalCardIds.length === 0,
    };
  }

  surrender(state: CrazyEightsGameState, playerId: string): DistinctActionResult<CrazyEightsResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: CrazyEightsGameState): CrazyEightsResult {
    if (!state.finishReason) throw new Error('Crazy Eights game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      handPoints: Object.fromEntries(state.players.map((player) => [
        player.id,
        state.hands[player.id].reduce((sum, card) => sum + this.cardPoints(card), 0),
      ])),
    };
  }

  private legalCards(state: CrazyEightsGameState, playerId: string): StandardCard[] {
    return state.hands[playerId].filter((card) => this.isPlayable(state, card));
  }

  private isPlayable(state: CrazyEightsGameState, card: StandardCard): boolean {
    const top = state.discardPile[state.discardPile.length - 1];
    return card.rank === '8' || card.suit === state.activeSuit || card.rank === top.rank;
  }

  private recycleDrawPile(state: CrazyEightsGameState): void {
    if (state.drawPile.length > 0 || state.discardPile.length <= 1) return;
    const top = state.discardPile.pop()!;
    state.drawPile = this.shuffleCards(state.discardPile);
    state.discardPile = [top];
  }

  private advanceTurn(state: CrazyEightsGameState, playerId: string): void {
    const index = state.players.findIndex((player) => player.id === playerId);
    state.currentTurnId = state.players[(index + 1) % state.players.length].id;
  }

  private finishBlocked(state: CrazyEightsGameState): void {
    const points = state.players.map((player) => ({ id: player.id, points: state.hands[player.id].reduce((sum, card) => sum + this.cardPoints(card), 0) }));
    const low = Math.min(...points.map((entry) => entry.points));
    const leaders = points.filter((entry) => entry.points === low);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'blocked';
  }

  private cardPoints(card: StandardCard): number {
    if (card.rank === '8') return 50;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    if (card.rank === 'A') return 1;
    return Number(card.rank);
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Crazy Eights requires two to five distinct players');
    }
  }
}
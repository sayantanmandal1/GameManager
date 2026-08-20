import {
  Domino,
  DrawDominoesAction,
  DrawDominoesGameState,
  DrawDominoesPlayerView,
  DrawDominoesResult,
  PlacedDomino,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { secureShuffle } from '../standard-cards';

type DominoShuffler = (dominoes: Domino[]) => Domino[];

export class DrawDominoesEngine
  implements DistinctGameAdapter<DrawDominoesGameState, DrawDominoesAction, DrawDominoesPlayerView, DrawDominoesResult>
{
  readonly key = 'draw-dominoes' as const;
  readonly rulesetId = 'draw-dominoes.double-six.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(private readonly shuffleDominoes: DominoShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): DrawDominoesGameState {
    this.requirePlayers(playerIds);
    const players = playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` }));
    const hands = Object.fromEntries(playerIds.map((id) => [id, [] as Domino[]]));
    const boneyard = this.shuffleDominoes(this.createSet());
    const handSize = playerIds.length === 2 ? 7 : 5;
    for (let tileIndex = 0; tileIndex < handSize; tileIndex += 1) {
      for (const player of players) hands[player.id].push(boneyard.pop()!);
    }
    return {
      players,
      hands,
      boneyard,
      chain: [],
      currentTurnId: playerIds[0],
      consecutivePasses: 0,
      phase: 'playing',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: DrawDominoesGameState,
    playerId: string,
    action: DrawDominoesAction,
  ): DistinctActionResult<DrawDominoesResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (action.type === 'play_domino') {
      if (typeof action.dominoId !== 'string' || (action.end !== 'left' && action.end !== 'right') || typeof action.flip !== 'boolean') {
        return { valid: false, reason: 'Invalid domino play' };
      }
      const dominoIndex = state.hands[playerId].findIndex((domino) => domino.id === action.dominoId);
      if (dominoIndex < 0) return { valid: false, reason: 'Domino not in hand' };
      const domino = state.hands[playerId][dominoIndex];
      const placed: PlacedDomino = {
        ...domino,
        left: action.flip ? domino.b : domino.a,
        right: action.flip ? domino.a : domino.b,
      };
      if (state.chain.length > 0) {
        const [leftEnd, rightEnd] = this.openEnds(state)!;
        if (action.end === 'left' && placed.right !== leftEnd) return { valid: false, reason: 'Domino does not match the left end' };
        if (action.end === 'right' && placed.left !== rightEnd) return { valid: false, reason: 'Domino does not match the right end' };
      }
      state.hands[playerId].splice(dominoIndex, 1);
      if (action.end === 'left') state.chain.unshift(placed);
      else state.chain.push(placed);
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

    if (action.type !== 'draw_domino') return { valid: false, reason: 'Invalid action' };
    if (this.legalPlays(state, playerId).length > 0) return { valid: false, reason: 'A playable domino must be used' };
    const drawn = state.boneyard.pop();
    if (drawn) {
      state.hands[playerId].push(drawn);
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

  getPlayerView(state: DrawDominoesGameState, playerId: string): DrawDominoesPlayerView {
    const canAct = state.phase === 'playing' && state.currentTurnId === playerId;
    const legalPlays = canAct ? this.legalPlays(state, playerId) : [];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player, handCount: state.hands[player.id].length })),
      youId: playerId,
      yourHand: (state.hands[playerId] ?? []).map((domino) => ({ ...domino })),
      boneyardCount: state.boneyard.length,
      chain: state.chain.map((domino) => ({ ...domino })),
      openEnds: this.openEnds(state),
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct,
      legalPlays,
      canDraw: canAct && legalPlays.length === 0,
    };
  }

  surrender(state: DrawDominoesGameState, playerId: string): DistinctActionResult<DrawDominoesResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    const index = state.players.findIndex((player) => player.id === playerId);
    if (index < 0) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = state.players[(index + 1) % state.players.length].id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: DrawDominoesGameState): DrawDominoesResult {
    if (!state.finishReason) throw new Error('Draw Dominoes game is not finished');
    return {
      gameKey: this.key,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      pipSums: Object.fromEntries(state.players.map((player) => [player.id, this.pipSum(state.hands[player.id])])),
    };
  }

  private createSet(): Domino[] {
    const dominoes: Domino[] = [];
    for (let a = 0; a <= 6; a += 1) {
      for (let b = a; b <= 6; b += 1) dominoes.push({ id: `d-${a}-${b}`, a, b });
    }
    return dominoes;
  }

  private openEnds(state: DrawDominoesGameState): [number, number] | null {
    if (state.chain.length === 0) return null;
    return [state.chain[0].left, state.chain[state.chain.length - 1].right];
  }

  private legalPlays(state: DrawDominoesGameState, playerId: string): Array<{ dominoId: string; ends: Array<'left' | 'right'> }> {
    const ends = this.openEnds(state);
    return state.hands[playerId].flatMap((domino) => {
      if (!ends) return [{ dominoId: domino.id, ends: ['left', 'right'] as Array<'left' | 'right'> }];
      const playableEnds: Array<'left' | 'right'> = [];
      if (domino.a === ends[0] || domino.b === ends[0]) playableEnds.push('left');
      if (domino.a === ends[1] || domino.b === ends[1]) playableEnds.push('right');
      return playableEnds.length > 0 ? [{ dominoId: domino.id, ends: playableEnds }] : [];
    });
  }

  private advanceTurn(state: DrawDominoesGameState, playerId: string): void {
    const index = state.players.findIndex((player) => player.id === playerId);
    state.currentTurnId = state.players[(index + 1) % state.players.length].id;
  }

  private finishBlocked(state: DrawDominoesGameState): void {
    const sums = Object.fromEntries(state.players.map((player) => [player.id, this.pipSum(state.hands[player.id])]));
    const low = Math.min(...Object.values(sums));
    const leaders = state.players.filter((player) => sums[player.id] === low);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'blocked';
  }

  private pipSum(hand: Domino[]): number {
    return hand.reduce((sum, domino) => sum + domino.a + domino.b, 0);
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < this.minPlayers || playerIds.length > this.maxPlayers || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Draw Dominoes requires two to four distinct players');
    }
  }
}
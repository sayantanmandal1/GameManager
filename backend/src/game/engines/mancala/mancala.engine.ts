import {
  MancalaAction,
  MancalaGameState,
  MancalaPlayerView,
  MancalaResult,
} from '../../../shared';
import {
  DistinctActionResult,
  DistinctGameAdapter,
  DistinctGamePhase,
} from '../distinct-game.adapter';

const PITS_PER_PLAYER = 6;
const STARTING_STONES = 4;
const RING_SIZE = 14;
const FIRST_STORE = 6;
const SECOND_STORE = 13;

export class MancalaEngine
  implements
    DistinctGameAdapter<
      MancalaGameState,
      MancalaAction,
      MancalaPlayerView,
      MancalaResult
    >
{
  readonly key = 'mancala' as const;
  readonly rulesetId = 'mancala.kalah.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(
    playerIds: string[],
    playerNames: Record<string, string>,
  ): MancalaGameState {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Mancala requires exactly two distinct players');
    }

    return {
      players: [
        {
          id: playerIds[0],
          name: playerNames[playerIds[0]] || 'Player 1',
          side: 0,
        },
        {
          id: playerIds[1],
          name: playerNames[playerIds[1]] || 'Player 2',
          side: 1,
        },
      ],
      pits: [
        Array.from({ length: PITS_PER_PLAYER }, () => STARTING_STONES),
        Array.from({ length: PITS_PER_PLAYER }, () => STARTING_STONES),
      ],
      stores: [0, 0],
      currentTurnId: playerIds[0],
      phase: DistinctGamePhase.PLAYING,
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(
    state: MancalaGameState,
    playerId: string,
    action: MancalaAction,
  ): DistinctActionResult<MancalaResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (state.currentTurnId !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (!this.isPit(action?.pit)) {
      return { valid: false, reason: 'Invalid pit' };
    }

    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return { valid: false, reason: 'Player not found' };
    const side = player.side;
    let stones = state.pits[side][action.pit];
    if (stones === 0) return { valid: false, reason: 'Pit is empty' };

    // SECURITY_NOTE: clients choose only one of their six pits. The server
    // owns every sowed stone, skipped store, capture, and extra-turn decision.
    state.pits[side][action.pit] = 0;
    let ringIndex = this.toRingIndex(side, action.pit);
    const opponentStore = side === 0 ? SECOND_STORE : FIRST_STORE;
    while (stones > 0) {
      ringIndex = (ringIndex + 1) % RING_SIZE;
      if (ringIndex === opponentStore) continue;
      this.addStone(state, ringIndex);
      stones -= 1;
    }

    const landing = this.toPitLocation(ringIndex);
    if (
      landing &&
      landing.side === side &&
      state.pits[side][landing.pit] === 1
    ) {
      const oppositePit = PITS_PER_PLAYER - 1 - landing.pit;
      const captured = state.pits[this.otherSide(side)][oppositePit];
      if (captured > 0) {
        state.pits[side][landing.pit] = 0;
        state.pits[this.otherSide(side)][oppositePit] = 0;
        state.stores[side] += captured + 1;
      }
    }

    if (this.sideIsEmpty(state, 0) || this.sideIsEmpty(state, 1)) {
      return this.sweepAndFinish(state);
    }

    const ownStore = side === 0 ? FIRST_STORE : SECOND_STORE;
    if (ringIndex !== ownStore) {
      state.currentTurnId = state.players[this.otherSide(side)].id;
    }
    return { valid: true };
  }

  getPlayerView(
    state: MancalaGameState,
    playerId: string,
  ): MancalaPlayerView {
    const player = state.players.find((candidate) => candidate.id === playerId);
    const canAct =
      state.phase === DistinctGamePhase.PLAYING &&
      state.currentTurnId === playerId &&
      !!player;
    return {
      players: state.players.map((candidate) => ({ ...candidate })) as [
        MancalaGameState['players'][0],
        MancalaGameState['players'][1],
      ],
      pits: [[...state.pits[0]], [...state.pits[1]]],
      stores: [...state.stores] as [number, number],
      currentTurnId: state.currentTurnId,
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      youId: playerId,
      yourSide: player?.side ?? null,
      canAct,
      legalPits: canAct
        ? state.pits[player.side]
            .map((stones, pit) => (stones > 0 ? pit : -1))
            .filter((pit) => pit >= 0)
        : [],
    };
  }

  surrender(
    state: MancalaGameState,
    playerId: string,
  ): DistinctActionResult<MancalaResult> {
    if (state.phase !== DistinctGamePhase.PLAYING) {
      return { valid: false, reason: 'Game already finished' };
    }
    if (!state.players.some((candidate) => candidate.id === playerId)) {
      return { valid: false, reason: 'Player not found' };
    }

    state.phase = DistinctGamePhase.FINISHED;
    state.winnerId = state.players.find((candidate) => candidate.id !== playerId)!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: MancalaGameState): MancalaResult {
    if (!state.finishReason) throw new Error('Mancala game is not finished');
    return {
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      reason: state.finishReason,
      scores: Object.fromEntries(
        state.players.map((player) => [player.id, state.stores[player.side]]),
      ),
    };
  }

  private sweepAndFinish(
    state: MancalaGameState,
  ): DistinctActionResult<MancalaResult> {
    for (const side of [0, 1] as const) {
      state.stores[side] += state.pits[side].reduce((sum, stones) => sum + stones, 0);
      state.pits[side].fill(0);
    }
    state.phase = DistinctGamePhase.FINISHED;
    state.finishReason = 'pits_empty';
    state.isDraw = state.stores[0] === state.stores[1];
    state.winnerId = state.isDraw
      ? null
      : state.players[state.stores[0] > state.stores[1] ? 0 : 1].id;
    return { valid: true, result: this.getResult(state) };
  }

  private addStone(state: MancalaGameState, ringIndex: number): void {
    if (ringIndex === FIRST_STORE) {
      state.stores[0] += 1;
      return;
    }
    if (ringIndex === SECOND_STORE) {
      state.stores[1] += 1;
      return;
    }
    const location = this.toPitLocation(ringIndex)!;
    state.pits[location.side][location.pit] += 1;
  }

  private toRingIndex(side: 0 | 1, pit: number): number {
    return side === 0 ? pit : 7 + pit;
  }

  private toPitLocation(
    ringIndex: number,
  ): { side: 0 | 1; pit: number } | null {
    if (ringIndex >= 0 && ringIndex < PITS_PER_PLAYER) {
      return { side: 0, pit: ringIndex };
    }
    if (ringIndex >= 7 && ringIndex < SECOND_STORE) {
      return { side: 1, pit: ringIndex - 7 };
    }
    return null;
  }

  private sideIsEmpty(state: MancalaGameState, side: 0 | 1): boolean {
    return state.pits[side].every((stones) => stones === 0);
  }

  private otherSide(side: 0 | 1): 0 | 1 {
    return side === 0 ? 1 : 0;
  }

  private isPit(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < PITS_PER_PLAYER;
  }
}
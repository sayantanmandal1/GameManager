import {
  GridSalvoAction,
  GridSalvoGameState,
  GridSalvoOwnCell,
  GridSalvoPlayerView,
  GridSalvoResult,
  GridSalvoShipPlacement,
  GridSalvoShipState,
  GridSalvoTargetCell,
} from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';

const BOARD_CELLS = 100;
const FLEET_LENGTHS = [5, 4, 3, 3, 2];

export class GridSalvoEngine
  implements DistinctGameAdapter<GridSalvoGameState, GridSalvoAction, GridSalvoPlayerView, GridSalvoResult>
{
  readonly key = 'grid-salvo' as const;
  readonly rulesetId = 'grid-salvo.standard-fleet-10x10.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  initGame(playerIds: string[], playerNames: Record<string, string>): GridSalvoGameState {
    this.requirePlayers(playerIds);
    return {
      players: [
        { id: playerIds[0], name: playerNames[playerIds[0]] || 'Player 1' },
        { id: playerIds[1], name: playerNames[playerIds[1]] || 'Player 2' },
      ],
      fleets: { [playerIds[0]]: null, [playerIds[1]]: null },
      shots: { [playerIds[0]]: {}, [playerIds[1]]: {} },
      currentTurnId: null,
      phase: 'placement',
      winnerId: null,
      finishReason: null,
    };
  }

  applyAction(
    state: GridSalvoGameState,
    playerId: string,
    action: GridSalvoAction,
  ): DistinctActionResult<GridSalvoResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) {
      return { valid: false, reason: 'Player not found' };
    }
    if (!action || typeof action !== 'object') return { valid: false, reason: 'Invalid action' };

    if (state.phase === 'placement') {
      if (action.type !== 'place_fleet' || !Array.isArray(action.ships)) {
        return { valid: false, reason: 'Place a fleet first' };
      }
      if (state.fleets[playerId]) return { valid: false, reason: 'Fleet already placed' };
      const fleet = this.buildFleet(action.ships);
      if (!fleet) return { valid: false, reason: 'Invalid fleet placement' };
      state.fleets[playerId] = fleet;
      if (state.players.every((player) => state.fleets[player.id] !== null)) {
        state.phase = 'playing';
        state.currentTurnId = state.players[0].id;
      }
      return { valid: true };
    }

    if (action.type !== 'shoot' || !Number.isInteger(action.cell) || action.cell < 0 || action.cell >= BOARD_CELLS) {
      return { valid: false, reason: 'Invalid shot' };
    }
    if (state.currentTurnId !== playerId) return { valid: false, reason: 'Not your turn' };
    if (Object.prototype.hasOwnProperty.call(state.shots[playerId], action.cell)) {
      return { valid: false, reason: 'Coordinate already targeted' };
    }

    const opponent = this.otherPlayer(state, playerId);
    const fleet = state.fleets[opponent.id]!;
    const ship = fleet.find((candidate) => candidate.cells.includes(action.cell));
    state.shots[playerId][action.cell] = ship ? 'hit' : 'miss';
    if (ship) ship.hits.push(action.cell);

    if (fleet.every((candidate) => candidate.hits.length === candidate.cells.length)) {
      state.phase = 'finished';
      state.winnerId = playerId;
      state.finishReason = 'fleet_sunk';
      return { valid: true, result: this.getResult(state) };
    }
    state.currentTurnId = opponent.id;
    return { valid: true };
  }

  getPlayerView(state: GridSalvoGameState, playerId: string): GridSalvoPlayerView {
    const opponent = this.otherPlayer(state, playerId);
    const myFleet = state.fleets[playerId] ?? [];
    const opponentFleet = state.fleets[opponent.id] ?? [];
    const yourOcean: GridSalvoOwnCell[] = Array(BOARD_CELLS).fill('empty');
    for (const ship of myFleet) {
      for (const cell of ship.cells) yourOcean[cell] = 'ship';
    }
    for (const [cellText, outcome] of Object.entries(state.shots[opponent.id])) {
      yourOcean[Number(cellText)] = outcome;
    }
    const opponentOcean: GridSalvoTargetCell[] = Array(BOARD_CELLS).fill('unknown');
    for (const [cellText, outcome] of Object.entries(state.shots[playerId])) {
      opponentOcean[Number(cellText)] = outcome;
    }
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })) as GridSalvoGameState['players'],
      youId: playerId,
      phase: state.phase,
      currentTurnId: state.currentTurnId,
      winnerId: state.winnerId,
      canAct:
        (state.phase === 'placement' && !state.fleets[playerId]) ||
        (state.phase === 'playing' && state.currentTurnId === playerId),
      yourReady: state.fleets[playerId] !== null,
      opponentReady: state.fleets[opponent.id] !== null,
      yourOcean,
      opponentOcean,
      yourRemainingShips: myFleet.filter((ship) => ship.hits.length < ship.cells.length).map((ship) => ship.cells.length),
      opponentRemainingShips: opponentFleet.filter((ship) => ship.hits.length < ship.cells.length).map((ship) => ship.cells.length),
    };
  }

  surrender(state: GridSalvoGameState, playerId: string): DistinctActionResult<GridSalvoResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    state.phase = 'finished';
    state.winnerId = this.otherPlayer(state, playerId).id;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: GridSalvoGameState): GridSalvoResult {
    if (!state.winnerId || !state.finishReason) throw new Error('Grid Salvo game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: false, reason: state.finishReason };
  }

  private buildFleet(placements: GridSalvoShipPlacement[]): GridSalvoShipState[] | null {
    if (placements.length !== FLEET_LENGTHS.length) return null;
    const occupied = new Set<number>();
    const fleet: GridSalvoShipState[] = [];
    for (const placement of placements) {
      if (!placement || !Number.isInteger(placement.start) || !Number.isInteger(placement.end)) return null;
      if (placement.start < 0 || placement.end < 0 || placement.start >= BOARD_CELLS || placement.end >= BOARD_CELLS) return null;
      const startRow = Math.floor(placement.start / 10);
      const endRow = Math.floor(placement.end / 10);
      const startColumn = placement.start % 10;
      const endColumn = placement.end % 10;
      if (startRow !== endRow && startColumn !== endColumn) return null;
      const step = startRow === endRow ? 1 : 10;
      const low = Math.min(placement.start, placement.end);
      const high = Math.max(placement.start, placement.end);
      const cells: number[] = [];
      for (let cell = low; cell <= high; cell += step) cells.push(cell);
      if (cells.some((cell) => occupied.has(cell))) return null;
      cells.forEach((cell) => occupied.add(cell));
      fleet.push({ cells, hits: [] });
    }
    const lengths = fleet.map((ship) => ship.cells.length).sort((left, right) => right - left);
    return lengths.every((length, index) => length === FLEET_LENGTHS[index]) ? fleet : null;
  }

  private otherPlayer(state: GridSalvoGameState, playerId: string): GridSalvoGameState['players'][0] {
    return state.players.find((player) => player.id !== playerId)!;
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('Grid Salvo requires exactly two distinct players');
    }
  }
}
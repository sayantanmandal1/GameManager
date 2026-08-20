import { GridSalvoEngine } from './grid-salvo.engine';

describe('GridSalvoEngine', () => {
  const fleet = [
    { start: 0, end: 4 },
    { start: 10, end: 13 },
    { start: 20, end: 22 },
    { start: 30, end: 32 },
    { start: 40, end: 41 },
  ];
  const secondFleet = [
    { start: 5, end: 45 },
    { start: 6, end: 36 },
    { start: 7, end: 27 },
    { start: 8, end: 28 },
    { start: 9, end: 19 },
  ];
  const game = () => {
    const engine = new GridSalvoEngine();
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('sets up an empty private placement phase', () => {
    const { state } = game();
    expect(state.phase).toBe('placement');
    expect(state.fleets).toEqual({ a: null, b: null });
    expect(state.currentTurnId).toBeNull();
  });

  it('rejects shots before both fleets are placed', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'a', { type: 'shoot', cell: 0 })).toEqual({
      valid: false,
      reason: 'Place a fleet first',
    });
  });

  it('validates straight, non-overlapping ships with the exact fleet lengths', () => {
    const { engine, state } = game();
    const overlapping = fleet.map((ship) => ({ ...ship }));
    overlapping[4] = { start: 3, end: 4 };
    expect(engine.applyAction(state, 'a', { type: 'place_fleet', ships: overlapping })).toEqual({
      valid: false,
      reason: 'Invalid fleet placement',
    });
    expect(engine.applyAction(state, 'a', { type: 'place_fleet', ships: fleet }).valid).toBe(true);
  });

  it('starts play after both placements and enforces turn ownership', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'place_fleet', ships: fleet });
    engine.applyAction(state, 'b', { type: 'place_fleet', ships: secondFleet });
    expect(state).toMatchObject({ phase: 'playing', currentTurnId: 'a' });
    expect(engine.applyAction(state, 'b', { type: 'shoot', cell: 0 })).toEqual({
      valid: false,
      reason: 'Not your turn',
    });
  });

  it('records hits and misses and rejects a repeated coordinate', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'place_fleet', ships: fleet });
    engine.applyAction(state, 'b', { type: 'place_fleet', ships: secondFleet });
    expect(engine.applyAction(state, 'a', { type: 'shoot', cell: 5 }).valid).toBe(true);
    expect(state.shots.a[5]).toBe('hit');
    engine.applyAction(state, 'b', { type: 'shoot', cell: 99 });
    expect(state.shots.b[99]).toBe('miss');
    expect(engine.applyAction(state, 'a', { type: 'shoot', cell: 5 })).toEqual({
      valid: false,
      reason: 'Coordinate already targeted',
    });
  });

  it('redacts every unhit opponent ship coordinate', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'place_fleet', ships: fleet });
    engine.applyAction(state, 'b', { type: 'place_fleet', ships: secondFleet });
    engine.applyAction(state, 'a', { type: 'shoot', cell: 5 });
    const view = engine.getPlayerView(state, 'a');
    expect(view.yourOcean.filter((cell) => cell === 'ship')).toHaveLength(17);
    expect(view.opponentOcean[5]).toBe('hit');
    expect(view.opponentOcean[6]).toBe('unknown');
    expect(JSON.stringify(view)).not.toContain('"cells"');
  });

  it('finishes when the final surviving ship cell is hit', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'place_fleet', ships: fleet });
    engine.applyAction(state, 'b', { type: 'place_fleet', ships: secondFleet });
    for (const ship of state.fleets.b!) ship.hits = ship.cells.slice();
    state.fleets.b![4].hits.pop();
    const result = engine.applyAction(state, 'a', { type: 'shoot', cell: 19 });
    expect(result.result).toEqual({
      gameKey: 'grid-salvo', winnerId: 'a', isDraw: false, reason: 'fleet_sunk',
    });
  });

  it('awards surrender to the opponent', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });
});
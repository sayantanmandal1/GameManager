import { DotsAndBoxesEngine } from './dotsandboxes.engine';

describe('DotsAndBoxesEngine', () => {
  let engine: DotsAndBoxesEngine;

  beforeEach(() => {
    engine = new DotsAndBoxesEngine();
  });

  const game = () => engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' });

  it('sets up a 5x5-dot board with sixteen empty boxes', () => {
    const state = game();

    expect(state.horizontalEdges).toHaveLength(5);
    expect(state.horizontalEdges[0]).toHaveLength(4);
    expect(state.verticalEdges).toHaveLength(4);
    expect(state.verticalEdges[0]).toHaveLength(5);
    expect(state.boxes.flat().filter(Boolean)).toHaveLength(0);
  });

  it('rejects invalid and duplicate edges', () => {
    const state = game();

    expect(
      engine.applyAction(state, 'a', { orientation: 'horizontal', row: 5, column: 0 }).valid,
    ).toBe(false);
    expect(
      engine.applyAction(state, 'a', { orientation: 'horizontal', row: 0, column: 0 }).valid,
    ).toBe(true);
    expect(
      engine.applyAction(state, 'b', { orientation: 'horizontal', row: 0, column: 0 }),
    ).toEqual({ valid: false, reason: 'Edge already drawn' });
  });

  it('enforces turn ownership', () => {
    expect(
      engine.applyAction(game(), 'b', { orientation: 'vertical', row: 0, column: 0 }),
    ).toEqual({ valid: false, reason: 'Not your turn' });
  });

  it('passes the turn after drawing an edge that completes no box', () => {
    const state = game();

    expect(
      engine.applyAction(state, 'a', { orientation: 'horizontal', row: 0, column: 0 }).valid,
    ).toBe(true);
    expect(state.currentTurnId).toBe('b');
  });

  it('claims two adjacent boxes and grants an extra turn', () => {
    const state = game();
    state.horizontalEdges[0][0] = true;
    state.horizontalEdges[1][0] = true;
    state.verticalEdges[0][0] = true;
    state.horizontalEdges[0][1] = true;
    state.horizontalEdges[1][1] = true;
    state.verticalEdges[0][2] = true;

    expect(
      engine.applyAction(state, 'a', { orientation: 'vertical', row: 0, column: 1 }).valid,
    ).toBe(true);
    expect(state.boxes[0].slice(0, 2)).toEqual(['a', 'a']);
    expect(state.currentTurnId).toBe('a');
  });

  it('finishes and scores the game when the final box is claimed', () => {
    const state = game();
    state.horizontalEdges.forEach((row) => row.fill(true));
    state.verticalEdges.forEach((row) => row.fill(true));
    state.horizontalEdges[4][3] = false;
    state.boxes.forEach((row) => row.fill('a'));
    state.boxes[3][3] = null;
    const result = engine.applyAction(state, 'a', {
      orientation: 'horizontal',
      row: 4,
      column: 3,
    });

    expect(result.result).toMatchObject({
      winnerId: 'a',
      reason: 'all_boxes_claimed',
      scores: { a: 16, b: 0 },
    });
  });

  it('awards surrender to the other player', () => {
    expect(engine.surrender(game(), 'a').result).toMatchObject({
      winnerId: 'b',
      reason: 'surrender',
    });
  });

  it('returns an isolated player view with all legal edges', () => {
    const state = game();
    const view = engine.getPlayerView(state, 'a');
    view.horizontalEdges[0][0] = true;
    view.players[0].name = 'Changed';

    expect(state.horizontalEdges[0][0]).toBe(false);
    expect(state.players[0].name).toBe('Alice');
    expect(view.canAct).toBe(true);
    expect(view.legalEdges).toHaveLength(40);
  });
});
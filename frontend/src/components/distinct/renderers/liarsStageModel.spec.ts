import type { LiarsDeckPlayerView } from '@/shared';
import { liarsBarClaimLines, randomLiarsBarLine } from './liarsBarAssets';
import { stageSeatAngles, stageSeatRadius, stageSeats, stageSnapshot, stageTableRadius } from './liarsStageModel';

const idle = { active: false, shotIndex: 0, step: 'intro' as const, resolvedCount: 0 };

function makeView(overrides: Partial<LiarsDeckPlayerView> = {}): LiarsDeckPlayerView {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), handCount: 5, pulls: 0, active: true })) as LiarsDeckPlayerView['players'];
  return {
    gameKey: 'liars-deck', players, hostId: 'a', mode: 'classic', phase: 'playing', youId: 'a', yourHand: [], tableRank: 'K', pileCount: 0,
    pendingClaim: null, currentTurnId: 'b', round: 2, lastReveal: null, canAct: false, canChallenge: false, canPlay: false, canDevilsDeal: false,
    forcedChallenge: false, winnerId: null, deck: { A: 6, K: 6, Q: 6, joker: 2, devil: 0 }, roundIntroRemainingMs: 0, nextRoundInMs: 0,
    ...overrides,
  };
}

describe('liars stage model', () => {
  it('seats the local player in front and spreads everyone evenly', () => {
    expect(stageSeatAngles(4, 2)).toEqual([Math.PI, Math.PI * 1.5, 0, Math.PI / 2]);
    expect(stageSeatAngles(3, -1)[0]).toBe(0);
    expect(stageTableRadius(6)).toBeGreaterThan(stageTableRadius(4));
    expect(stageSeatRadius(2)).toBeGreaterThan(stageTableRadius(2));
  });

  it('assigns characters by seat order and marks the local player', () => {
    const seats = stageSeats(makeView());
    expect(seats.map((seat) => seat.character)).toEqual(['scubby', 'foxy', 'bristle', 'toar']);
    expect(seats.filter((seat) => seat.you).map((seat) => seat.id)).toEqual(['a']);
  });

  it('maps lobby, turn, empty hand, eliminated and winner poses', () => {
    const setup = makeView({ phase: 'setup' });
    expect(Object.values(stageSnapshot(setup, setup.players, false, idle).base)).toEqual(['lobby', 'lobby', 'lobby', 'lobby']);

    const view = makeView();
    view.players[2] = { ...view.players[2], handCount: 0 };
    view.players[3] = { ...view.players[3], active: false };
    const snapshot = stageSnapshot(view, view.players, false, idle);
    expect(snapshot.base).toEqual({ a: 'idle', b: 'look', c: 'nocard', d: 'dead' });
    expect(snapshot.hands).toEqual({ a: 5, b: 5, c: 0, d: 0 });
    expect(snapshot.focusId).toBe('b');

    expect(stageSnapshot(view, view.players, true, idle).base.b).toBe('idle');

    const finished = makeView({ phase: 'finished', winnerId: 'c' });
    expect(stageSnapshot(finished, finished.players, false, idle).base.c).toBe('win');
  });

  it('follows the shooter during the roulette and exposes revealed cards', () => {
    const view = makeView({
      phase: 'reveal', pileCount: 6,
      lastReveal: {
        kind: 'challenge', callerId: 'c', claimantId: 'b', tableRank: 'Q', cards: [{ id: 'x', rank: 'K' }, { id: 'y', rank: 'Q' }], successful: true,
        riskPlayerIds: ['b'], eliminatedIds: [], shots: [{ playerId: 'b', pull: 2, fired: false }],
      } as LiarsDeckPlayerView['lastReveal'],
    });
    expect(stageSnapshot(view, view.players, false, { ...idle, active: true }).focusId).toBe('c');
    const spinning = stageSnapshot(view, view.players, false, { active: true, shotIndex: 0, step: 'spin', resolvedCount: 0 });
    expect(spinning.focusId).toBe('b');
    expect(spinning.reveal).toEqual(['K', 'Q']);
    expect(spinning.pile).toBe(0);
    expect(spinning.revealKey).toContain('x,y');
  });
});

describe('liars bar voice lines', () => {
  it('speaks the count then the singular or plural rank', () => {
    expect(liarsBarClaimLines('foxy', 1, 'A')).toEqual(['/liars-bar/voices/foxy/count-1.mp3', '/liars-bar/voices/foxy/singular-3.mp3']);
    expect(liarsBarClaimLines('gerk', 3, 'K')).toEqual(['/liars-bar/voices/gerk/count-3.mp3', '/liars-bar/voices/gerk/plural-1.mp3']);
    expect(liarsBarClaimLines('scubby', 2, 'Q')?.[1]).toBe('/liars-bar/voices/scubby/plural-2.mp3');
  });

  it('only picks takes that exist for the character', () => {
    expect(randomLiarsBarLine('gerk', 'relief', () => 0.99)).toBe('/liars-bar/voices/gerk/relief-1.mp3');
    expect(randomLiarsBarLine('cupcake', 'relief', () => 0.99)).toBe('/liars-bar/voices/cupcake/relief-4.mp3');
    expect(randomLiarsBarLine('toar', 'preshot', () => 0)).toBe('/liars-bar/voices/toar/preshot-1.mp3');
  });
});

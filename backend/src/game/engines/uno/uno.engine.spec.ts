import { UnoEngine } from "./uno.engine";
import {
  buildDeck,
  buildFlipDeck,
  buildNoMercyDeck,
  cardMatches,
  cardPoints,
} from "./uno.utils";
import {
  UnoCard,
  UnoColor,
  UnoGameState,
  UnoPlayerState,
  UnoPhase,
} from "../../../shared";

let cid = 0;
const num = (color: UnoColor, value: number): UnoCard => ({
  id: `n${cid++}`,
  color,
  kind: "number",
  value,
});
const act = (color: UnoColor, kind: "skip" | "reverse" | "draw2"): UnoCard => ({
  id: `a${cid++}`,
  color,
  kind,
  value: null,
});
const wild = (kind: "wild" | "wild4" = "wild"): UnoCard => ({
  id: `w${cid++}`,
  color: null,
  kind,
  value: null,
});

function mkPlayer(id: string, hand: UnoCard[]): UnoPlayerState {
  return {
    id,
    name: id,
    hand,
    handCount: hand.length,
    isConnected: true,
    calledUno: false,
    unoVulnerable: false,
    score: 0,
    eliminated: false,
  };
}

function baseState(
  players: UnoPlayerState[],
  overrides: Partial<UnoGameState> = {},
): UnoGameState {
  const now = Date.now();
  return {
    gameId: "g",
    lobbyCode: "123456",
    mode: "classic",
    phase: UnoPhase.PLAYING,
    side: "light",
    players,
    spectators: [],
    direction: 1,
    currentIndex: 0,
    drawPile: [num("red", 1), num("red", 2), num("red", 3), num("yellow", 4)],
    eliminatedCards: [],
    discardPile: [num("red", 7)],
    activeColor: "red",
    pendingDraw: null,
    pendingSevenBy: null,
    openingColorBy: null,
    pendingWinnerId: null,
    drawnCardId: null,
    unoWindows: {},
    turnStartedAt: now,
    turnEndsAt: now + 45000,
    targetScore: null,
    stacking: false,
    drawToMatch: false,
    jumpIn: false,
    sevenZero: false,
    forcePlay: false,
    noBluffing: false,
    mercyLimit: null,
    roundNumber: 1,
    roundWinnerId: null,
    matchWinnerId: null,
    lastResult: null,
    events: [],
    eventSeq: 0,
    startedAt: now,
    finishedAt: null,
    ...overrides,
  };
}

const flipRules = {
  mode: "flip" as const,
  targetScore: 500,
  stacking: false,
  drawToMatch: false,
  jumpIn: false,
  sevenZero: false,
  forcePlay: false,
  noBluffing: false,
};

function engineWithOpening(
  openingKind: UnoCard["kind"],
  playerCount: number,
  replacementKind?: UnoCard["kind"],
): UnoEngine {
  return new UnoEngine((cards) => {
    const remaining = [...cards];
    const takeKind = (kind: UnoCard["kind"]) => {
      const index = remaining.findIndex((card) => card.kind === kind);
      if (index < 0) throw new Error(`No ${kind} card in test deck`);
      return remaining.splice(index, 1)[0];
    };
    const opening = takeKind(openingKind);
    const replacement = replacementKind ? takeKind(replacementKind) : null;
    const dealt = remaining.splice(-playerCount * 7);
    return [
      ...remaining,
      ...(replacement ? [replacement] : []),
      opening,
      ...dealt,
    ];
  });
}

describe("uno.utils", () => {
  it("builds a correct 108-card deck", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    expect(deck.filter((c) => c.kind === "wild")).toHaveLength(4);
    expect(deck.filter((c) => c.kind === "wild4")).toHaveLength(4);
    // Each colour: one 0, two each 1-9, two each of 3 actions = 25.
    for (const color of ["red", "yellow", "green", "blue"] as const) {
      const suit = deck.filter((c) => c.color === color);
      expect(suit).toHaveLength(25);
      expect(
        suit.filter((c) => c.kind === "number" && c.value === 0),
      ).toHaveLength(1);
      expect(
        suit.filter((c) => c.kind === "number" && c.value === 5),
      ).toHaveLength(2);
      expect(suit.filter((c) => c.kind === "draw2")).toHaveLength(2);
    }
    // All ids unique.
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });

  it("matches by colour, number, symbol and wild", () => {
    expect(cardMatches(num("red", 3), "red", num("blue", 9))).toBe(true); // colour
    expect(cardMatches(num("blue", 9), "red", num("green", 9))).toBe(true); // number
    expect(cardMatches(act("blue", "skip"), "red", act("green", "skip"))).toBe(
      true,
    ); // symbol
    expect(cardMatches(wild("wild4"), "red", num("red", 3))).toBe(true); // wild always
    expect(cardMatches(num("blue", 3), "red", num("green", 9))).toBe(false);
  });

  it("scores cards per official values", () => {
    expect(cardPoints(num("red", 7), "light", "classic")).toBe(7);
    expect(cardPoints(act("red", "skip"), "light", "classic")).toBe(20);
    expect(cardPoints(wild("wild4"), "light", "classic")).toBe(50);
  });
});
describe("UnoEngine.initRound", () => {
  const engine = new UnoEngine();
  it("deals 7 each and starts on a number card", () => {
    const s = engine.initRound(
      "g",
      "123456",
      ["a", "b", "c"],
      { a: "A", b: "B", c: "C" },
      {
        mode: "classic",
        targetScore: 500,
        stacking: false,
        drawToMatch: false,
        jumpIn: false,
        sevenZero: false,
        forcePlay: false,
        noBluffing: false,
      },
    );
    expect(s.players).toHaveLength(3);
    for (const p of s.players) expect(p.hand).toHaveLength(7);
    expect(s.discardPile).toHaveLength(1);
    expect(s.discardPile[0].kind).toBe("number");
    expect(s.activeColor).toBe(s.discardPile[0].color);
    // 108 - 21 dealt - 1 discard = 86 in draw pile (action re-inserts don't lose cards).
    expect(s.drawPile.length + 22).toBe(108);
  });

  it("applies an opening Flip Draw One and skips its victim", () => {
    const s = engineWithOpening("draw1", 3).initRound(
      "g", "123456", ["a", "b", "c"], {}, flipRules,
    );
    expect(s.discardPile.at(-1)?.kind).toBe("draw1");
    expect(s.players[0].handCount).toBe(8);
    expect(s.currentIndex).toBe(1);
    expect(s.direction).toBe(1);
  });

  it("makes the dealer lead right on an opening Flip Reverse", () => {
    const s = engineWithOpening("reverse", 3).initRound(
      "g", "123456", ["a", "b", "c"], {}, flipRules,
    );
    expect(s.direction).toBe(-1);
    expect(s.currentIndex).toBe(2);
  });

  it("skips the first player on an opening Flip Skip", () => {
    const s = engineWithOpening("skip", 3).initRound(
      "g", "123456", ["a", "b", "c"], {}, flipRules,
    );
    expect(s.currentIndex).toBe(1);
  });

  it("requires the first player to choose an opening Flip Wild color", () => {
    const engine = engineWithOpening("wild", 3);
    const s = engine.initRound(
      "g", "123456", ["a", "b", "c"], {}, flipRules,
    );
    expect(s.openingColorBy).toBe("a");
    expect(engine.getPlayerView(s, "a").canChooseOpeningColor).toBe(true);
    expect(engine.getPlayerView(s, "b").canChooseOpeningColor).toBe(false);
    expect(engine.draw(s, "a")).toEqual({
      ok: false,
      error: "Choose the opening colour first",
    });
    expect(engine.chooseOpeningColor(s, "b", "blue")).toEqual({
      ok: false,
      error: "No opening colour to choose",
    });
    expect(engine.chooseOpeningColor(s, "a", "blue")).toEqual({ ok: true });
    expect(s).toMatchObject({ openingColorBy: null, activeColor: "blue", currentIndex: 0 });
  });

  it("returns an opening Flip Wild Draw Two and replaces it", () => {
    const s = engineWithOpening("wildDraw2", 3, "number").initRound(
      "g", "123456", ["a", "b", "c"], {}, flipRules,
    );
    expect(s.discardPile).toHaveLength(1);
    expect(s.discardPile[0].kind).toBe("number");
    expect(s.drawPile.some((card) => card.kind === "wildDraw2")).toBe(true);
    expect(s.players.every((player) => player.handCount === 7)).toBe(true);
  });

  it("turns both piles to the dark side on an opening Flip card", () => {
    const s = engineWithOpening("flip", 3).initRound(
      "g", "123456", ["a", "b", "c"], {}, flipRules,
    );
    expect(s.side).toBe("dark");
    expect(s.discardPile.at(-1)?.kind).toBe("flip");
    expect(s.activeColor).toBe(s.discardPile.at(-1)?.dark?.color);
    expect(s.currentIndex).toBe(0);
  });

  it("keeps ignored No Mercy opening actions under the first number", () => {
    const noMercyRules = { ...flipRules, mode: "noMercy" as const };
    const s = engineWithOpening("draw10", 3, "number").initRound(
      "g", "123456", ["a", "b", "c"], {}, noMercyRules,
    );
    expect(s.discardPile.map((card) => card.kind)).toEqual(["draw10", "number"]);
    expect(s.currentIndex).toBe(0);
    expect(s.pendingDraw).toBeNull();
    expect(s.players.every((player) => player.handCount === 7)).toBe(true);
  });
});

describe("UnoEngine play — matching & turn order", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("accepts a colour match and advances the turn", () => {
    const c = num("red", 5);
    const s = baseState([
      mkPlayer("a", [c, num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    const r = engine.play(s, "a", c.id);
    expect(r.ok).toBe(true);
    expect(s.activeColor).toBe("red");
    expect(s.currentIndex).toBe(1);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it("rejects an out-of-turn play and a non-matching card", () => {
    const bad = num("blue", 3);
    const s = baseState([
      mkPlayer("a", [bad]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    expect(engine.play(s, "b", s.players[1].hand[0].id).ok).toBe(false);
    expect(engine.play(s, "a", bad.id).ok).toBe(false);
  });

  it("requires a colour for wilds and applies it", () => {
    const w = wild("wild");
    const s = baseState([
      mkPlayer("a", [w, num("red", 2)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    expect(engine.play(s, "a", w.id).ok).toBe(false);
    const r = engine.play(s, "a", w.id, "blue");
    expect(r.ok).toBe(true);
    expect(s.activeColor).toBe("blue");
  });

  it("skips the next player on Skip", () => {
    const sk = act("red", "skip");
    const s = baseState([
      mkPlayer("a", [sk, num("red", 1)]),
      mkPlayer("b", [num("green", 1)]),
      mkPlayer("c", [num("green", 2)]),
    ]);
    engine.play(s, "a", sk.id);
    expect(s.currentIndex).toBe(2); // b skipped
  });

  it("reverses direction; acts as Skip with two players", () => {
    const rv = act("red", "reverse");
    const three = baseState([
      mkPlayer("a", [rv, num("red", 1)]),
      mkPlayer("b", [num("green", 1)]),
      mkPlayer("c", [num("green", 2)]),
    ]);
    engine.play(three, "a", rv.id);
    expect(three.direction).toBe(-1);
    expect(three.currentIndex).toBe(2); // reversed → c

    const rv2 = act("red", "reverse");
    const two = baseState([
      mkPlayer("a", [rv2, num("red", 1)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(two, "a", rv2.id);
    expect(two.currentIndex).toBe(0); // reverse = skip → a plays again
  });
});

describe("UnoEngine draw / pass", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("lets you play a drawn card that is playable", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [num("red", 4)], // playable on red 7
      },
    );
    const r = engine.draw(s, "a");
    expect(r.ok).toBe(true);
    expect(s.drawnCardId).not.toBeNull();
    expect(s.currentIndex).toBe(0); // turn held open
    const drawn = s.players[0].hand.find((c) => c.id === s.drawnCardId)!;
    expect(engine.play(s, "a", drawn.id).ok).toBe(true);
    expect(s.currentIndex).toBe(1);
  });

  it("ends the turn when the drawn card is unplayable", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [num("green", 9)], // not playable on red 7
      },
    );
    engine.draw(s, "a");
    expect(s.drawnCardId).toBeNull();
    expect(s.currentIndex).toBe(1);
  });

  it("allows pass only after drawing", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [num("red", 4)],
      },
    );
    expect(engine.pass(s, "a").ok).toBe(false);
    engine.draw(s, "a");
    expect(engine.pass(s, "a").ok).toBe(true);
    expect(s.currentIndex).toBe(1);
  });
});

describe("UnoEngine Draw Two / stacking", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("auto-applies +2 and skips when stacking is off", () => {
    const d2 = act("red", "draw2");
    const s = baseState(
      [
        mkPlayer("a", [d2, num("red", 1)]),
        mkPlayer("b", [num("green", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        drawPile: [num("red", 1), num("red", 2), num("red", 3), num("red", 4)],
      },
    );
    engine.play(s, "a", d2.id);
    expect(s.players[1].handCount).toBe(3); // b drew 2
    expect(s.pendingDraw).toBeNull();
    expect(s.currentIndex).toBe(2); // b skipped
  });

  it("lets a player stack +2, accumulating the penalty", () => {
    const d2a = act("red", "draw2");
    const d2b = act("blue", "draw2");
    const s = baseState(
      [
        mkPlayer("a", [d2a, num("red", 1)]),
        mkPlayer("b", [d2b, num("green", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        stacking: true,
        drawPile: [
          num("red", 1),
          num("red", 2),
          num("red", 3),
          num("red", 4),
          num("red", 5),
        ],
      },
    );
    engine.play(s, "a", d2a.id);
    expect(s.currentIndex).toBe(1); // b faces the +2 with a stackable card
    expect(s.pendingDraw?.count).toBe(2);
    engine.play(s, "b", d2b.id); // b stacks
    expect(s.pendingDraw).toBeNull(); // c cannot stack → auto-takes
    expect(s.players[2].handCount).toBe(5); // c drew 4
    expect(s.currentIndex).toBe(0); // c skipped → back to a
  });
});

describe("UnoEngine Wild Draw Four & challenge", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("leaves a decision (take or challenge) for the next player", () => {
    const w4 = wild("wild4");
    const s = baseState([
      mkPlayer("a", [w4, num("blue", 2)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(s, "a", w4.id, "blue");
    expect(s.pendingDraw).toEqual(
      expect.objectContaining({ count: 4, type: "wild4", challengeable: true }),
    );
    expect(s.currentIndex).toBe(1);
  });

  it("successful challenge: bluffer draws the penalty, challenger plays on", () => {
    // a plays WD4 while holding a red card (illegal — active colour was red).
    const w4 = wild("wild4");
    const s = baseState(
      [mkPlayer("a", [w4, num("red", 9)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [
          num("red", 1),
          num("red", 2),
          num("red", 3),
          num("red", 4),
          num("red", 5),
        ],
      },
    );
    engine.play(s, "a", w4.id, "blue");
    const r = engine.challenge(s, "b");
    expect(r.ok).toBe(true);
    expect(s.players[0].handCount).toBe(5); // a drew 4 (had 1, +4)
    expect(s.pendingDraw).toBeNull();
    expect(s.currentIndex).toBe(1); // challenger keeps the turn
  });

  it("failed challenge: challenger draws penalty + 2 and is skipped", () => {
    const w4 = wild("wild4");
    const s = baseState(
      [
        mkPlayer("a", [w4, num("blue", 9)]), // no red → legal WD4
        mkPlayer("b", [num("green", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        drawPile: Array.from({ length: 8 }, (_, i) =>
          num("yellow", (i % 9) + 1),
        ),
      },
    );
    engine.play(s, "a", w4.id, "blue");
    const r = engine.challenge(s, "b");
    expect(r.ok).toBe(true);
    expect(s.players[1].handCount).toBe(7); // b drew 6
    expect(s.currentIndex).toBe(2); // b skipped
  });

  it("snapshots bluff legality so the accused cannot erase challenge evidence", () => {
    const w4 = wild("wild4");
    const s = baseState(
      [mkPlayer("a", [w4, num("red", 9)]), mkPlayer("b", [num("green", 1)]), mkPlayer("c", [num("blue", 2)])],
      { drawPile: Array.from({ length: 8 }, (_, index) => num("yellow", (index % 9) + 1)) },
    );
    engine.play(s, "a", w4.id, "blue");
    s.players[0].hand = [];
    s.players[0].handCount = 0;

    expect(engine.challenge(s, "b").ok).toBe(true);
    expect(s.currentIndex).toBe(1);
    expect(s.pendingDraw).toBeNull();
  });

  it("defers a final Flip wild-draw win until the challenge fails", () => {
    const final: UnoCard = {
      id: "flip-final-wd2",
      color: null,
      kind: "wildDraw2",
      value: null,
      dark: { color: null, kind: "wild", value: null },
    };
    const s = baseState(
      [mkPlayer("a", [final]), mkPlayer("b", [num("green", 1)]), mkPlayer("c", [num("blue", 2)])],
      {
        mode: "flip",
        drawPile: Array.from({ length: 8 }, (_, index) => num("yellow", (index % 9) + 1)),
      },
    );

    const played = engine.play(s, "a", final.id, "blue");
    expect(played.roundResult).toBeUndefined();
    expect(s).toMatchObject({ phase: UnoPhase.PLAYING, pendingWinnerId: "a", currentIndex: 1 });
    expect(s.pendingDraw).toMatchObject({ type: "wildDraw2", count: 2 });

    const resolved = engine.challenge(s, "b");
    expect(resolved.roundResult).toMatchObject({ matchOver: true, matchWinnerId: "a" });
    expect(s.phase).toBe(UnoPhase.FINISHED);
    expect(s.players[1].handCount).toBe(5);
  });

  it("awards a pending final wild-draw win if its recipient surrenders", () => {
    const final: UnoCard = {
      id: "flip-final-recipient-surrender",
      color: null,
      kind: "wildDraw2",
      value: null,
      dark: { color: null, kind: "wild", value: null },
    };
    const s = baseState([
      mkPlayer("a", [final]),
      mkPlayer("b", [num("green", 1)]),
      mkPlayer("c", [num("blue", 2)]),
    ], { mode: "flip" });
    engine.play(s, "a", final.id, "blue");

    const result = engine.surrender(s, "b");

    expect(result.roundResult).toMatchObject({ matchOver: true, matchWinnerId: "a" });
    expect(s).toMatchObject({ phase: UnoPhase.FINISHED, matchWinnerId: "a" });
  });

  it("clears a non-final pending draw when its recipient surrenders", () => {
    const w4 = wild("wild4");
    const s = baseState([
      mkPlayer("a", [w4, num("blue", 9)]),
      mkPlayer("b", [num("green", 1)]),
      mkPlayer("c", [num("yellow", 2)]),
    ]);
    engine.play(s, "a", w4.id, "blue");

    const result = engine.surrender(s, "b");

    expect(result).toEqual({ ok: true });
    expect(s).toMatchObject({
      phase: UnoPhase.PLAYING,
      pendingDraw: null,
      pendingWinnerId: null,
      currentIndex: 2,
    });
    expect(s.players[1].eliminated).toBe(true);
    expect(s.players[0].handCount).toBe(1);
  });

  it("does not let the challenge target surrender before resolution", () => {
    const w4 = wild("wild4");
    const s = baseState([
      mkPlayer("a", [w4, num("red", 9)]),
      mkPlayer("b", [num("green", 1)]),
      mkPlayer("c", [num("blue", 2)]),
    ]);
    engine.play(s, "a", w4.id, "blue");

    expect(engine.surrender(s, "a")).toEqual({
      ok: false,
      error: "Resolve the wild draw challenge first",
    });
    expect(s.players[0].eliminated).toBe(false);
    expect(s.pendingDraw?.wild4WasBluff).toBe(true);
  });
});

describe("UnoEngine UNO call & catch", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("opens a catch window when a player reaches one card", () => {
    const c = num("red", 5);
    const s = baseState([
      mkPlayer("a", [c, num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(s, "a", c.id);
    expect(s.players[0].unoVulnerable).toBe(true);
    expect(s.unoWindows.a).toBeGreaterThan(Date.now());
  });

  it("catching an un-called player adds a +2 penalty", () => {
    const c = num("red", 5);
    const s = baseState(
      [mkPlayer("a", [c, num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [num("red", 1), num("red", 2)],
      },
    );
    engine.play(s, "a", c.id);
    const r = engine.catchPlayer(s, "b", "a");
    expect(r.ok).toBe(true);
    expect(s.players[0].handCount).toBe(3);
    expect(s.unoWindows.a).toBeUndefined();
  });

  it("calling UNO protects against a catch", () => {
    const c = num("red", 5);
    const s = baseState([
      mkPlayer("a", [c, num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(s, "a", c.id);
    expect(engine.callUno(s, "a").ok).toBe(true);
    expect(s.players[0].calledUno).toBe(true);
    expect(engine.catchPlayer(s, "b", "a").ok).toBe(false);
  });

  it("keeps the catch available for three seconds after the next player acts", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const c = num("red", 5);
    const s = baseState(
      [mkPlayer("a", [c, num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [num("yellow", 9)],
      },
    );
    engine.play(s, "a", c.id); // a → 1 card, window open, turn to b
    engine.draw(s, "b");
    expect(s.unoWindows.a).toBeGreaterThan(Date.now());
    expect(engine.getPlayerView(s, "b").catchableIds).toEqual(["a"]);
    expect(engine.catchPlayer(s, "b", "a").ok).toBe(true);
    jest.useRealTimers();
  });

  it("keeps independent three-second windows when consecutive players reach UNO", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = num("red", 5);
    const second = num("red", 6);
    const s = baseState([
      mkPlayer("a", [first, num("blue", 8)]),
      mkPlayer("b", [second, num("green", 9)]),
      mkPlayer("c", [num("yellow", 2)]),
    ]);

    engine.play(s, "a", first.id);
    jest.advanceTimersByTime(500);
    engine.play(s, "b", second.id);

    expect(engine.getPlayerView(s, "c").catchableIds.sort()).toEqual(["a", "b"]);
    expect(engine.catchPlayer(s, "c", "a").ok).toBe(true);
    expect(engine.getPlayerView(s, "c").catchableIds).toEqual(["b"]);
    jest.useRealTimers();
  });

  it("rejects a catch after the three-second grace period", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const c = num("red", 5);
    const s = baseState([
      mkPlayer("a", [c, num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(s, "a", c.id);
    jest.advanceTimersByTime(3_001);

    expect(engine.getPlayerView(s, "b").catchableIds).toEqual([]);
    expect(engine.catchPlayer(s, "b", "a")).toEqual({
      ok: false,
      error: "Nothing to catch",
    });
    jest.useRealTimers();
  });

  it("closes exactly at three seconds and accepts only the first simultaneous catcher", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const c = num("red", 5);
    const s = baseState([
      mkPlayer("a", [c, num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
      mkPlayer("c", [num("yellow", 2)]),
    ]);
    engine.play(s, "a", c.id);
    expect(engine.catchPlayer(s, "b", "a").ok).toBe(true);
    expect(engine.catchPlayer(s, "c", "a")).toEqual({
      ok: false,
      error: "Nothing to catch",
    });

    const second = baseState([
      mkPlayer("a", [num("red", 6), num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(second, "a", second.players[0].hand[0].id);
    jest.advanceTimersByTime(3_000);
    expect(engine.catchPlayer(second, "b", "a").ok).toBe(false);
    jest.useRealTimers();
  });

  it("rejects a catch forged by an eliminated player", () => {
    const s = baseState([
      mkPlayer("a", [num("red", 1)]),
      mkPlayer("b", [num("blue", 2)]),
      mkPlayer("c", [num("yellow", 3)]),
    ]);
    s.players[0].eliminated = true;
    s.players[1].unoVulnerable = true;
    s.unoWindows.b = Date.now() + 3_000;

    expect(engine.catchPlayer(s, "a", "b")).toEqual({
      ok: false,
      error: "Only active players can catch",
    });
    expect(s.players[1].handCount).toBe(1);
  });
});

describe("UnoEngine round end & scoring", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("ends a single round and scores opponents’ hands", () => {
    const last = num("red", 5);
    const s = baseState([
      mkPlayer("a", [last]),
      mkPlayer("b", [num("blue", 3), num("green", 9)]),
    ]);
    const r = engine.play(s, "a", last.id);
    expect(r.roundResult?.points).toBe(12);
    expect(s.phase).toBe(UnoPhase.FINISHED);
    expect(s.matchWinnerId).toBe("a");
  });

  it("continues to another round when the target score is not reached", () => {
    const last = num("red", 5);
    const s = baseState(
      [mkPlayer("a", [last]), mkPlayer("b", [num("blue", 3)])],
      {
        targetScore: 500,
      },
    );
    const r = engine.play(s, "a", last.id);
    expect(r.roundResult?.matchOver).toBe(false);
    expect(s.phase).toBe(UnoPhase.ROUND_OVER);
    expect(s.players[0].score).toBe(3);
  });

  it("forces the next player to draw when going out on a Draw Two", () => {
    const last = act("red", "draw2");
    const s = baseState(
      [mkPlayer("a", [last]), mkPlayer("b", [num("blue", 3)])],
      {
        drawPile: [num("yellow", 1), num("yellow", 2), num("yellow", 3)],
      },
    );
    const r = engine.play(s, "a", last.id);
    expect(s.players[1].handCount).toBe(3); // b drew 2 before tally
    expect(r.roundResult).toBeDefined();
  });
});

describe("UnoEngine reshuffle & timeout", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("recycles the discard pile when the draw pile empties", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [],
        discardPile: [
          num("red", 7),
          num("red", 1),
          num("red", 2),
          num("red", 3),
        ],
      },
    );
    engine.draw(s, "a");
    // 3 recyclable cards became the draw pile, minus the 1 just drawn = 2.
    expect(s.drawPile).toHaveLength(2);
    expect(s.discardPile).toHaveLength(1);
  });

  it("replenishes with a fresh balanced deck when both piles are exhausted", () => {
    // Draw pile empty AND discard holds only the top card → nothing to recycle,
    // so a fresh mode deck is minted. The player still draws; the pile refills.
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [],
        discardPile: [num("red", 7)],
      },
    );
    expect(() => engine.draw(s, "a")).not.toThrow();
    expect(s.players[0].handCount).toBe(2); // drew a freshly minted card
    expect(s.drawPile.length).toBeGreaterThan(0); // pile replenished
    expect(s.discardPile).toHaveLength(1); // top card preserved
  });

  it("a penalty draw always resolves in full — the deck never runs dry", () => {
    const d2 = act("red", "draw2");
    const s = baseState(
      [mkPlayer("a", [d2, num("red", 9)]), mkPlayer("b", [num("green", 1)])],
      { drawPile: [], discardPile: [num("red", 7)] },
    );
    engine.play(s, "a", d2.id); // b auto-takes +2; supply is topped up as needed
    expect(s.pendingDraw).toBeNull();
    expect(s.players[1].handCount).toBe(3); // green 1 + the full +2
  });

  it("never runs dry — supply is effectively infinite over many draws", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [],
        discardPile: [num("red", 7)],
      },
    );
    for (let i = 0; i < 200; i += 1) engine.timeout(s);
    const total = s.players[0].handCount + s.players[1].handCount;
    expect(total).toBeGreaterThan(108); // more cards handed out than one deck holds
  });

  it("auto-draws and passes on timeout", () => {
    const s = baseState([
      mkPlayer("a", [num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.timeout(s);
    expect(s.players[0].handCount).toBe(2);
    expect(s.currentIndex).toBe(1);
  });

  it("auto-takes a pending draw on timeout", () => {
    const d2 = act("red", "draw2");
    const s = baseState(
      [
        mkPlayer("a", [d2, num("red", 9)]),
        mkPlayer("b", [num("green", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        stacking: true,
        drawPile: [num("red", 1), num("red", 2), num("red", 3)],
      },
    );
    // Give b a stackable card so the pending stays open for a decision.
    s.players[1].hand.push(act("blue", "draw2"));
    s.players[1].handCount = 2;
    engine.play(s, "a", d2.id);
    expect(s.pendingDraw?.count).toBe(2);
    engine.timeout(s); // b times out → auto-take
    expect(s.pendingDraw).toBeNull();
    expect(s.players[1].handCount).toBe(4); // 2 + drew 2
  });

  it("draws until playable and force-plays the card on a No Mercy timeout", () => {
    const playable = num("red", 2);
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "noMercy",
        drawToMatch: true,
        forcePlay: true,
        mercyLimit: 25,
        drawPile: [playable, num("green", 9), num("yellow", 8)],
      },
    );

    expect(engine.timeout(s).ok).toBe(true);
    expect(s.discardPile.at(-1)?.id).toBe(playable.id);
    expect(s.players[0].handCount).toBe(3);
    expect(s.currentIndex).toBe(1);
    expect(s.events.find((event) => event.type === "draw")?.amount).toBe(3);
  });

  it("force-plays an already drawn No Mercy card when its timer expires", () => {
    const playable = num("red", 2);
    const s = baseState(
      [mkPlayer("a", [playable, num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "noMercy",
        forcePlay: true,
        drawnCardId: playable.id,
      },
    );

    expect(engine.timeout(s).ok).toBe(true);
    expect(s.discardPile.at(-1)?.id).toBe(playable.id);
    expect(s.currentIndex).toBe(1);
  });

  it("force-plays an already drawn Custom card when its timer expires", () => {
    const playable = num("red", 3);
    const s = baseState(
      [mkPlayer("a", [playable, num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "custom",
        forcePlay: true,
        drawnCardId: playable.id,
      },
    );

    expect(engine.timeout(s).ok).toBe(true);
    expect(s.discardPile.at(-1)?.id).toBe(playable.id);
    expect(s.currentIndex).toBe(1);
  });
});

describe("UnoEngine anti-cheat view", () => {
  const engine = new UnoEngine();
  it("hides other hands and reveals only your own", () => {
    const s = baseState([
      mkPlayer("a", [num("red", 5), num("blue", 8)]),
      mkPlayer("b", [num("green", 1), num("green", 2)]),
    ]);
    const viewA = engine.getPlayerView(s, "a");
    expect(viewA.role).toBe("player");
    expect(viewA.yourHand).toHaveLength(2);
    expect(viewA.players.find((p) => p.id === "b")).toMatchObject({
      handCount: 2,
    });
    // No opponent card data leaks anywhere in the payload.
    expect(JSON.stringify(viewA)).not.toContain("green");

    const spec = engine.getPlayerView(s, "zzz");
    expect(spec.role).toBe("spectator");
    expect(spec.yourHand).toHaveLength(0);
  });

  it("caps retained spectators", () => {
    const s = baseState([
      mkPlayer("a", [num("red", 5)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    for (let index = 0; index < 32; index += 1) {
      expect(engine.addSpectator(s, `spectator-${index}`)).toBe(true);
    }
    expect(engine.addSpectator(s, "one-too-many")).toBe(false);
    expect(s.spectators).toHaveLength(32);
  });

  it("projects only opponents' physically visible inactive Flip faces", () => {
    const aCard = dcard(
      { color: "red", kind: "number", value: 3 },
      { color: "teal", kind: "draw5", value: null },
    );
    const bCard = dcard(
      { color: "yellow", kind: "number", value: 7 },
      { color: "purple", kind: "skipAll", value: null },
    );
    const s = baseState(
      [mkPlayer("a", [aCard]), mkPlayer("b", [bCard])],
      { mode: "flip", side: "light" },
    );

    const lightView = engine.getPlayerView(s, "a");
    expect(lightView.players.find((player) => player.id === "a")!.visibleBackFaces).toEqual([]);
    const opponent = lightView.players.find((player) => player.id === "b")!;
    expect(opponent.visibleBackFaces).toEqual([
      { color: "purple", kind: "skipAll", value: null },
    ]);
    expect(JSON.stringify(opponent.visibleBackFaces)).not.toContain(bCard.id);
    expect(opponent.visibleBackFaces).not.toContainEqual(
      expect.objectContaining({ color: "yellow", value: 7 }),
    );
    expect(lightView.yourHand[0]).toEqual({
      id: aCard.id,
      color: "red",
      kind: "number",
      value: 3,
    });
    expect(lightView.yourHand[0].dark).toBeUndefined();

    s.side = "dark";
    const darkView = engine.getPlayerView(s, "a");
    expect(darkView.players[1].visibleBackFaces).toEqual([
      { color: "yellow", kind: "number", value: 7 },
    ]);
    expect(darkView.yourHand[0]).toEqual({
      id: aCard.id,
      color: "teal",
      kind: "draw5",
      value: null,
    });
    expect(darkView.yourHand[0].dark).toBeUndefined();

    const spectator = engine.getPlayerView(s, "spectator");
    expect(spectator.yourHand).toEqual([]);
    expect(spectator.players.every((player) => player.visibleBackFaces.length === 1)).toBe(true);
    expect(JSON.stringify(spectator.players)).not.toContain(aCard.id);
    expect(JSON.stringify(spectator.players)).not.toContain(bCard.id);
  });

  it("redacts the inactive face from projected Flip event cards", () => {
    const played = dcard(
      { color: "red", kind: "number", value: 3 },
      { color: "teal", kind: "draw5", value: null },
    );
    const s = baseState(
      [mkPlayer("a", [num("red", 1)]), mkPlayer("b", [num("blue", 2)])],
      {
        mode: "flip",
        events: [{ id: 1, type: "play", by: "a", card: played, side: "light" }],
        eventSeq: 1,
      },
    );

    expect(engine.getPlayerView(s, "b").events[0].card).toEqual({
      id: played.id,
      color: "red",
      kind: "number",
      value: 3,
    });
  });

  it("does not project an expired player as UNO-vulnerable", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const card = num("red", 5);
    const s = baseState([
      mkPlayer("a", [card, num("blue", 8)]),
      mkPlayer("b", [num("green", 1)]),
    ]);
    engine.play(s, "a", card.id);
    jest.advanceTimersByTime(3_000);

    const player = engine.getPlayerView(s, "b").players.find(({ id }) => id === "a")!;
    expect(player.unoVulnerable).toBe(false);
    expect(engine.getPlayerView(s, "b").catchableIds).toEqual([]);
    jest.useRealTimers();
  });
});

// ─── Expansion: surrender, house rules, No Mercy, Flip ───

let gid = 0;
const gcard = (
  color: UnoColor | null,
  kind: UnoCard["kind"],
  value: number | null = null,
): UnoCard => ({ id: `g${gid++}`, color, kind, value });
const dcard = (light: Partial<UnoCard>, dark: UnoCard["dark"]): UnoCard => ({
  id: `d${gid++}`,
  color: light.color ?? null,
  kind: light.kind ?? "number",
  value: light.value ?? null,
  dark,
});

describe("UnoEngine surrender", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("two players: surrender hands the win to the other + ends match", () => {
    const s = baseState([
      mkPlayer("a", [num("red", 5)]),
      mkPlayer("b", [num("blue", 3)]),
    ]);
    const r = engine.surrender(s, "b");
    expect(r.roundResult?.matchOver).toBe(true);
    expect(r.roundResult?.matchWinnerId).toBe("a");
    expect(r.roundResult?.reason).toBe("lastStanding");
    expect(s.phase).toBe(UnoPhase.FINISHED);
  });

  it("three players: surrender continues; rotation skips the quitter", () => {
    const s = baseState([
      mkPlayer("a", [num("red", 5), num("red", 6)]),
      mkPlayer("b", [num("blue", 3)]),
      mkPlayer("c", [num("green", 2)]),
    ]);
    const r = engine.surrender(s, "b");
    expect(r.roundResult).toBeUndefined();
    expect(s.players[1].eliminated).toBe(true);
    expect(s.phase).toBe(UnoPhase.PLAYING);
    engine.play(s, "a", s.players[0].hand[0].id); // red5 on red7
    expect(s.currentIndex).toBe(2); // b skipped → c
  });

  it("transfers an opening Wild color choice when its player surrenders", () => {
    const s = baseState([
      mkPlayer("a", [num("red", 1)]),
      mkPlayer("b", [num("blue", 2)]),
      mkPlayer("c", [num("yellow", 3)]),
    ], { mode: "flip", openingColorBy: "a" });

    expect(engine.surrender(s, "a").ok).toBe(true);
    expect(s).toMatchObject({ currentIndex: 1, openingColorBy: "b" });
    expect(engine.getPlayerView(s, "b").canChooseOpeningColor).toBe(true);
  });
});

describe("UnoEngine house rules", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("Seven-0: playing a 7 swaps hands with a chosen player", () => {
    const seven = num("red", 7);
    const s = baseState(
      [
        mkPlayer("a", [seven, num("blue", 3)]),
        mkPlayer("b", [num("green", 1), num("green", 2), num("green", 4)]),
      ],
      { sevenZero: true },
    );
    engine.play(s, "a", seven.id);
    expect(s.pendingSevenBy).toBe("a");
    const r = engine.chooseSeven(s, "a", "b");
    expect(r.ok).toBe(true);
    expect(s.players[0].handCount).toBe(3);
    expect(s.players[1].handCount).toBe(1);
    expect(s.currentIndex).toBe(1);
  });

  it("Seven-0: playing a 0 rotates all hands in play direction", () => {
    const zero = num("red", 0);
    const s = baseState(
      [
        mkPlayer("a", [zero, num("blue", 3)]),
        mkPlayer("b", [num("green", 1)]),
        mkPlayer("c", [num("yellow", 2)]),
      ],
      { sevenZero: true },
    );
    engine.play(s, "a", zero.id);
    expect(s.players[0].hand[0].value).toBe(2); // a received c's hand
    expect(s.currentIndex).toBe(1);
  });

  it("Jump-In: an identical card can be played out of turn", () => {
    const bSeven = num("red", 7);
    const s = baseState(
      [
        mkPlayer("a", [num("red", 9)]),
        mkPlayer("b", [bSeven, num("blue", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        jumpIn: true,
        discardPile: [num("red", 7)],
        activeColor: "red",
        currentIndex: 0,
      },
    );
    const r = engine.jumpIn(s, "b", bSeven.id);
    expect(r.ok).toBe(true);
    expect(s.players[1].handCount).toBe(1);
    expect(s.currentIndex).toBe(2); // continues from b → c
    expect(engine.jumpIn(s, "c", s.players[2].hand[0].id).ok).toBe(false); // not identical
  });

  it("Draw to Match keeps drawing until a playable card appears", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawToMatch: true,
        drawPile: [num("red", 2), num("green", 9), num("yellow", 8)], // pop yellow,green,red2
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );
    engine.draw(s, "a");
    expect(s.players[0].handCount).toBe(4); // drew 3 to reach a red
    expect(s.drawnCardId).not.toBeNull();
  });

  it("Force Play forbids passing a drawn playable card", () => {
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        forcePlay: true,
        drawPile: [num("red", 2)],
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );
    engine.draw(s, "a");
    expect(engine.pass(s, "a").ok).toBe(false);
  });

  it("No Bluffing blocks a Wild Draw Four while a colour is held", () => {
    const w4 = wild("wild4");
    const s = baseState(
      [mkPlayer("a", [w4, num("red", 3)]), mkPlayer("b", [num("green", 1)])],
      {
        noBluffing: true,
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );
    expect(engine.play(s, "a", w4.id, "blue").ok).toBe(false);
    engine.getPlayerView(s, "a"); // legal ids must not include the wild4
    expect(engine.getPlayerView(s, "a").legalCardIds).not.toContain(w4.id);
  });

  it("No Bluffing also blocks a Flip Wild Draw Two while a colour is held", () => {
    const wd2: UnoCard = {
      id: "flip-no-bluff-wd2",
      color: null,
      kind: "wildDraw2",
      value: null,
      dark: { color: null, kind: "wild", value: null },
    };
    const s = baseState(
      [mkPlayer("a", [wd2, num("red", 3)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "flip",
        noBluffing: true,
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );

    expect(engine.play(s, "a", wd2.id, "blue")).toEqual({
      ok: false,
      error: "You still hold a matching colour",
    });
    expect(engine.getPlayerView(s, "a").legalCardIds).not.toContain(wd2.id);
  });

  it.each([7, 0])(
    "allows a final No Mercy %i to end the game before its hand-transfer effect",
    (value) => {
      const final = num("red", value);
      const s = baseState(
        [mkPlayer("a", [final]), mkPlayer("b", [num("green", 1)]), mkPlayer("c", [num("blue", 2)])],
        { mode: "noMercy", sevenZero: true, mercyLimit: 25 },
      );

      const result = engine.play(s, "a", final.id);

      expect(result.roundResult).toMatchObject({
        matchOver: true,
        matchWinnerId: "a",
      });
      expect(s).toMatchObject({
        phase: UnoPhase.FINISHED,
        matchWinnerId: "a",
        pendingSevenBy: null,
      });
    },
  );
});

describe("UnoEngine No Mercy", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("builds the official 168-card deck with every exact card quantity", () => {
    const deck = buildNoMercyDeck();
    expect(deck).toHaveLength(168);
    expect(new Set(deck.map((card) => card.id)).size).toBe(168);
    for (const color of ["red", "yellow", "green", "blue"] as const) {
      for (let value = 0; value <= 9; value += 1) {
        expect(deck.filter((card) => card.color === color && card.kind === "number" && card.value === value)).toHaveLength(2);
      }
      expect(deck.filter((card) => card.color === color && card.kind === "draw2")).toHaveLength(3);
      expect(deck.filter((card) => card.color === color && card.kind === "draw4")).toHaveLength(2);
      expect(deck.filter((card) => card.color === color && card.kind === "skip")).toHaveLength(3);
      expect(deck.filter((card) => card.color === color && card.kind === "skipAll")).toHaveLength(2);
      expect(deck.filter((card) => card.color === color && card.kind === "reverse")).toHaveLength(3);
      expect(deck.filter((card) => card.color === color && card.kind === "discardAll")).toHaveLength(3);
    }
    expect(deck.filter((card) => card.kind === "reverseDraw4")).toHaveLength(8);
    expect(deck.filter((card) => card.kind === "draw6")).toHaveLength(4);
    expect(deck.filter((card) => card.kind === "draw10")).toHaveLength(4);
    expect(deck.filter((card) => card.kind === "wildColorRoulette")).toHaveLength(8);
    expect(deck.some((card) => card.kind === "wild" || card.kind === "wild4")).toBe(false);
  });

  it("forces draw-to-play, 7 swap, 0 pass, and exact mercy defaults", () => {
    const state = engine.initRound(
      "g",
      "123456",
      ["a", "b"],
      { a: "A", b: "B" },
      {
        mode: "noMercy",
        targetScore: null,
        stacking: false,
        drawToMatch: false,
        jumpIn: false,
        sevenZero: false,
        forcePlay: false,
        noBluffing: false,
      },
    );
    expect(state).toMatchObject({
      stacking: true,
      drawToMatch: true,
      sevenZero: true,
      forcePlay: true,
      mercyLimit: 25,
    });
  });

  it("draws until a playable card and does not allow passing it", () => {
    const playable = num("red", 2);
    const s = baseState(
      [mkPlayer("a", [num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "noMercy",
        drawToMatch: true,
        forcePlay: true,
        mercyLimit: 25,
        drawPile: [playable, num("green", 9), num("yellow", 8)],
      },
    );
    expect(engine.draw(s, "a").ok).toBe(true);
    expect(s.players[0].handCount).toBe(4);
    expect(s.drawnCardId).toBe(playable.id);
    expect(engine.pass(s, "a")).toEqual({ ok: false, error: "You must play the drawn card" });
  });

  it("forbids drawing while a playable card is already held", () => {
    const s = baseState(
      [mkPlayer("a", [num("red", 8)]), mkPlayer("b", [num("green", 1)])],
      { mode: "noMercy", drawToMatch: true, forcePlay: true, mercyLimit: 25 },
    );
    expect(engine.draw(s, "a")).toEqual({
      ok: false,
      error: "You already have a playable card",
    });
  });

  it("applies the official colored Draw Four and skips its victim", () => {
    const draw4 = gcard("red", "draw4");
    const s = baseState(
      [
        mkPlayer("a", [draw4, num("red", 9)]),
        mkPlayer("b", [num("blue", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: Array.from({ length: 6 }, (_, index) => num("yellow", index + 1)),
      },
    );
    engine.play(s, "a", draw4.id);
    expect(s.players[1].handCount).toBe(5);
    expect(s.currentIndex).toBe(2);
  });

  it("stacks only an equal-or-higher draw value", () => {
    const d6 = gcard(null, "draw6");
    const d2 = gcard("blue", "draw2");
    const d10 = gcard(null, "draw10");
    const pile = Array.from({ length: 12 }, (_, i) =>
      num("yellow", (i % 9) + 1),
    );
    const s = baseState(
      [
        mkPlayer("a", [d6, num("red", 9)]),
        mkPlayer("b", [d2, d10, num("green", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: pile,
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );
    engine.play(s, "a", d6.id, "red");
    expect(s.pendingDraw?.count).toBe(6);
    expect(engine.play(s, "b", d2.id)).toEqual({ ok: false, error: "You must take the cards" });
    expect(engine.play(s, "b", d10.id, "blue").ok).toBe(true);
    expect(s.players[2].handCount).toBe(17);
  });

  it("knocks a player out at the mercy limit → last standing wins", () => {
    const d2 = gcard("red", "draw2");
    const bHand = Array.from({ length: 24 }, () => num("blue", 1));
    const s = baseState(
      [mkPlayer("a", [d2, num("red", 9)]), mkPlayer("b", bHand)],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: [num("green", 1), num("green", 2), num("green", 3)],
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );
    const r = engine.play(s, "a", d2.id);
    expect(s.players[1].eliminated).toBe(true);
    expect(r.roundResult?.matchOver).toBe(true);
    expect(r.roundResult?.matchWinnerId).toBe("a");
  });

  it("advances past a current player eliminated by a manual draw", () => {
    const hand = Array.from({ length: 24 }, () => num("blue", 1));
    const s = baseState(
      [mkPlayer("a", hand), mkPlayer("b", [num("green", 1)]), mkPlayer("c", [num("yellow", 2)])],
      {
        mode: "noMercy",
        mercyLimit: 25,
        drawToMatch: false,
        drawPile: [num("blue", 7)],
      },
    );

    expect(engine.draw(s, "a").ok).toBe(true);
    expect(s.players[0]).toMatchObject({ eliminated: true, handCount: 0 });
    expect(s.currentIndex).toBe(1);
    expect(s.phase).toBe(UnoPhase.PLAYING);
  });

  it("Discard All sheds every card of the played colour", () => {
    const da = gcard("red", "discardAll");
    const s = baseState(
      [
        mkPlayer("a", [da, num("red", 3), num("red", 5), num("blue", 2)]),
        mkPlayer("b", [num("green", 1)]),
      ],
      { mode: "noMercy", discardPile: [num("red", 7)], activeColor: "red" },
    );
    engine.play(s, "a", da.id);
    expect(s.players[0].handCount).toBe(1); // only blue 2 remains
    expect(s.discardPile.map((card) => card.id)).toEqual(
      expect.arrayContaining([da.id]),
    );
    expect(s.discardPile).toHaveLength(4);
  });

  it("sets a mercy-eliminated hand aside until a reshuffle", () => {
    const d2 = gcard("red", "draw2");
    const victimHand = Array.from({ length: 24 }, () => num("blue", 1));
    const s = baseState(
      [mkPlayer("a", [d2, num("red", 9)]), mkPlayer("b", victimHand)],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: [num("green", 1), num("green", 2)],
      },
    );
    engine.play(s, "a", d2.id);
    expect(s.players[1].eliminated).toBe(true);
    expect(s.eliminatedCards).toHaveLength(25);
    expect(s.drawPile).toHaveLength(1);
  });

  it("makes the actor face Reverse Draw Four in a two-player game", () => {
    const reverse4 = gcard(null, "reverseDraw4");
    const s = baseState(
      [mkPlayer("a", [reverse4, num("red", 9)]), mkPlayer("b", [num("blue", 2)])],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: Array.from({ length: 6 }, (_, index) => num("yellow", index + 1)),
      },
    );
    engine.play(s, "a", reverse4.id, "blue");
    expect(s.direction).toBe(-1);
    expect(s.players[0].handCount).toBe(5);
    expect(s.players[1].handCount).toBe(1);
    expect(s.currentIndex).toBe(1);
  });

  it("lets the roulette victim choose a color, draw until it, and lose the turn", () => {
    const roulette = gcard(null, "wildColorRoulette");
    const s = baseState(
      [
        mkPlayer("a", [roulette, num("red", 9)]),
        mkPlayer("b", [num("green", 1)]),
        mkPlayer("c", [num("blue", 2)]),
      ],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: [num("red", 4), num("blue", 3), num("yellow", 2)],
      },
    );
    expect(engine.play(s, "a", roulette.id).ok).toBe(true);
    expect(s.activeColor).toBe("red");
    expect(engine.getPlayerView(s, "b").canChooseRouletteColor).toBe(true);
    expect(engine.chooseRouletteColor(s, "b", "red").ok).toBe(true);
    expect(s.players[1].handCount).toBe(4);
    expect(s.activeColor).toBe("red");
    expect(s.currentIndex).toBe(2);
  });

  it("draws past sixty cards until the selected roulette color appears", () => {
    const target = num("red", 4);
    const s = baseState(
      [mkPlayer("a", [num("yellow", 1)]), mkPlayer("b", [num("green", 1)]), mkPlayer("c", [num("blue", 2)])],
      {
        mode: "noMercy",
        mercyLimit: null,
        currentIndex: 1,
        drawPile: [target, ...Array.from({ length: 65 }, () => num("blue", 3))],
        pendingDraw: {
          count: 0,
          type: "wildColorRoulette",
          untilColor: null,
          challengeable: false,
          wild4By: null,
          wild4PrevColor: null,
          wild4WasBluff: null,
          reverseOnResolve: false,
        },
      },
    );

    expect(engine.chooseRouletteColor(s, "b", "red").ok).toBe(true);
    expect(s.players[1].handCount).toBe(67);
    expect(s.players[1].hand.at(-1)?.id).toBe(target.id);
    expect(s.currentIndex).toBe(2);
  });

  it("enforces the mercy limit after a mandatory seven hand swap", () => {
    const seven = num("red", 7);
    const largeHand = Array.from({ length: 25 }, () => num("blue", 1));
    const s = baseState(
      [mkPlayer("a", [seven, num("red", 3)]), mkPlayer("b", largeHand)],
      { mode: "noMercy", sevenZero: true, mercyLimit: 25 },
    );
    engine.play(s, "a", seven.id);
    expect(engine.chooseSeven(s, "a", "b").ok).toBe(true);
    expect(s.players[0].eliminated).toBe(true);
    expect(s.eliminatedCards).toHaveLength(25);
  });

  it("ends immediately when the final card is a draw action", () => {
    const draw10 = gcard(null, "draw10");
    const s = baseState(
      [mkPlayer("a", [draw10]), mkPlayer("b", [num("blue", 1)])],
      {
        mode: "noMercy",
        stacking: true,
        mercyLimit: 25,
        drawPile: Array.from({ length: 12 }, () => num("yellow", 1)),
      },
    );
    const result = engine.play(s, "a", draw10.id, "red");
    expect(result.roundResult?.matchWinnerId).toBe("a");
    expect(s.players[1].handCount).toBe(1);
    expect(s.lastResult).toEqual(result.roundResult);
    expect(engine.getPlayerView(s, "b").lastResult).toEqual(result.roundResult);
  });
});

describe("UnoEngine Flip", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("builds all 112 physical cards with complete light and dark faces", () => {
    const deck = buildFlipDeck();
    expect(deck).toHaveLength(112);
    expect(new Set(deck.map((card) => card.id)).size).toBe(112);
    expect(deck.every((card) => card.dark)).toBe(true);
    for (const color of ["red", "yellow", "green", "blue"] as const) {
      for (let value = 1; value <= 9; value += 1) {
        expect(deck.filter((card) => card.color === color && card.kind === "number" && card.value === value)).toHaveLength(2);
      }
      for (const kind of ["draw1", "skip", "reverse", "flip"] as const) {
        expect(deck.filter((card) => card.color === color && card.kind === kind)).toHaveLength(2);
      }
    }
    for (const color of ["teal", "orange", "pink", "purple"] as const) {
      for (let value = 1; value <= 9; value += 1) {
        expect(deck.filter((card) => card.dark?.color === color && card.dark.kind === "number" && card.dark.value === value)).toHaveLength(2);
      }
      for (const kind of ["draw5", "skipAll", "reverse", "flip"] as const) {
        expect(deck.filter((card) => card.dark?.color === color && card.dark.kind === kind)).toHaveLength(2);
      }
    }
    expect(deck.filter((card) => card.kind === "wild")).toHaveLength(4);
    expect(deck.filter((card) => card.kind === "wildDraw2")).toHaveLength(4);
    expect(deck.filter((card) => card.dark?.kind === "wild")).toHaveLength(4);
    expect(deck.filter((card) => card.dark?.kind === "wildDrawColor")).toHaveLength(4);
  });

  it("applies Light Draw One and Dark Draw Five penalties with a skipped turn", () => {
    const drawOne = dcard(
      { color: "red", kind: "draw1" },
      { color: "teal", kind: "number", value: 1 },
    );
    const light = baseState(
      [
        mkPlayer("a", [drawOne, num("red", 9)]),
        mkPlayer("b", [num("blue", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      { mode: "flip", drawPile: [num("yellow", 4)] },
    );
    engine.play(light, "a", drawOne.id);
    expect(light.players[1].handCount).toBe(2);
    expect(light.currentIndex).toBe(2);

    const drawFive = dcard(
      { color: "red", kind: "number", value: 1 },
      { color: "teal", kind: "draw5", value: null },
    );
    const darkTop = dcard(
      { color: "red", kind: "number", value: 2 },
      { color: "teal", kind: "number", value: 2 },
    );
    const dark = baseState(
      [
        mkPlayer("a", [drawFive, num("red", 9)]),
        mkPlayer("b", [num("blue", 1)]),
        mkPlayer("c", [num("green", 2)]),
      ],
      {
        mode: "flip",
        side: "dark",
        activeColor: "teal",
        discardPile: [darkTop],
        drawPile: Array.from({ length: 7 }, (_, index) => num("yellow", index + 1)),
      },
    );
    engine.play(dark, "a", drawFive.id);
    expect(dark.players[1].handCount).toBe(6);
    expect(dark.currentIndex).toBe(2);
  });

  it("returns play to the actor after Dark Skip Everyone", () => {
    const skipAll = dcard(
      { color: "red", kind: "number", value: 1 },
      { color: "purple", kind: "skipAll", value: null },
    );
    const top = dcard(
      { color: "red", kind: "number", value: 2 },
      { color: "purple", kind: "number", value: 2 },
    );
    const s = baseState(
      [mkPlayer("a", [skipAll, num("red", 9)]), mkPlayer("b", [num("blue", 1)])],
      { mode: "flip", side: "dark", activeColor: "purple", discardPile: [top] },
    );
    engine.play(s, "a", skipAll.id);
    expect(s.currentIndex).toBe(0);
  });

  it("a Flip card reverses both piles and uses the newly exposed top face", () => {
    const flip = dcard(
      { color: "red", kind: "flip" },
      { color: "teal", kind: "flip", value: null },
    );
    const oldBottom = dcard(
      { color: "red", kind: "number", value: 7 },
      { color: "orange", kind: "number", value: 4 },
    );
    const oldTop = dcard(
      { color: "red", kind: "number", value: 5 },
      { color: "purple", kind: "number", value: 8 },
    );
    const drawBottom = dcard(
      { color: "blue", kind: "number", value: 2 },
      { color: "pink", kind: "number", value: 3 },
    );
    const drawTop = dcard(
      { color: "yellow", kind: "number", value: 6 },
      { color: "teal", kind: "number", value: 9 },
    );
    const s = baseState(
      [mkPlayer("a", [flip, num("blue", 3)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "flip",
        side: "light",
        discardPile: [oldBottom, oldTop],
        drawPile: [drawBottom, drawTop],
        activeColor: "red",
      },
    );
    engine.play(s, "a", flip.id);
    expect(s.side).toBe("dark");
    expect(s.activeColor).toBe("orange");
    expect(s.discardPile.map((card) => card.id)).toEqual([
      flip.id,
      oldTop.id,
      oldBottom.id,
    ]);
    expect(s.drawPile.map((card) => card.id)).toEqual([
      drawTop.id,
      drawBottom.id,
    ]);
    expect(s.currentIndex).toBe(1);
  });

  it("a Dark Flip card returns to the Light side and its light color", () => {
    const flip = dcard(
      { color: "yellow", kind: "flip" },
      { color: "pink", kind: "flip", value: null },
    );
    const top = dcard(
      { color: "blue", kind: "number", value: 2 },
      { color: "pink", kind: "number", value: 2 },
    );
    const s = baseState(
      [mkPlayer("a", [flip, num("blue", 3)]), mkPlayer("b", [num("green", 1)])],
      { mode: "flip", side: "dark", discardPile: [top], activeColor: "pink" },
    );
    engine.play(s, "a", flip.id);
    expect(s.side).toBe("light");
    expect(s.activeColor).toBe("blue");
  });

  it("supports a successful Wild Draw Two bluff challenge", () => {
    const wildDrawTwo = dcard(
      { color: null, kind: "wildDraw2" },
      { color: null, kind: "wild", value: null },
    );
    const s = baseState(
      [
        mkPlayer("a", [wildDrawTwo, num("red", 9)]),
        mkPlayer("b", [num("green", 1)]),
      ],
      { mode: "flip", drawPile: [num("yellow", 1), num("yellow", 2)] },
    );
    engine.play(s, "a", wildDrawTwo.id, "blue");
    expect(engine.challenge(s, "b").ok).toBe(true);
    expect(s.players[0].handCount).toBe(3);
    expect(s.currentIndex).toBe(1);
  });

  it("scores by the side in play (Flip table)", () => {
    const c = dcard(
      { color: "red", kind: "number", value: 5 },
      { color: "teal", kind: "draw5", value: null },
    );
    expect(cardPoints(c, "light", "flip")).toBe(5);
    expect(cardPoints(c, "dark", "flip")).toBe(20);
    const wdc = dcard(
      { color: "red", kind: "number", value: 1 },
      { color: null, kind: "wildDrawColor", value: null },
    );
    expect(cardPoints(wdc, "dark", "flip")).toBe(60);
  });

  it.each([
    ["draw1", 10],
    ["draw5", 20],
    ["reverse", 20],
    ["skip", 20],
    ["flip", 20],
    ["skipAll", 30],
    ["wild", 40],
    ["wildDraw2", 50],
    ["wildDrawColor", 60],
  ] as const)("scores Flip %s at %i points", (kind, points) => {
    const card = gcard(null, kind);
    expect(cardPoints(card, "light", "flip")).toBe(points);
  });

  it("Wild Draw Color sets a draw-until-colour penalty", () => {
    const wdc = dcard(
      { color: "red", kind: "number", value: 1 },
      { color: null, kind: "wildDrawColor", value: null },
    );
    const top = dcard(
      { color: "red", kind: "number", value: 2 },
      { color: "teal", kind: "number", value: 2 },
    );
    const bCard = dcard(
      { color: "red", kind: "number", value: 3 },
      { color: "orange", kind: "number", value: 3 },
    );
    const s = baseState(
      [mkPlayer("a", [wdc, num("blue", 8)]), mkPlayer("b", [bCard])],
      { mode: "flip", side: "dark", discardPile: [top], activeColor: "teal" },
    );
    engine.play(s, "a", wdc.id, "orange");
    expect(s.pendingDraw?.type).toBe("wildDrawColor");
    expect(s.pendingDraw?.untilColor).toBe("orange");
  });
});

import { UnoEngine } from "./uno.engine";
import { buildDeck, cardMatches, cardPoints } from "./uno.utils";
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
    discardPile: [num("red", 7)],
    activeColor: "red",
    pendingDraw: null,
    pendingSevenBy: null,
    drawnCardId: null,
    unoWindowFor: null,
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
    events: [],
    eventSeq: 0,
    startedAt: now,
    finishedAt: null,
    ...overrides,
  };
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
    expect(s.unoWindowFor).toBe("a");
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
    expect(s.unoWindowFor).toBeNull();
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

  it("closes the window (no penalty) once the next player acts", () => {
    const c = num("red", 5);
    const s = baseState(
      [mkPlayer("a", [c, num("blue", 8)]), mkPlayer("b", [num("green", 1)])],
      {
        drawPile: [num("yellow", 9)],
      },
    );
    engine.play(s, "a", c.id); // a → 1 card, window open, turn to b
    engine.draw(s, "b"); // b acts → window closes
    expect(s.unoWindowFor).toBeNull();
    expect(engine.catchPlayer(s, "b", "a").ok).toBe(false);
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
});

describe("UnoEngine No Mercy", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("stacks any draw card and accumulates the penalty", () => {
    const d6 = gcard("red", "draw6");
    const d2 = gcard("blue", "draw2");
    const pile = Array.from({ length: 12 }, (_, i) =>
      num("yellow", (i % 9) + 1),
    );
    const s = baseState(
      [
        mkPlayer("a", [d6, num("red", 9)]),
        mkPlayer("b", [d2, num("green", 1)]),
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
    engine.play(s, "a", d6.id);
    expect(s.pendingDraw?.count).toBe(6);
    engine.play(s, "b", d2.id); // stacks → 8, c can't stack → auto-takes 8
    expect(s.players[2].handCount).toBe(9);
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
  });
});

describe("UnoEngine Flip", () => {
  let engine: UnoEngine;
  beforeEach(() => (engine = new UnoEngine()));

  it("a Flip card toggles the side and colour follows the dark face", () => {
    const flip = dcard(
      { color: "red", kind: "flip" },
      { color: "teal", kind: "flip", value: null },
    );
    const s = baseState(
      [mkPlayer("a", [flip, num("blue", 3)]), mkPlayer("b", [num("green", 1)])],
      {
        mode: "flip",
        side: "light",
        discardPile: [num("red", 7)],
        activeColor: "red",
      },
    );
    engine.play(s, "a", flip.id);
    expect(s.side).toBe("dark");
    expect(s.activeColor).toBe("teal");
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

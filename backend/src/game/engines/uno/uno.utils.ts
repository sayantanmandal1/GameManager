import {
  UnoCard,
  UnoCardFace,
  UnoColor,
  UnoLightColor,
  UnoSide,
  UnoMode,
  UnoDrawKind,
  UNO_LIGHT_COLORS,
  UNO_DARK_COLORS,
  UNO_CONSTANTS,
} from '../../../shared';

/** The active printed face of a card given the side in play. */
export function faceOf(card: UnoCard, side: UnoSide): UnoCardFace {
  if (side === 'dark' && card.dark) return card.dark;
  return { color: card.color, kind: card.kind, value: card.value };
}

const WILD_KINDS = new Set([
  'wild',
  'wild4',
  'wildDraw2',
  'wildDrawColor',
  'draw6',
  'draw10',
  'reverseDraw4',
  'wildColorRoulette',
]);
export function isWildKind(kind: string): boolean {
  return WILD_KINDS.has(kind);
}

const DRAW_AMOUNT: Record<string, number> = {
  draw1: 1,
  draw2: 2,
  draw4: 4,
  wild4: 4,
  wildDraw2: 2,
  draw5: 5,
  draw6: 6,
  draw10: 10,
  reverseDraw4: 4,
  wildDrawColor: 0,
  wildColorRoulette: 0,
};
export function isDrawKind(kind: string): kind is UnoDrawKind {
  return kind in DRAW_AMOUNT;
}
export function drawAmount(kind: string): number {
  return DRAW_AMOUNT[kind] ?? 0;
}

export function matchesFace(
  face: UnoCardFace,
  activeColor: UnoColor,
  top: UnoCardFace | null,
): boolean {
  if (isWildKind(face.kind)) return true;
  if (face.color === activeColor) return true;
  if (!top) return false;
  if (face.kind === 'number' && top.kind === 'number' && face.value === top.value)
    return true;
  if (face.kind !== 'number' && face.kind === top.kind) return true;
  return false;
}

export function cardMatches(
  card: UnoCard,
  activeColor: UnoColor,
  top: UnoCard | null,
  side: UnoSide = 'light',
): boolean {
  return matchesFace(
    faceOf(card, side),
    activeColor,
    top ? faceOf(top, side) : null,
  );
}

export function isWild(card: UnoCard, side: UnoSide = 'light'): boolean {
  return isWildKind(faceOf(card, side).kind);
}

// ─── Scoring ───

function flipPoints(face: UnoCardFace): number {
  if (face.kind === 'number') return face.value ?? 0;
  switch (face.kind) {
    case 'draw1':
      return 10;
    case 'draw5':
    case 'reverse':
    case 'skip':
    case 'flip':
      return 20;
    case 'skipAll':
      return 30;
    case 'wild':
      return 40;
    case 'wildDraw2':
      return 50;
    case 'wildDrawColor':
      return 60;
    default:
      return 20;
  }
}

export function cardPoints(card: UnoCard, side: UnoSide, mode: UnoMode): number {
  const f = faceOf(card, side);
  if (mode === 'flip') return flipPoints(f);
  if (f.kind === 'number') return f.value ?? 0;
  if (isWildKind(f.kind)) return UNO_CONSTANTS.WILD_CARD_POINTS;
  return UNO_CONSTANTS.ACTION_CARD_POINTS;
}

export function handPoints(
  hand: readonly UnoCard[],
  side: UnoSide,
  mode: UnoMode,
): number {
  return hand.reduce((s, c) => s + cardPoints(c, side, mode), 0);
}

// ─── Shuffling ───

export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Deck builders ───

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}
const face = (
  color: UnoColor | null,
  kind: UnoCard['kind'],
  value: number | null,
): UnoCardFace => ({ color, kind, value });

/** Classic 108-card deck. */
export function buildClassicDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  const push = (color: UnoLightColor | null, kind: UnoCard['kind'], value: number | null) =>
    cards.push({ id: nextId(`${color ?? kind}-${kind}`), color, kind, value });
  for (const color of UNO_LIGHT_COLORS) {
    push(color, 'number', 0);
    for (let v = 1; v <= 9; v += 1) {
      push(color, 'number', v);
      push(color, 'number', v);
    }
    for (const kind of ['skip', 'reverse', 'draw2'] as const) {
      push(color, kind, null);
      push(color, kind, null);
    }
  }
  for (let i = 0; i < 4; i += 1) push(null, 'wild', null);
  for (let i = 0; i < 4; i += 1) push(null, 'wild4', null);
  return cards;
}

/** Back-compat alias used by tests. */
export function buildDeck(): UnoCard[] {
  return buildClassicDeck();
}

/** Official 168-card Show 'Em No Mercy deck. */
export function buildNoMercyDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  const push = (color: UnoLightColor | null, kind: UnoCard['kind'], value: number | null) =>
    cards.push({ id: nextId(`nm-${color ?? kind}-${kind}`), color, kind, value });
  for (const color of UNO_LIGHT_COLORS) {
    for (let v = 0; v <= 9; v += 1) {
      push(color, 'number', v);
      push(color, 'number', v);
    }
    for (let copy = 0; copy < 3; copy += 1) push(color, 'draw2', null);
    for (let copy = 0; copy < 2; copy += 1) push(color, 'draw4', null);
    for (let copy = 0; copy < 3; copy += 1) push(color, 'skip', null);
    for (let copy = 0; copy < 2; copy += 1) push(color, 'skipAll', null);
    for (let copy = 0; copy < 3; copy += 1) push(color, 'reverse', null);
    for (let copy = 0; copy < 3; copy += 1) push(color, 'discardAll', null);
  }
  for (let i = 0; i < 8; i += 1) push(null, 'reverseDraw4', null);
  for (let i = 0; i < 4; i += 1) push(null, 'draw6', null);
  for (let i = 0; i < 4; i += 1) push(null, 'draw10', null);
  for (let i = 0; i < 8; i += 1) push(null, 'wildColorRoulette', null);
  return cards;
}

/** Flip deck — every card double-sided (Light/Dark), paired by category. */
export function buildFlipDeck(): UnoCard[] {
  const light: UnoCardFace[] = [];
  const dark: UnoCardFace[] = [];
  for (const color of UNO_LIGHT_COLORS) {
    for (let v = 1; v <= 9; v += 1) {
      light.push(face(color, 'number', v));
      light.push(face(color, 'number', v));
    }
    for (const kind of ['draw1', 'skip', 'reverse', 'flip'] as const) {
      light.push(face(color, kind, null));
      light.push(face(color, kind, null));
    }
  }
  for (let i = 0; i < 4; i += 1) light.push(face(null, 'wild', null));
  for (let i = 0; i < 4; i += 1) light.push(face(null, 'wildDraw2', null));

  for (const color of UNO_DARK_COLORS) {
    for (let v = 1; v <= 9; v += 1) {
      dark.push(face(color, 'number', v));
      dark.push(face(color, 'number', v));
    }
    for (const kind of ['draw5', 'skipAll', 'reverse', 'flip'] as const) {
      dark.push(face(color, kind, null));
      dark.push(face(color, kind, null));
    }
  }
  for (let i = 0; i < 4; i += 1) dark.push(face(null, 'wild', null));
  for (let i = 0; i < 4; i += 1) dark.push(face(null, 'wildDrawColor', null));

  // Pair by category so Flip↔Flip and Wild↔Wild stay coherent.
  const cat = (f: UnoCardFace): 'flip' | 'wild' | 'other' =>
    f.kind === 'flip' ? 'flip' : isWildKind(f.kind) ? 'wild' : 'other';
  const buckets = (list: UnoCardFace[]) => ({
    flip: shuffle(list.filter((f) => cat(f) === 'flip')),
    wild: shuffle(list.filter((f) => cat(f) === 'wild')),
    other: shuffle(list.filter((f) => cat(f) === 'other')),
  });
  const lb = buckets(light);
  const db = buckets(dark);
  const cards: UnoCard[] = [];
  for (const key of ['flip', 'wild', 'other'] as const) {
    const n = Math.min(lb[key].length, db[key].length);
    for (let i = 0; i < n; i += 1) {
      const l = lb[key][i];
      cards.push({
        id: nextId(`flip-${key}`),
        color: l.color,
        kind: l.kind,
        value: l.value,
        dark: db[key][i],
      });
    }
  }
  return cards;
}

export function buildDeckForMode(mode: UnoMode): UnoCard[] {
  if (mode === 'noMercy') return buildNoMercyDeck();
  if (mode === 'flip') return buildFlipDeck();
  return buildClassicDeck();
}

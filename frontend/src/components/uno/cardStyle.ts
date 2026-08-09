import type { UnoCard, UnoCardFace, UnoColor, UnoSide } from '@/shared';

export const UNO_COLOR_HEX: Record<
  UnoColor,
  { bg: string; deep: string; glow: string }
> = {
  red: { bg: '#e63946', deep: '#b5252f', glow: 'rgba(230,57,70,0.6)' },
  yellow: { bg: '#f2c31d', deep: '#c99a00', glow: 'rgba(242,195,29,0.6)' },
  green: { bg: '#3aae5a', deep: '#2b8043', glow: 'rgba(58,174,90,0.6)' },
  blue: { bg: '#2b7fe0', deep: '#1f5aa8', glow: 'rgba(43,127,224,0.6)' },
  teal: { bg: '#12b5a5', deep: '#0c8175', glow: 'rgba(18,181,165,0.6)' },
  orange: { bg: '#f2812b', deep: '#c25f16', glow: 'rgba(242,129,43,0.6)' },
  pink: { bg: '#ec4d9b', deep: '#c02c78', glow: 'rgba(236,77,155,0.6)' },
  purple: { bg: '#8b5cf6', deep: '#6b3fd0', glow: 'rgba(139,92,246,0.6)' },
};

export const COLOR_NAME: Record<UnoColor, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  teal: 'Teal',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
};

const WILD_KINDS = new Set([
  'wild',
  'wild4',
  'wildDraw2',
  'wildDrawColor',
  'draw10',
  'reverseDraw4',
]);
export function isWildKind(kind: string): boolean {
  return WILD_KINDS.has(kind);
}

/** The active printed face given the side in play. */
export function faceOf(card: UnoCard, side: UnoSide): UnoCardFace {
  if (side === 'dark' && card.dark) return card.dark;
  return { color: card.color, kind: card.kind, value: card.value };
}

/** Central glyph for a colour card (not shown for wilds — they show the wheel). */
export function cardGlyph(face: UnoCardFace): string {
  switch (face.kind) {
    case 'number':
      return String(face.value ?? '');
    case 'skip':
      return '\u2298';
    case 'skipAll':
      return '\u2298\u2298';
    case 'reverse':
      return '\u21C4';
    case 'flip':
      return '\u21C5';
    case 'discardAll':
      return '\u21CA';
    case 'draw1':
      return '+1';
    case 'draw2':
      return '+2';
    case 'draw5':
      return '+5';
    case 'draw6':
      return '+6';
    default:
      return '';
  }
}

/** Overlay text on the wheel for wild-draw cards. */
export function wildOverlay(kind: string): string {
  switch (kind) {
    case 'wild4':
    case 'reverseDraw4':
      return '+4';
    case 'wildDraw2':
      return '+2';
    case 'draw10':
      return '+10';
    case 'wildDrawColor':
      return '+?';
    default:
      return '';
  }
}

export function cornerGlyph(face: UnoCardFace): string {
  if (face.kind === 'wild') return '\u2726';
  if (isWildKind(face.kind)) return wildOverlay(face.kind);
  return cardGlyph(face);
}

export function cardAriaLabel(face: UnoCardFace): string {
  const color = face.color ? COLOR_NAME[face.color] : 'Wild';
  const names: Record<string, string> = {
    number: `${color} ${face.value}`,
    skip: `${color} Skip`,
    skipAll: `${color} Skip Everyone`,
    reverse: `${color} Reverse`,
    flip: `${color} Flip`,
    discardAll: `${color} Discard All`,
    draw1: `${color} Draw One`,
    draw2: `${color} Draw Two`,
    draw5: `${color} Draw Five`,
    draw6: `${color} Draw Six`,
    wild: 'Wild',
    wild4: 'Wild Draw Four',
    wildDraw2: 'Wild Draw Two',
    wildDrawColor: 'Wild Draw Color',
    draw10: 'Wild Draw Ten',
    reverseDraw4: 'Reverse Draw Four',
  };
  return names[face.kind] ?? color;
}

export const WILD_WHEEL_LIGHT =
  'conic-gradient(#e63946 0deg 90deg, #f2c31d 90deg 180deg, #3aae5a 180deg 270deg, #2b7fe0 270deg 360deg)';
export const WILD_WHEEL_DARK =
  'conic-gradient(#12b5a5 0deg 90deg, #f2812b 90deg 180deg, #ec4d9b 180deg 270deg, #8b5cf6 270deg 360deg)';
/** Back-compat default. */
export const WILD_WHEEL = WILD_WHEEL_LIGHT;

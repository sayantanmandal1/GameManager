import type {
  PhotoboothThemeId,
  PhotoboothFilter,
  PhotoboothLayout,
} from '@/shared';

/**
 * Visual design system for the Photobooth. The server only ever stores theme /
 * filter / layout *ids* (validated against allow-lists); all styling lives
 * here on the client so nothing user-controlled becomes raw CSS.
 */

export interface ThemeStyle {
  id: PhotoboothThemeId;
  name: string;
  pack: 'simple' | 'pattern';
  /** Background applied to the strip frame (the matting around the photos). */
  frame: string;
  /** Ink colour for the date stamp + watermark. */
  ink: string;
  /** Soft accent used for chips / glows in the picker. */
  accent: string;
}

// Layered CSS gradients keep every theme self-contained (no image assets) and
// render crisply at any strip size.
export const THEME_STYLES: Record<PhotoboothThemeId, ThemeStyle> = {
  // ── Simple (solid-ish) themes ──
  classic: {
    id: 'classic',
    name: 'classic',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%)',
    ink: '#3f3f46',
    accent: '#e4e4e7',
  },
  cream: {
    id: 'cream',
    name: 'cream',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #f3e7cf 0%, #ecdcbb 100%)',
    ink: '#7c6540',
    accent: '#e6d3a8',
  },
  blush: {
    id: 'blush',
    name: 'blush',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #ffd9e4 0%, #ffc2d6 100%)',
    ink: '#b23a67',
    accent: '#ffb6cd',
  },
  midnight: {
    id: 'midnight',
    name: 'midnight',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #23232b 0%, #16161c 100%)',
    ink: '#e7c6ff',
    accent: '#3a3a46',
  },
  sky: {
    id: 'sky',
    name: 'sky',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #cdeafe 0%, #a9d8fb 100%)',
    ink: '#2f6ea3',
    accent: '#a9d8fb',
  },
  sage: {
    id: 'sage',
    name: 'sage',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #d7e8d2 0%, #bcd8b4 100%)',
    ink: '#4d6b46',
    accent: '#bcd8b4',
  },
  lavender: {
    id: 'lavender',
    name: 'lavender',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #e6dbfb 0%, #d3c2f5 100%)',
    ink: '#6b53a8',
    accent: '#d3c2f5',
  },
  butter: {
    id: 'butter',
    name: 'butter',
    pack: 'simple',
    frame: 'linear-gradient(180deg, #fff3c9 0%, #ffe89a 100%)',
    ink: '#a8842a',
    accent: '#ffe89a',
  },

  // ── Pattern themes ──
  denim: {
    id: 'denim',
    name: 'denim',
    pack: 'pattern',
    frame:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 3px, transparent 3px 7px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.06) 0 3px, transparent 3px 7px), linear-gradient(180deg, #5578ad 0%, #2b4a7a 100%)',
    ink: '#eaf1ff',
    accent: '#6d92c9',
  },
  tulips: {
    id: 'tulips',
    name: 'tulips',
    pack: 'pattern',
    frame:
      'radial-gradient(circle at 50% 50%, rgba(255,110,150,0.55) 0 4px, transparent 5px) 0 0 / 26px 26px, radial-gradient(circle at 50% 50%, rgba(255,150,185,0.4) 0 3px, transparent 4px) 13px 13px / 26px 26px, linear-gradient(180deg, #eef7e6 0%, #d8ebc8 100%)',
    ink: '#5a7a3f',
    accent: '#c9e0b4',
  },
  meadow: {
    id: 'meadow',
    name: 'meadow',
    pack: 'pattern',
    frame:
      'radial-gradient(circle at 50% 50%, rgba(255,241,150,0.9) 0 3px, transparent 4px) 0 0 / 24px 24px, radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0 2px, transparent 3px) 12px 12px / 24px 24px, linear-gradient(180deg, #bfe3a8 0%, #93cc80 100%)',
    ink: '#3f6b39',
    accent: '#98cf86',
  },
  sunset: {
    id: 'sunset',
    name: 'sunset',
    pack: 'pattern',
    frame:
      'radial-gradient(130% 90% at 50% 115%, rgba(255,221,130,0.65) 0%, transparent 55%), linear-gradient(180deg, #ff9a76 0%, #ff6f9c 55%, #b25aa8 100%)',
    ink: '#fff3ec',
    accent: '#ff9a76',
  },
  rosegarden: {
    id: 'rosegarden',
    name: 'rose garden',
    pack: 'pattern',
    frame:
      'radial-gradient(circle at 50% 50%, rgba(214,51,108,0.4) 0 5px, transparent 6px) 0 0 / 30px 30px, radial-gradient(circle at 50% 50%, rgba(214,51,108,0.25) 0 3px, transparent 4px) 15px 15px / 30px 30px, linear-gradient(180deg, #ffe0ec 0%, #ffc7dd 100%)',
    ink: '#a5325f',
    accent: '#ffc7dd',
  },
  starry: {
    id: 'starry',
    name: 'starry',
    pack: 'pattern',
    frame:
      'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0 1.5px, transparent 2.5px) 0 0 / 22px 22px, radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6) 0 1px, transparent 2px) 11px 11px / 22px 22px, linear-gradient(180deg, #2b2b5e 0%, #15152e 100%)',
    ink: '#e7defb',
    accent: '#4a4a86',
  },
};

export const THEME_LIST: ThemeStyle[] = Object.values(THEME_STYLES);
export const SIMPLE_THEMES = THEME_LIST.filter((t) => t.pack === 'simple');
export const PATTERN_THEMES = THEME_LIST.filter((t) => t.pack === 'pattern');

/**
 * Two solid gradient stops per theme, used when baking the strip onto a
 * `<canvas>` for download (canvas can't parse the layered CSS `frame`).
 * Chosen to match each theme's dominant colours.
 */
export const THEME_DOWNLOAD: Record<PhotoboothThemeId, { from: string; to: string }> = {
  classic: { from: '#ffffff', to: '#f4f4f4' },
  cream: { from: '#f3e7cf', to: '#e7d3ab' },
  blush: { from: '#ffd9e4', to: '#ffbdd2' },
  midnight: { from: '#23232b', to: '#141419' },
  sky: { from: '#cdeafe', to: '#a4d4fb' },
  sage: { from: '#d7e8d2', to: '#b7d5ae' },
  lavender: { from: '#e6dbfb', to: '#cfbdf4' },
  butter: { from: '#fff3c9', to: '#ffe793' },
  denim: { from: '#4a6ea5', to: '#294874' },
  tulips: { from: '#eef7e6', to: '#d7e9c9' },
  meadow: { from: '#bfe3a8', to: '#8fca7c' },
  sunset: { from: '#ff9a76', to: '#b25aa8' },
  rosegarden: { from: '#ffe0ec', to: '#ffc0d9' },
  starry: { from: '#2b2b5e', to: '#15152e' },
};

export interface FilterStyle {
  id: PhotoboothFilter;
  name: string;
  /** CSS `filter` value — used for live preview AND baked into the download. */
  css: string;
}

export const FILTER_STYLES: Record<PhotoboothFilter, FilterStyle> = {
  none: { id: 'none', name: 'Original', css: 'none' },
  mono: { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.05)' },
  retro: {
    id: 'retro',
    name: 'Retro',
    css: 'sepia(0.45) saturate(1.35) contrast(1.05) brightness(1.03)',
  },
  film: {
    id: 'film',
    name: 'Film',
    css: 'contrast(1.18) saturate(0.92) brightness(1.02) sepia(0.12)',
  },
  noir: {
    id: 'noir',
    name: 'Noir',
    css: 'grayscale(1) contrast(1.35) brightness(0.95)',
  },
  warm: {
    id: 'warm',
    name: 'Warm',
    css: 'saturate(1.2) sepia(0.22) brightness(1.05) hue-rotate(-8deg)',
  },
};

export const FILTER_LIST: FilterStyle[] = Object.values(FILTER_STYLES);

export interface LayoutMeta {
  id: PhotoboothLayout;
  name: string;
  label: string;
  rows: number;
  cols: number;
}

export const LAYOUT_META: Record<PhotoboothLayout, LayoutMeta> = {
  'strip-1x4': {
    id: 'strip-1x4',
    name: 'classic strip',
    label: '1 × 4',
    rows: 4,
    cols: 1,
  },
  'grid-2x2': {
    id: 'grid-2x2',
    name: 'grid',
    label: '2 × 2',
    rows: 2,
    cols: 2,
  },
};

export const LAYOUT_LIST: LayoutMeta[] = Object.values(LAYOUT_META);

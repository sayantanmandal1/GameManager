// ─── Photobooth Type Definitions ───
//
// A calm, "lovey-dovey" 2-player couples activity inspired by getangie.com.
// Player 1 (host / left side) creates the room and picks the strip layout +
// theme. Both partners then capture one half of each photo. When BOTH have
// captured and confirmed, the combined row is revealed on the shared strip.
// Repeats until the strip is full, then partners pick a filter and download.

/** Number of photo rows per strip (both layouts). */
export const PHOTOBOOTH_SLOTS = 4;

/**
 * Hard cap on the length of an incoming base64 image data URL (characters).
 * ~500k chars ≈ ~375 KB decoded — comfortably below socket.io's 1 MB frame
 * limit. SECURITY_NOTE: bounds untrusted client payloads (OWASP: unbounded
 * input / DoS via oversized frames).
 */
export const PHOTOBOOTH_MAX_DATAURL_LENGTH = 500_000;

/** Minimum plausible data-URL length (rejects empty / truncated payloads). */
export const PHOTOBOOTH_MIN_DATAURL_LENGTH = 64;

/** Maximum decoded bytes retained for one half-photo. */
export const PHOTOBOOTH_MAX_DECODED_BYTES = 375_000;

/** Maximum decoded dimensions accepted from camera captures. */
export const PHOTOBOOTH_MAX_EDGE_PX = 2048;
export const PHOTOBOOTH_MAX_PIXELS = 4_194_304;

/** Process-wide limits for memory-heavy sessions and capture events. */
export const PHOTOBOOTH_MAX_ACTIVE_GAMES = 25;
export const PHOTOBOOTH_CAPTURE_RATE_CAPACITY = 4;
export const PHOTOBOOTH_CAPTURE_RATE_REFILL_PER_SEC = 1;

/**
 * Allow-list regex for capture payloads. Linear (no catastrophic
 * backtracking): a fixed prefix followed by a single greedy character class.
 */
export const PHOTOBOOTH_DATAURL_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export enum PhotoboothPhase {
  /** Host is choosing the strip layout + theme; guest waits & previews. */
  SETUP = 'setup',
  /** Both partners capture their half for the current round. */
  CAPTURE = 'capture',
  /** Strip complete — choose a filter and download the keepsake. */
  REVIEW = 'review',
}

/** Strip layouts. Both hold {@link PHOTOBOOTH_SLOTS} combined photos. */
export type PhotoboothLayout = 'strip-1x4' | 'grid-2x2';
export const PHOTOBOOTH_LAYOUTS: readonly PhotoboothLayout[] = [
  'strip-1x4',
  'grid-2x2',
];

/**
 * Theme identifiers. Visual styling for each lives on the client
 * ({@link components/photobooth/themes}); the server only validates the id
 * against this allow-list so a malicious client cannot inject arbitrary CSS.
 */
export type PhotoboothThemeId =
  // Simple (solid) themes
  | 'classic'
  | 'cream'
  | 'blush'
  | 'midnight'
  | 'sky'
  | 'sage'
  | 'lavender'
  | 'butter'
  // Pattern themes
  | 'denim'
  | 'tulips'
  | 'meadow'
  | 'sunset'
  | 'rosegarden'
  | 'starry';

export const PHOTOBOOTH_THEMES: readonly PhotoboothThemeId[] = [
  'classic',
  'cream',
  'blush',
  'midnight',
  'sky',
  'sage',
  'lavender',
  'butter',
  'denim',
  'tulips',
  'meadow',
  'sunset',
  'rosegarden',
  'starry',
];

/** Post-processing filters applied to the finished strip (client-side). */
export type PhotoboothFilter =
  | 'none'
  | 'mono'
  | 'retro'
  | 'film'
  | 'noir'
  | 'warm';
export const PHOTOBOOTH_FILTERS: readonly PhotoboothFilter[] = [
  'none',
  'mono',
  'retro',
  'film',
  'noir',
  'warm',
];

export type PhotoboothSide = 'left' | 'right';
export type PhotoboothRole = 'host' | 'guest';

/** One completed row of the strip: two half-photos placed side by side. */
export interface PhotoboothSlot {
  /** Left half — captured by the host. */
  left: string | null;
  /** Right half — captured by the guest. */
  right: string | null;
}

/** A player's in-flight capture for the current round. */
export interface PhotoboothCapture {
  dataUrl: string;
  confirmed: boolean;
}

/**
 * Authoritative server-side state. Not persisted to Redis (image blobs are
 * large); held in-memory by the GameService for the lifetime of the session.
 */
export interface PhotoboothGameState {
  gameId: string;
  lobbyCode: string;
  hostId: string;
  guestId: string | null;
  hostName: string;
  guestName: string;
  phase: PhotoboothPhase;
  layout: PhotoboothLayout;
  theme: PhotoboothThemeId;
  filter: PhotoboothFilter;
  /** 0-based index of the round currently being captured. */
  currentRound: number;
  totalRounds: number;
  /** Committed rows (length === totalRounds; entries fill in as rounds finish). */
  slots: PhotoboothSlot[];
  /** Per-round in-flight captures keyed by playerId. Cleared on commit. */
  pending: Record<string, PhotoboothCapture>;
  /** Player ids currently disconnected (for "partner reconnecting" UX). */
  disconnected: string[];
  createdAt: number;
  finishedAt: number | null;
}

/**
 * Player-safe projection broadcast to each partner. Photos are shared between
 * the two partners by design, EXCEPT a partner's still-unconfirmed capture is
 * withheld so both halves reveal together after both confirm.
 */
export interface PhotoboothPlayerView {
  gameId: string;
  lobbyCode: string;
  role: PhotoboothRole;
  side: PhotoboothSide;
  phase: PhotoboothPhase;
  layout: PhotoboothLayout;
  theme: PhotoboothThemeId;
  filter: PhotoboothFilter;
  currentRound: number;
  totalRounds: number;
  slots: PhotoboothSlot[];
  hostName: string;
  guestName: string;
  hostId: string;
  guestId: string | null;
  /** My own in-flight capture for this round (data URL) if any. */
  myCapture: string | null;
  iConfirmed: boolean;
  /** Whether my partner has confirmed their half this round. */
  partnerConfirmed: boolean;
  partnerConnected: boolean;
  finishedAt: number | null;
}

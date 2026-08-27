// ─── UNO Type Definitions ───
//
// Faithful to the official Mattel rules (2022 instruction sheet as summarised
// on Wikipedia). Kept byte-for-byte in sync with frontend/src/shared/types/uno.ts.
//
// Anti-cheat is structural: the authoritative UnoGameState (with every hand) is
// server-only. Clients only ever receive a redacted UnoPlayerView containing
// their own hand plus opponents' card COUNTS.

export type UnoLightColor = 'red' | 'yellow' | 'green' | 'blue';
export type UnoDarkColor = 'teal' | 'orange' | 'pink' | 'purple';
export type UnoColor = UnoLightColor | UnoDarkColor;

export const UNO_LIGHT_COLORS: readonly UnoLightColor[] = ['red', 'yellow', 'green', 'blue'];
export const UNO_DARK_COLORS: readonly UnoDarkColor[] = ['teal', 'orange', 'pink', 'purple'];
export const UNO_ALL_COLORS: readonly UnoColor[] = [...UNO_LIGHT_COLORS, ...UNO_DARK_COLORS];
/** Back-compat alias — classic/custom/no-mercy use the four light colours. */
export const UNO_COLORS = UNO_LIGHT_COLORS;
/** Maximum concurrent spectators retained for one in-memory game. */
export const UNO_SPECTATOR_CAP = 32;

export type UnoCardKind =
  // classic
  | 'number'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'draw4'
  | 'wild'
  | 'wild4'
  // flip
  | 'draw1'
  | 'draw5'
  | 'skipAll'
  | 'flip'
  | 'wildDraw2'
  | 'wildDrawColor'
  // no mercy
  | 'draw6'
  | 'draw10'
  | 'discardAll'
  | 'reverseDraw4'
  | 'wildColorRoulette';

/** One printed face of a card. */
export interface UnoCardFace {
  color: UnoColor | null;
  kind: UnoCardKind;
  value: number | null;
}

/**
 * A physical card. Top-level fields are the light/only face; `dark` exists only
 * in Flip. The active face is chosen by the state's `side`.
 */
export interface UnoCard {
  id: string;
  color: UnoColor | null;
  kind: UnoCardKind;
  value: number | null;
  dark?: UnoCardFace;
}

export type UnoSide = 'light' | 'dark';
export type UnoMode = 'classic' | 'custom' | 'noMercy' | 'flip';

/** Kinds that make the next player draw (stacking + settlement). */
export type UnoDrawKind =
  | 'draw2'
  | 'draw4'
  | 'wild4'
  | 'wildDraw2'
  | 'draw5'
  | 'draw6'
  | 'draw10'
  | 'reverseDraw4'
  | 'wildDrawColor'
  | 'wildColorRoulette';
/** Back-compat alias. */
export type UnoPendingDrawType = UnoDrawKind;

/** Accumulated draw penalty in flight. */
export interface UnoPendingDraw {
  count: number;
  type: UnoDrawKind;
  /** Wild Draw Color (Flip): draw until this colour; `count` ignored. */
  untilColor: UnoColor | null;
  /** True while the immediate next player may challenge a wild-draw card. */
  challengeable: boolean;
  /** Player who played the challengeable card (challenge target). */
  wild4By: string | null;
  /** Active colour before that card — challenge legality. */
  wild4PrevColor: UnoColor | null;
  /** Legality snapshot taken before the challengeable card changed colour. */
  wild4WasBluff: boolean | null;
  /** Reverse direction when this resolves (No Mercy Reverse Draw 4). */
  reverseOnResolve: boolean;
}

export enum UnoPhase {
  PLAYING = 'playing',
  ROUND_OVER = 'roundOver',
  FINISHED = 'finished',
}

/** Public, non-secret per-player info (safe to broadcast to everyone). */
export interface UnoPlayerPublic {
  id: string;
  name: string;
  handCount: number;
  isConnected: boolean;
  /** On exactly one card AND has legally called "UNO". */
  calledUno: boolean;
  /** On exactly one card without a completed UNO declaration. */
  unoVulnerable: boolean;
  score: number;
  /** Out of the game (surrendered, or No Mercy 25-card knockout). */
  eliminated: boolean;
  /**
   * UNO Flip only: the inactive printed faces physically visible to opponents.
   * No physical-card IDs or active faces are included.
   */
  visibleBackFaces: UnoCardFace[];
}

/** Server-only per-player record (includes the secret hand). */
export interface UnoPlayerState extends Omit<UnoPlayerPublic, 'visibleBackFaces'> {
  hand: UnoCard[];
  isSpectator?: false;
}

export type UnoEventType =
  | 'play'
  | 'draw'
  | 'skip'
  | 'reverse'
  | 'color'
  | 'uno'
  | 'caught'
  | 'challengeWin'
  | 'challengeLoss'
  | 'take'
  | 'reshuffle'
  | 'flip'
  | 'discardAll'
  | 'swap'
  | 'rotate'
  | 'surrender'
  | 'eliminated'
  | 'roundOver'
  | 'gameOver';

/** Transient cue for animations / toasts / sound. */
export interface UnoEvent {
  id: number;
  type: UnoEventType;
  by: string | null;
  target?: string | null;
  card?: UnoCard | null;
  color?: UnoColor | null;
  amount?: number | null;
  side?: UnoSide;
  message?: string;
}

/**
 * Authoritative server-side state. NOT broadcast directly — see toPlayerView.
 */
export interface UnoGameState {
  gameId: string;
  lobbyCode: string;
  mode: UnoMode;
  phase: UnoPhase;
  side: UnoSide;
  players: UnoPlayerState[];
  /** Ids of view-only spectators (never dealt cards). */
  spectators: string[];
  direction: 1 | -1;
  currentIndex: number;
  drawPile: UnoCard[];
  /** No Mercy hands set aside until the next discard-pile reshuffle. */
  eliminatedCards: UnoCard[];
  discardPile: UnoCard[];
  /** Colour that must currently be matched (chosen colour for wilds). */
  activeColor: UnoColor;
  pendingDraw: UnoPendingDraw | null;
  /** Player who must choose a Seven-0 swap target before their turn resolves. */
  pendingSevenBy: string | null;
  /** UNO Flip: first player must choose the colour for an opening Wild. */
  openingColorBy: string | null;
  /** Zero-card player waiting for a challengeable final draw card to resolve. */
  pendingWinnerId: string | null;
  /** If the current player has drawn and may now play THAT card or pass. */
  drawnCardId: string | null;
  /** Server deadlines for independent three-second UNO declaration grace periods. */
  unoWindows: Record<string, number>;
  turnStartedAt: number;
  turnEndsAt: number;
  targetScore: number | null;
  // Rule flags resolved from UnoRules at deal time.
  stacking: boolean;
  drawToMatch: boolean;
  jumpIn: boolean;
  sevenZero: boolean;
  forcePlay: boolean;
  noBluffing: boolean;
  /** No Mercy knockout threshold (else null). */
  mercyLimit: number | null;
  roundNumber: number;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  /** Last authoritative round/match result, retained for reconnect. */
  lastResult: UnoRoundResult | null;
  events: UnoEvent[];
  eventSeq: number;
  startedAt: number;
  finishedAt: number | null;
}

/** Redacted, per-recipient projection. This is what clients render. */
export interface UnoPlayerView {
  gameId: string;
  lobbyCode: string;
  mode: UnoMode;
  role: 'player' | 'spectator';
  phase: UnoPhase;
  side: UnoSide;
  /** Recipient's own id (null for spectators). */
  youId: string | null;
  /** Recipient's own hand (empty for spectators). */
  yourHand: UnoCard[];
  /** Everyone at the table, in seating order (counts only for others). */
  players: UnoPlayerPublic[];
  direction: 1 | -1;
  currentPlayerId: string | null;
  activeColor: UnoColor;
  topCard: UnoCard | null;
  drawPileCount: number;
  discardCount: number;
  pendingDraw: {
    count: number;
    type: UnoDrawKind;
    untilColor: UnoColor | null;
    challengeable: boolean;
  } | null;
  /** You must pick a Seven-0 swap partner right now. */
  awaitingSevenTarget: boolean;
  /** If you just drew a playable card, its id (you may play it or pass). */
  playableDrawnCardId: string | null;
  turnStartedAt: number;
  turnEndsAt: number;
  targetScore: number | null;
  mercyLimit: number | null;
  stacking: boolean;
  roundNumber: number;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  lastResult: UnoRoundResult | null;
  scores: Record<string, number>;
  events: UnoEvent[];
  // ─── Server-computed affordances (also re-validated on every action) ───
  /** Which of YOUR hand cards are legally playable right now. */
  legalCardIds: string[];
  canDraw: boolean;
  canPass: boolean;
  canCallUno: boolean;
  canChallenge: boolean;
  canTake: boolean;
  canChooseOpeningColor: boolean;
  canChooseRouletteColor: boolean;
  canSurrender: boolean;
  /** Cards you may Jump-In with right now (out of turn). */
  jumpInIds: string[];
  /** Opponents you may currently catch for not calling UNO. */
  catchableIds: string[];
  /** Time remaining before each missed declaration becomes catchable. */
  unoCallRemainingMs: Record<string, number>;
}

/** Per-hand scoring (official): numbers face value, actions 20, wilds 50. */
export interface UnoRoundResult {
  roundWinnerId: string;
  roundWinnerName: string;
  /** Points scored this round (sum of opponents' remaining card values). */
  points: number;
  scores: Record<string, number>;
  matchOver: boolean;
  matchWinnerId: string | null;
  /** Why the match ended, when applicable. */
  reason?: 'target' | 'lastStanding' | 'single';
}

/** Lobby-level UNO configuration. */
export interface UnoRules {
  mode: UnoMode;
  /** null = single round; else first to this many points (classic/custom/flip). */
  targetScore: number | null;
  stacking: boolean;
  drawToMatch: boolean;
  jumpIn: boolean;
  sevenZero: boolean;
  forcePlay: boolean;
  noBluffing: boolean;
}

export const UNO_MODES: readonly UnoMode[] = ['classic', 'custom', 'noMercy', 'flip'];

export const UNO_CONSTANTS = {
  INITIAL_HAND_SIZE: 7,
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  TURN_MS: 45_000,
  DECK_SIZE: 108,
  /** Recent-event ring buffer length kept on the state/view. */
  EVENT_LOG_LIMIT: 12,
  /** Allowed target scores offered in the lobby (null handled separately). */
  TARGET_SCORES: [200, 500] as readonly number[],
  ACTION_CARD_POINTS: 20,
  WILD_CARD_POINTS: 50,
  /** No Mercy: reaching this many cards eliminates you. */
  MERCY_LIMIT: 25,
  /** Protected declaration period after a player reaches one card. */
  UNO_CALL_GRACE_MS: 3_000,
  MODE_MAX_PLAYERS: {
    classic: 10,
    custom: 10,
    noMercy: 6,
    flip: 10,
  } as const,
} as const;

// ─── UNO Type Definitions ───
//
// Supports Classic, Custom (house-rule toggles), No Mercy, and Flip on one
// engine. Kept in sync with backend/src/shared/types/uno.ts.
//
// Anti-cheat is structural: the authoritative UnoGameState (with every hand) is
// server-only. Clients only ever receive a redacted UnoPlayerView.

export type UnoLightColor = 'red' | 'yellow' | 'green' | 'blue';
export type UnoDarkColor = 'teal' | 'orange' | 'pink' | 'purple';
export type UnoColor = UnoLightColor | UnoDarkColor;

export const UNO_LIGHT_COLORS: readonly UnoLightColor[] = ['red', 'yellow', 'green', 'blue'];
export const UNO_DARK_COLORS: readonly UnoDarkColor[] = ['teal', 'orange', 'pink', 'purple'];
export const UNO_ALL_COLORS: readonly UnoColor[] = [...UNO_LIGHT_COLORS, ...UNO_DARK_COLORS];
/** Back-compat alias — classic/custom/no-mercy use the four light colours. */
export const UNO_COLORS = UNO_LIGHT_COLORS;

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

export interface UnoCardFace {
  color: UnoColor | null;
  kind: UnoCardKind;
  value: number | null;
}

export interface UnoCard {
  id: string;
  color: UnoColor | null;
  kind: UnoCardKind;
  value: number | null;
  dark?: UnoCardFace;
}

export type UnoSide = 'light' | 'dark';
export type UnoMode = 'classic' | 'custom' | 'noMercy' | 'flip';

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
export type UnoPendingDrawType = UnoDrawKind;

export interface UnoPendingDraw {
  count: number;
  type: UnoDrawKind;
  untilColor: UnoColor | null;
  challengeable: boolean;
  wild4By: string | null;
  wild4PrevColor: UnoColor | null;
  wild4WasBluff: boolean | null;
  reverseOnResolve: boolean;
}

export enum UnoPhase {
  PLAYING = 'playing',
  ROUND_OVER = 'roundOver',
  FINISHED = 'finished',
}

export interface UnoPlayerPublic {
  id: string;
  name: string;
  handCount: number;
  isConnected: boolean;
  calledUno: boolean;
  unoVulnerable: boolean;
  score: number;
  eliminated: boolean;
  visibleBackFaces: UnoCardFace[];
}

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

export interface UnoGameState {
  gameId: string;
  lobbyCode: string;
  mode: UnoMode;
  phase: UnoPhase;
  side: UnoSide;
  players: UnoPlayerState[];
  spectators: string[];
  direction: 1 | -1;
  currentIndex: number;
  drawPile: UnoCard[];
  eliminatedCards: UnoCard[];
  discardPile: UnoCard[];
  activeColor: UnoColor;
  pendingDraw: UnoPendingDraw | null;
  pendingSevenBy: string | null;
  openingColorBy: string | null;
  pendingWinnerId: string | null;
  drawnCardId: string | null;
  unoWindows: Record<string, number>;
  turnStartedAt: number;
  turnEndsAt: number;
  targetScore: number | null;
  stacking: boolean;
  drawToMatch: boolean;
  jumpIn: boolean;
  sevenZero: boolean;
  forcePlay: boolean;
  noBluffing: boolean;
  mercyLimit: number | null;
  roundNumber: number;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  lastResult: UnoRoundResult | null;
  events: UnoEvent[];
  eventSeq: number;
  startedAt: number;
  finishedAt: number | null;
}

export interface UnoPlayerView {
  gameId: string;
  lobbyCode: string;
  mode: UnoMode;
  role: 'player' | 'spectator';
  phase: UnoPhase;
  side: UnoSide;
  youId: string | null;
  yourHand: UnoCard[];
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
  awaitingSevenTarget: boolean;
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
  legalCardIds: string[];
  canDraw: boolean;
  canPass: boolean;
  canCallUno: boolean;
  canChallenge: boolean;
  canTake: boolean;
  canChooseOpeningColor: boolean;
  canChooseRouletteColor: boolean;
  canSurrender: boolean;
  jumpInIds: string[];
  catchableIds: string[];
  /** Time remaining before each missed declaration becomes catchable. */
  unoCallRemainingMs: Record<string, number>;
}

export interface UnoRoundResult {
  roundWinnerId: string;
  roundWinnerName: string;
  points: number;
  scores: Record<string, number>;
  matchOver: boolean;
  matchWinnerId: string | null;
  reason?: 'target' | 'lastStanding' | 'single';
}

export interface UnoRules {
  mode: UnoMode;
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
  EVENT_LOG_LIMIT: 12,
  TARGET_SCORES: [200, 500] as readonly number[],
  ACTION_CARD_POINTS: 20,
  WILD_CARD_POINTS: 50,
  MERCY_LIMIT: 25,
  UNO_CALL_GRACE_MS: 3_000,
  MODE_MAX_PLAYERS: {
    classic: 10,
    custom: 10,
    noMercy: 6,
    flip: 10,
  } as const,
} as const;

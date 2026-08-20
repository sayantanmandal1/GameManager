export const DISTINCT_GAME_KEYS = [
  'reversi',
  'checkers',
  'mancala',
  'dotsandboxes',
  'pig',
  'grid-salvo',
  'peg-codebreaker',
  'hangman',
  'go-fish',
  'crazy-eights',
  'five-dice-yacht',
  'liars-dice',
  'farkle',
  'shut-the-box',
  'draw-dominoes',
  'hearts',
  'spades',
  'gin-rummy',
  'card-war',
  'old-maid',
  'hex',
  'nine-mens-morris',
  'cee-lo',
  'trivia-quiz-bowl',
  'memory-match',
  'contract-bridge',
  'bourre',
  'bluff',
  'sevens',
  'ninety-nine',
  'euchre',
  'whist',
  'oh-hell',
  'president',
  'slapjack',
  'spoons',
] as const;

export type DistinctGameKey = (typeof DISTINCT_GAME_KEYS)[number];

export const PARTNERSHIP_GAME_KEYS = [
  'contract-bridge',
  'spades',
  'euchre',
  'whist',
] as const satisfies readonly DistinctGameKey[];

export type PartnershipGameKey = (typeof PARTNERSHIP_GAME_KEYS)[number];

export function isPartnershipGameKey(value: unknown): value is PartnershipGameKey {
  return typeof value === 'string'
    && PARTNERSHIP_GAME_KEYS.includes(value as PartnershipGameKey);
}

export type ReversiDisc = 'black' | 'white';

export interface ReversiPlayer {
  id: string;
  name: string;
  disc: ReversiDisc;
}

export interface ReversiAction {
  cell: number;
}

export interface ReversiGameState {
  players: [ReversiPlayer, ReversiPlayer];
  board: Array<ReversiDisc | null>;
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  consecutivePasses: number;
  finishReason: 'board_complete' | 'no_moves' | 'surrender' | null;
}

export interface ReversiResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: 'board_complete' | 'no_moves' | 'surrender';
  scores: Record<ReversiDisc, number>;
}

export interface ReversiPlayerView {
  players: [ReversiPlayer, ReversiPlayer];
  board: Array<ReversiDisc | null>;
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  consecutivePasses: number;
  youId: string;
  yourDisc: ReversiDisc | null;
  canAct: boolean;
  legalMoves: number[];
  scores: Record<ReversiDisc, number>;
}

export type CheckersColor = 'red' | 'black';

export interface CheckersPlayer {
  id: string;
  name: string;
  color: CheckersColor;
}

export interface CheckersPiece {
  playerId: string;
  king: boolean;
}

export interface CheckersAction {
  from: number;
  to: number;
}

export interface CheckersMoveOption extends CheckersAction {
  capture: number | null;
}

export interface CheckersGameState {
  players: [CheckersPlayer, CheckersPlayer];
  board: Array<CheckersPiece | null>;
  currentTurnId: string;
  mustContinueFrom: number | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: false;
  finishReason: 'no_pieces' | 'no_legal_moves' | 'surrender' | null;
}

export interface CheckersResult {
  winnerId: string;
  isDraw: false;
  reason: 'no_pieces' | 'no_legal_moves' | 'surrender';
  remainingPieces: Record<string, number>;
}

export interface CheckersPlayerView {
  players: [CheckersPlayer, CheckersPlayer];
  board: Array<CheckersPiece | null>;
  currentTurnId: string;
  mustContinueFrom: number | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: false;
  youId: string;
  yourColor: CheckersColor | null;
  canAct: boolean;
  mandatoryCapture: boolean;
  legalMoves: CheckersMoveOption[];
}

export interface MancalaPlayer {
  id: string;
  name: string;
  side: 0 | 1;
}

export interface MancalaAction {
  pit: number;
}

export interface MancalaGameState {
  players: [MancalaPlayer, MancalaPlayer];
  pits: [number[], number[]];
  stores: [number, number];
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'pits_empty' | 'surrender' | null;
}

export interface MancalaResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: 'pits_empty' | 'surrender';
  scores: Record<string, number>;
}

export interface MancalaPlayerView {
  players: [MancalaPlayer, MancalaPlayer];
  pits: [number[], number[]];
  stores: [number, number];
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  youId: string;
  yourSide: 0 | 1 | null;
  canAct: boolean;
  legalPits: number[];
}

export type DotsAndBoxesOrientation = 'horizontal' | 'vertical';

export interface DotsAndBoxesPlayer {
  id: string;
  name: string;
}

export interface DotsAndBoxesAction {
  orientation: DotsAndBoxesOrientation;
  row: number;
  column: number;
}

export interface DotsAndBoxesGameState {
  players: [DotsAndBoxesPlayer, DotsAndBoxesPlayer];
  horizontalEdges: boolean[][];
  verticalEdges: boolean[][];
  boxes: Array<Array<string | null>>;
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'all_boxes_claimed' | 'surrender' | null;
}

export interface DotsAndBoxesResult {
  winnerId: string | null;
  isDraw: boolean;
  reason: 'all_boxes_claimed' | 'surrender';
  scores: Record<string, number>;
}

export interface DotsAndBoxesPlayerView {
  players: [DotsAndBoxesPlayer, DotsAndBoxesPlayer];
  horizontalEdges: boolean[][];
  verticalEdges: boolean[][];
  boxes: Array<Array<string | null>>;
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  youId: string;
  canAct: boolean;
  legalEdges: DotsAndBoxesAction[];
}

export interface PigPlayer {
  id: string;
  name: string;
}

export type PigAction = { type: 'roll' } | { type: 'hold' };

export interface PigGameState {
  players: [PigPlayer, PigPlayer];
  scores: Record<string, number>;
  currentTurnId: string;
  turnTotal: number;
  lastRoll: number | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: false;
  finishReason: 'target_reached' | 'surrender' | null;
}

export interface PigResult {
  winnerId: string;
  isDraw: false;
  reason: 'target_reached' | 'surrender';
  scores: Record<string, number>;
}

export interface PigPlayerView {
  players: [PigPlayer, PigPlayer];
  scores: Record<string, number>;
  currentTurnId: string;
  turnTotal: number;
  lastRoll: number | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: false;
  youId: string;
  canAct: boolean;
  canRoll: boolean;
  canHold: boolean;
  targetScore: number;
}

export interface DistinctPlayer {
  id: string;
  name: string;
}

export interface GridSalvoShipPlacement {
  start: number;
  end: number;
}

export type GridSalvoAction =
  | { type: 'place_fleet'; ships: GridSalvoShipPlacement[] }
  | { type: 'shoot'; cell: number };
export type GridSalvoOwnCell = 'empty' | 'ship' | 'hit' | 'miss';
export type GridSalvoTargetCell = 'unknown' | 'hit' | 'miss';
export interface GridSalvoShipState { cells: number[]; hits: number[] }
export interface GridSalvoGameState {
  players: [DistinctPlayer, DistinctPlayer];
  fleets: Record<string, GridSalvoShipState[] | null>;
  shots: Record<string, Record<number, 'hit' | 'miss'>>;
  currentTurnId: string | null;
  phase: 'placement' | 'playing' | 'finished';
  winnerId: string | null;
  finishReason: 'fleet_sunk' | 'surrender' | null;
}
export interface GridSalvoResult {
  gameKey: 'grid-salvo';
  winnerId: string;
  isDraw: false;
  reason: 'fleet_sunk' | 'surrender';
}
export interface GridSalvoPlayerView {
  gameKey: 'grid-salvo';
  players: [DistinctPlayer, DistinctPlayer];
  youId: string;
  phase: GridSalvoGameState['phase'];
  currentTurnId: string | null;
  winnerId: string | null;
  canAct: boolean;
  yourReady: boolean;
  opponentReady: boolean;
  yourOcean: GridSalvoOwnCell[];
  opponentOcean: GridSalvoTargetCell[];
  yourRemainingShips: number[];
  opponentRemainingShips: number[];
}

export const PEG_CODE_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const;
export type PegCodeColor = (typeof PEG_CODE_COLORS)[number];
export type PegCodeAction =
  | { type: 'set_code'; colors: PegCodeColor[] }
  | { type: 'guess_code'; colors: PegCodeColor[] };
export interface PegCodeGuess {
  colors: PegCodeColor[];
  exact: number;
  colorOnly: number;
}
export interface PegCodebreakerGameState {
  players: [DistinctPlayer, DistinctPlayer];
  makerId: string;
  breakerId: string;
  secret: PegCodeColor[] | null;
  guesses: PegCodeGuess[];
  phase: 'coding' | 'guessing' | 'finished';
  winnerId: string | null;
  finishReason: 'cracked' | 'attempts_exhausted' | 'surrender' | null;
}
export interface PegCodeResult {
  gameKey: 'peg-codebreaker';
  winnerId: string;
  isDraw: false;
  reason: 'cracked' | 'attempts_exhausted' | 'surrender';
  attempts: number;
  secret: PegCodeColor[];
}
export interface PegCodePlayerView {
  gameKey: 'peg-codebreaker';
  players: [DistinctPlayer, DistinctPlayer];
  youId: string;
  makerId: string;
  breakerId: string;
  currentTurnId: string | null;
  phase: PegCodebreakerGameState['phase'];
  winnerId: string | null;
  canAct: boolean;
  guesses: PegCodeGuess[];
  yourSecret: PegCodeColor[] | null;
  revealedSecret: PegCodeColor[] | null;
  attemptsRemaining: number;
}

export type HangmanAction =
  | { type: 'set_phrase'; phrase: string }
  | { type: 'guess_letter'; letter: string }
  | { type: 'guess_phrase'; phrase: string };
export interface HangmanGameState {
  players: DistinctPlayer[];
  hostId: string;
  secretPhrase: string | null;
  guessedLetters: string[];
  misses: number;
  currentTurnId: string | null;
  phase: 'setup' | 'playing' | 'finished';
  winnerId: string | null;
  finishReason: 'phrase_guessed' | 'miss_limit' | 'surrender' | null;
}
export interface HangmanResult {
  gameKey: 'hangman';
  winnerId: string;
  isDraw: false;
  reason: 'phrase_guessed' | 'miss_limit' | 'surrender';
  phrase: string;
  misses: number;
}
export interface HangmanPlayerView {
  gameKey: 'hangman';
  players: DistinctPlayer[];
  hostId: string;
  youId: string;
  phase: HangmanGameState['phase'];
  currentTurnId: string | null;
  winnerId: string | null;
  canAct: boolean;
  pattern: string;
  guessedLetters: string[];
  misses: number;
  maxMisses: number;
  yourSecretPhrase: string | null;
  revealedPhrase: string | null;
}

export const CARD_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type CardSuit = (typeof CARD_SUITS)[number];
export const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type CardRank = (typeof CARD_RANKS)[number];
export interface StandardCard { id: string; suit: CardSuit; rank: CardRank }

export interface GoFishPlayerPublic extends DistinctPlayer {
  handCount: number;
  books: CardRank[];
}
export interface GoFishGameState {
  players: DistinctPlayer[];
  hands: Record<string, StandardCard[]>;
  books: Record<string, CardRank[]>;
  deck: StandardCard[];
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'all_books' | 'surrender' | null;
  lastEvent: string;
}
export type GoFishAction = { type: 'ask'; targetPlayerId: string; rank: CardRank };
export interface GoFishResult {
  gameKey: 'go-fish';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'all_books' | 'surrender';
  scores: Record<string, number>;
}
export interface GoFishPlayerView {
  gameKey: 'go-fish';
  players: GoFishPlayerPublic[];
  youId: string;
  yourHand: StandardCard[];
  deckCount: number;
  currentTurnId: string;
  phase: GoFishGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  legalTargets: string[];
  legalRanks: CardRank[];
  lastEvent: string;
}

export type CrazyEightsAction =
  | { type: 'play_card'; cardId: string; chosenSuit?: CardSuit }
  | { type: 'draw_card' };
export interface CrazyEightsGameState {
  players: DistinctPlayer[];
  hands: Record<string, StandardCard[]>;
  drawPile: StandardCard[];
  discardPile: StandardCard[];
  activeSuit: CardSuit;
  currentTurnId: string;
  consecutivePasses: number;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'empty_hand' | 'blocked' | 'surrender' | null;
}
export interface CrazyEightsResult {
  gameKey: 'crazy-eights';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'empty_hand' | 'blocked' | 'surrender';
  handPoints: Record<string, number>;
}
export interface CrazyEightsPlayerView {
  gameKey: 'crazy-eights';
  players: Array<DistinctPlayer & { handCount: number }>;
  youId: string;
  yourHand: StandardCard[];
  topCard: StandardCard;
  activeSuit: CardSuit;
  drawPileCount: number;
  currentTurnId: string;
  phase: CrazyEightsGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  legalCardIds: string[];
  canDraw: boolean;
}

export const YACHT_CATEGORIES = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'three_kind', 'four_kind', 'full_house', 'small_straight',
  'large_straight', 'yacht', 'chance',
] as const;
export type YachtCategory = (typeof YACHT_CATEGORIES)[number];
export type YachtScorecard = Record<YachtCategory, number | null>;
export type YachtAction =
  | { type: 'roll_dice'; heldIndices: number[] }
  | { type: 'score_category'; category: YachtCategory };
export interface YachtGameState {
  players: DistinctPlayer[];
  scorecards: Record<string, YachtScorecard>;
  currentTurnId: string;
  dice: number[];
  rollsUsed: number;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'scorecards_complete' | 'surrender' | null;
}
export interface YachtResult {
  gameKey: 'five-dice-yacht';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'scorecards_complete' | 'surrender';
  totals: Record<string, number>;
}
export interface YachtPlayerView {
  gameKey: 'five-dice-yacht';
  players: DistinctPlayer[];
  youId: string;
  scorecards: Record<string, YachtScorecard>;
  totals: Record<string, number>;
  currentTurnId: string;
  dice: number[];
  rollsUsed: number;
  phase: YachtGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  possibleScores: Partial<Record<YachtCategory, number>>;
}

export interface LiarsDiceBid { quantity: number; face: number; bidderId: string }
export type LiarsDiceAction =
  | { type: 'bid'; quantity: number; face: number }
  | { type: 'challenge' };
export interface LiarsDiceGameState {
  players: DistinctPlayer[];
  dice: Record<string, number[]>;
  currentTurnId: string;
  currentBid: LiarsDiceBid | null;
  round: number;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  finishReason: 'last_player' | 'surrender' | null;
  lastResolution: string | null;
}
export interface LiarsDiceResult {
  gameKey: 'liars-dice';
  winnerId: string;
  isDraw: false;
  reason: 'last_player' | 'surrender';
  rounds: number;
}
export interface LiarsDicePlayerView {
  gameKey: 'liars-dice';
  players: Array<DistinctPlayer & { diceCount: number }>;
  youId: string;
  yourDice: number[];
  currentTurnId: string;
  currentBid: LiarsDiceBid | null;
  round: number;
  phase: LiarsDiceGameState['phase'];
  winnerId: string | null;
  canAct: boolean;
  totalDice: number;
  lastResolution: string | null;
}

export type FarkleAction =
  | { type: 'roll_farkle' }
  | { type: 'select_dice'; indices: number[] }
  | { type: 'bank_farkle' };
export interface FarkleGameState {
  players: DistinctPlayer[];
  scores: Record<string, number>;
  entered: Record<string, boolean>;
  currentTurnId: string;
  dice: number[];
  turnScore: number;
  diceRemaining: number;
  finalTriggerId: string | null;
  finalTurnsRemaining: number | null;
  phase: 'rolling' | 'selecting' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'final_round' | 'surrender' | null;
  lastEvent: string;
}
export interface FarkleResult {
  gameKey: 'farkle';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'final_round' | 'surrender';
  scores: Record<string, number>;
}
export interface FarklePlayerView {
  gameKey: 'farkle';
  players: DistinctPlayer[];
  youId: string;
  scores: Record<string, number>;
  entered: Record<string, boolean>;
  currentTurnId: string;
  dice: number[];
  turnScore: number;
  diceRemaining: number;
  finalTriggerId: string | null;
  finalTurnsRemaining: number | null;
  phase: FarkleGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  selectableIndices: number[];
  canBank: boolean;
  lastEvent: string;
}

export type ShutTheBoxAction =
  | { type: 'roll_box' }
  | { type: 'close_tiles'; tiles: number[] };
export interface ShutTheBoxGameState {
  players: DistinctPlayer[];
  openTiles: Record<string, number[]>;
  scores: Record<string, number | null>;
  currentTurnId: string;
  roll: number[];
  phase: 'rolling' | 'closing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'round_complete' | 'surrender' | null;
}
export interface ShutTheBoxResult {
  gameKey: 'shut-the-box';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'round_complete' | 'surrender';
  scores: Record<string, number>;
}
export interface ShutTheBoxPlayerView {
  gameKey: 'shut-the-box';
  players: DistinctPlayer[];
  youId: string;
  openTiles: Record<string, number[]>;
  scores: Record<string, number | null>;
  currentTurnId: string;
  roll: number[];
  phase: ShutTheBoxGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  legalCombinations: number[][];
}

export interface Domino { id: string; a: number; b: number }
export interface PlacedDomino extends Domino { left: number; right: number }
export type DrawDominoesAction =
  | { type: 'play_domino'; dominoId: string; end: 'left' | 'right'; flip: boolean }
  | { type: 'draw_domino' };
export interface DrawDominoesGameState {
  players: DistinctPlayer[];
  hands: Record<string, Domino[]>;
  boneyard: Domino[];
  chain: PlacedDomino[];
  currentTurnId: string;
  consecutivePasses: number;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'empty_hand' | 'blocked' | 'surrender' | null;
}
export interface DrawDominoesResult {
  gameKey: 'draw-dominoes';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'empty_hand' | 'blocked' | 'surrender';
  pipSums: Record<string, number>;
}
export interface DrawDominoesPlayerView {
  gameKey: 'draw-dominoes';
  players: Array<DistinctPlayer & { handCount: number }>;
  youId: string;
  yourHand: Domino[];
  boneyardCount: number;
  chain: PlacedDomino[];
  openEnds: [number, number] | null;
  currentTurnId: string;
  phase: DrawDominoesGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  legalPlays: Array<{ dominoId: string; ends: Array<'left' | 'right'> }>;
  canDraw: boolean;
}

export type HeartsPassDirection = 'left' | 'right' | 'across' | 'hold';
export type HeartsAction =
  | { type: 'pass_cards'; cardIds: string[] }
  | { type: 'play_card'; cardId: string };
export interface HeartsTrickCard { playerId: string; card: StandardCard }
export interface HeartsGameState {
  players: [DistinctPlayer, DistinctPlayer, DistinctPlayer, DistinctPlayer];
  hands: Record<string, StandardCard[]>;
  passSelections: Record<string, string[] | null>;
  scores: Record<string, number>;
  roundPoints: Record<string, number>;
  trick: HeartsTrickCard[];
  currentTurnId: string | null;
  leaderId: string | null;
  roundNumber: number;
  passDirection: HeartsPassDirection;
  heartsBroken: boolean;
  phase: 'passing' | 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'score_limit' | 'surrender' | null;
}
export interface HeartsResult {
  gameKey: 'hearts';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'score_limit' | 'surrender';
  scores: Record<string, number>;
}
export interface HeartsPlayerView {
  gameKey: 'hearts';
  players: Array<DistinctPlayer & { handCount: number; score: number; roundPoints: number; passed: boolean }>;
  youId: string;
  yourHand: StandardCard[];
  trick: HeartsTrickCard[];
  currentTurnId: string | null;
  leaderId: string | null;
  roundNumber: number;
  passDirection: HeartsPassDirection;
  heartsBroken: boolean;
  phase: HeartsGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  legalCardIds: string[];
}

export type SpadesAction =
  | { type: 'bid_spades'; bid: number }
  | { type: 'play_card'; cardId: string };
export interface SpadesTrickCard { playerId: string; card: StandardCard }
export interface SpadesGameState {
  players: [DistinctPlayer, DistinctPlayer, DistinctPlayer, DistinctPlayer];
  hands: Record<string, StandardCard[]>;
  bids: Record<string, number | null>;
  tricksWon: Record<string, number>;
  teamScores: [number, number];
  teamBags: [number, number];
  trick: SpadesTrickCard[];
  currentTurnId: string;
  leaderId: string;
  roundNumber: number;
  spadesBroken: boolean;
  phase: 'bidding' | 'playing' | 'finished';
  winnerId: string | null;
  winnerTeam: 0 | 1 | null;
  isDraw: boolean;
  finishReason: 'score_limit' | 'surrender' | null;
}
export interface SpadesResult {
  gameKey: 'spades';
  winnerId: string | null;
  winnerTeam: 0 | 1 | null;
  isDraw: boolean;
  reason: 'score_limit' | 'surrender';
  teamScores: [number, number];
  teamBags: [number, number];
}
export interface SpadesPlayerView {
  gameKey: 'spades';
  players: Array<DistinctPlayer & { handCount: number; bid: number | null; tricksWon: number; team: 0 | 1 }>;
  youId: string;
  yourHand: StandardCard[];
  teamScores: [number, number];
  teamBags: [number, number];
  trick: SpadesTrickCard[];
  currentTurnId: string;
  leaderId: string;
  roundNumber: number;
  spadesBroken: boolean;
  phase: SpadesGameState['phase'];
  winnerId: string | null;
  winnerTeam: 0 | 1 | null;
  isDraw: boolean;
  canAct: boolean;
  legalCardIds: string[];
}

export type GinDrawSource = 'stock' | 'discard';
export type GinRummyAction =
  | { type: 'gin_draw'; source: GinDrawSource }
  | { type: 'gin_discard'; cardId: string; knock: boolean };
export interface GinMeld { type: 'set' | 'run'; cards: StandardCard[] }
export interface GinHandAnalysis { melds: GinMeld[]; deadwood: StandardCard[]; deadwoodValue: number }
export interface GinRoundSummary {
  winnerId: string | null;
  knockerId: string | null;
  points: number;
  gin: boolean;
  undercut: boolean;
  deadwood: Record<string, number>;
}
export interface GinRummyGameState {
  players: [DistinctPlayer, DistinctPlayer];
  hands: Record<string, StandardCard[]>;
  stock: StandardCard[];
  discardPile: StandardCard[];
  scores: Record<string, number>;
  currentTurnId: string;
  roundNumber: number;
  phase: 'drawing' | 'discarding' | 'finished';
  drawnCardId: string | null;
  drawSource: GinDrawSource | null;
  lastRound: GinRoundSummary | null;
  winnerId: string | null;
  isDraw: false;
  finishReason: 'score_limit' | 'surrender' | null;
}
export interface GinRummyResult {
  gameKey: 'gin-rummy';
  winnerId: string;
  isDraw: false;
  reason: 'score_limit' | 'surrender';
  scores: Record<string, number>;
}
export interface GinRummyPlayerView {
  gameKey: 'gin-rummy';
  players: Array<DistinctPlayer & { handCount: number; score: number }>;
  youId: string;
  yourHand: StandardCard[];
  yourAnalysis: GinHandAnalysis;
  stockCount: number;
  topDiscard: StandardCard | null;
  currentTurnId: string;
  roundNumber: number;
  phase: GinRummyGameState['phase'];
  lastRound: GinRoundSummary | null;
  winnerId: string | null;
  canAct: boolean;
  canDrawStock: boolean;
  canDrawDiscard: boolean;
  legalDiscardIds: string[];
  canKnock: boolean;
}

export type CardWarAction = { type: 'battle' };
export interface CardWarBattleReveal {
  playerId: string;
  faceUp: StandardCard[];
  faceDownCount: number;
}
export interface CardWarGameState {
  players: [DistinctPlayer, DistinctPlayer];
  decks: Record<string, StandardCard[]>;
  currentTurnId: string;
  battleNumber: number;
  lastBattle: { reveals: CardWarBattleReveal[]; winnerId: string | null; potSize: number } | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'all_cards' | 'cannot_battle' | 'surrender' | null;
}
export interface CardWarResult {
  gameKey: 'card-war';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'all_cards' | 'cannot_battle' | 'surrender';
  cardCounts: Record<string, number>;
}
export interface CardWarPlayerView {
  gameKey: 'card-war';
  players: Array<DistinctPlayer & { cardCount: number }>;
  youId: string;
  currentTurnId: string;
  battleNumber: number;
  lastBattle: CardWarGameState['lastBattle'];
  phase: CardWarGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
}

export type OldMaidAction = { type: 'draw_from_player'; handIndex: number };
export interface OldMaidGameState {
  players: DistinctPlayer[];
  hands: Record<string, StandardCard[]>;
  activePlayerIds: string[];
  safeOrder: string[];
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  loserId: string | null;
  isDraw: false;
  finishReason: 'old_maid' | 'surrender' | null;
  lastEvent: string;
}
export interface OldMaidResult {
  gameKey: 'old-maid';
  winnerId: string;
  loserId: string;
  ranking: string[];
  isDraw: false;
  reason: 'old_maid' | 'surrender';
}
export interface OldMaidPlayerView {
  gameKey: 'old-maid';
  players: Array<DistinctPlayer & { handCount: number; safeRank: number | null }>;
  youId: string;
  yourHand: StandardCard[];
  currentTurnId: string;
  targetPlayerId: string | null;
  targetHandCount: number;
  safeOrder: string[];
  phase: OldMaidGameState['phase'];
  winnerId: string | null;
  loserId: string | null;
  canAct: boolean;
  lastEvent: string;
}

export type HexAction = { type: 'place_hex'; cell: number };
export type HexStone = 'vertical' | 'horizontal';
export interface HexGameState {
  players: [DistinctPlayer, DistinctPlayer];
  board: Array<HexStone | null>;
  currentTurnId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isDraw: false;
  finishReason: 'connection' | 'surrender' | null;
}
export interface HexResult {
  gameKey: 'hex';
  winnerId: string;
  isDraw: false;
  reason: 'connection' | 'surrender';
}
export interface HexPlayerView {
  gameKey: 'hex';
  players: Array<DistinctPlayer & { stone: HexStone }>;
  youId: string;
  yourStone: HexStone;
  board: Array<HexStone | null>;
  currentTurnId: string;
  phase: HexGameState['phase'];
  winnerId: string | null;
  canAct: boolean;
  legalCells: number[];
}

export type MorrisAction =
  | { type: 'place_stone'; node: number }
  | { type: 'move_stone'; from: number; to: number }
  | { type: 'remove_stone'; node: number };
export interface MorrisGameState {
  players: [DistinctPlayer, DistinctPlayer];
  board: Array<string | null>;
  stonesPlaced: Record<string, number>;
  currentTurnId: string;
  phase: 'placement' | 'movement' | 'removing' | 'finished';
  resumePhase: 'placement' | 'movement' | null;
  winnerId: string | null;
  isDraw: false;
  finishReason: 'fewer_than_three' | 'no_legal_moves' | 'surrender' | null;
}
export interface MorrisResult {
  gameKey: 'nine-mens-morris';
  winnerId: string;
  isDraw: false;
  reason: 'fewer_than_three' | 'no_legal_moves' | 'surrender';
  stoneCounts: Record<string, number>;
}
export interface MorrisPlayerView {
  gameKey: 'nine-mens-morris';
  players: [DistinctPlayer, DistinctPlayer];
  youId: string;
  board: Array<string | null>;
  stonesPlaced: Record<string, number>;
  currentTurnId: string;
  phase: MorrisGameState['phase'];
  winnerId: string | null;
  canAct: boolean;
  canFly: boolean;
  legalPlacements: number[];
  legalMoves: Array<{ from: number; to: number }>;
  removableNodes: number[];
}

export type CeeLoCategory = 'automatic_loss' | 'point' | 'triple' | 'automatic_win';
export interface CeeLoRoll { dice: [number, number, number]; category: CeeLoCategory; rank: number }
export type CeeLoAction = { type: 'roll_ceelo' };
export interface CeeLoGameState {
  players: DistinctPlayer[];
  roundsToPlay: number;
  currentRound: number;
  bankerIndex: number;
  bankerId: string;
  challengerIds: string[];
  currentChallengerIndex: number;
  currentTurnId: string;
  bankerRoll: CeeLoRoll | null;
  challengerRolls: Record<string, CeeLoRoll>;
  outcomes: Record<string, 'banker' | 'challenger' | 'tie'>;
  scores: Record<string, number>;
  phase: 'banker_roll' | 'challenger_roll' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'table_complete' | 'surrender' | null;
}
export interface CeeLoResult {
  gameKey: 'cee-lo';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'table_complete' | 'surrender';
  scores: Record<string, number>;
  ranking: string[];
}
export interface CeeLoPlayerView {
  gameKey: 'cee-lo';
  players: DistinctPlayer[];
  youId: string;
  roundsToPlay: number;
  currentRound: number;
  bankerId: string;
  currentTurnId: string;
  bankerRoll: CeeLoRoll | null;
  challengerRolls: Record<string, CeeLoRoll>;
  outcomes: Record<string, 'banker' | 'challenger' | 'tie'>;
  scores: Record<string, number>;
  phase: CeeLoGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
}

export interface TriviaQuestion { prompt: string; options: [string, string, string, string]; correctAnswerIndex: number }
export interface TriviaPublicQuestion { number: number; prompt: string; options: [string, string, string, string] }
export type TriviaAction =
  | { type: 'answer_trivia'; answerIndex: number }
  | { type: 'next_question' };
export interface TriviaReveal {
  correctAnswerIndex: number;
  answers: Record<string, number>;
  firstCorrectId: string | null;
}
export interface TriviaGameState {
  players: DistinctPlayer[];
  hostId: string;
  questions: TriviaQuestion[];
  currentQuestionIndex: number;
  answers: Record<string, number>;
  scores: Record<string, number>;
  firstCorrectId: string | null;
  phase: 'answering' | 'reveal' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'questions_complete' | 'surrender' | null;
}
export interface TriviaResult {
  gameKey: 'trivia-quiz-bowl';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'questions_complete' | 'surrender';
  scores: Record<string, number>;
}
export interface TriviaPlayerView {
  gameKey: 'trivia-quiz-bowl';
  players: DistinctPlayer[];
  youId: string;
  hostId: string;
  question: TriviaPublicQuestion;
  questionCount: number;
  answeredPlayerIds: string[];
  yourAnswer: number | null;
  reveal: TriviaReveal | null;
  scores: Record<string, number>;
  phase: TriviaGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
}

export type MemoryMatchAction =
  | { type: 'reveal_tile'; tileIndex: number }
  | { type: 'acknowledge_mismatch' };
export interface MemoryTileState { id: number; symbol: string; matchedBy: string | null }
export interface MemoryTileView { id: number; symbol: string | null; matchedBy: string | null; revealed: boolean }
export interface MemoryMatchGameState {
  players: DistinctPlayer[];
  tiles: MemoryTileState[];
  scores: Record<string, number>;
  revealedIndices: number[];
  currentTurnId: string;
  phase: 'playing' | 'awaiting_ack' | 'finished';
  winnerId: string | null;
  isDraw: boolean;
  finishReason: 'all_pairs' | 'surrender' | null;
}
export interface MemoryMatchResult {
  gameKey: 'memory-match';
  winnerId: string | null;
  isDraw: boolean;
  reason: 'all_pairs' | 'surrender';
  scores: Record<string, number>;
}
export interface MemoryMatchPlayerView {
  gameKey: 'memory-match';
  players: DistinctPlayer[];
  youId: string;
  tiles: MemoryTileView[];
  scores: Record<string, number>;
  revealedIndices: number[];
  currentTurnId: string;
  phase: MemoryMatchGameState['phase'];
  winnerId: string | null;
  isDraw: boolean;
  canAct: boolean;
  legalTileIndices: number[];
}

export const BRIDGE_MODES = ['rubber', 'duplicate', 'home'] as const;
export type BridgeMode = (typeof BRIDGE_MODES)[number];
export const BRIDGE_STRAINS = ['clubs', 'diamonds', 'hearts', 'spades', 'notrump'] as const;
export type BridgeStrain = (typeof BRIDGE_STRAINS)[number];
export type BridgeDoubling = 'undoubled' | 'doubled' | 'redoubled';
export type BridgeSeat = 'north' | 'east' | 'south' | 'west';
export type BridgeTeam = 0 | 1;
export interface BridgePlayer extends DistinctPlayer {
  seat: BridgeSeat;
  team: BridgeTeam;
}
export interface BridgeBid {
  level: number;
  strain: BridgeStrain;
}
export type BridgeCall =
  | { type: 'pass' }
  | { type: 'bid'; level: number; strain: BridgeStrain }
  | { type: 'double' }
  | { type: 'redouble' };
export type BridgeAction =
  | { type: 'select_bridge_mode'; mode: BridgeMode }
  | { type: 'bridge_call'; call: BridgeCall }
  | { type: 'play_bridge_card'; cardId: string }
  | { type: 'next_bridge_deal' };
export interface BridgeAuctionEntry {
  playerId: string;
  call: BridgeCall;
}
export interface BridgeContract extends BridgeBid {
  doubling: BridgeDoubling;
  declarerId: string;
  dummyId: string;
  openingLeaderId: string;
  declaringTeam: BridgeTeam;
}
export interface BridgeTrickCard {
  playerId: string;
  card: StandardCard;
}
export interface BridgeRubberState {
  belowLine: [number, number];
  gamesWon: [number, number];
  vulnerable: [boolean, boolean];
}
export interface BridgeDealSummary {
  dealNumber: number;
  dealerId: string;
  vulnerability: [boolean, boolean];
  contract: BridgeContract | null;
  tricksWon: [number, number];
  score: [number, number];
  passedOut: boolean;
}
export interface BridgeGameState {
  players: [BridgePlayer, BridgePlayer, BridgePlayer, BridgePlayer];
  hostId: string;
  mode: BridgeMode | null;
  hands: Record<string, StandardCard[]>;
  dealerIndex: number;
  dealNumber: number;
  vulnerability: [boolean, boolean];
  auction: BridgeAuctionEntry[];
  highestBid: (BridgeBid & { bidderId: string; bidderTeam: BridgeTeam }) | null;
  doubling: BridgeDoubling;
  consecutivePasses: number;
  contract: BridgeContract | null;
  trick: BridgeTrickCard[];
  tricksWon: [number, number];
  currentTurnId: string | null;
  leaderId: string | null;
  dummyRevealed: boolean;
  sessionScores: [number, number];
  rubber: BridgeRubberState;
  dealHistory: BridgeDealSummary[];
  pendingHonorBonus: { team: BridgeTeam; points: number } | null;
  phase: 'setup' | 'auction' | 'opening_lead' | 'playing' | 'deal_complete' | 'finished';
  winnerId: string | null;
  winnerTeam: BridgeTeam | null;
  isDraw: boolean;
  finishReason: 'rubber_complete' | 'surrender' | null;
}
export interface BridgeResult {
  gameKey: 'contract-bridge';
  winnerId: string | null;
  winnerTeam: BridgeTeam | null;
  isDraw: boolean;
  reason: 'rubber_complete' | 'surrender';
  mode: BridgeMode | null;
  sessionScores: [number, number];
}
export interface BridgePlayerView {
  gameKey: 'contract-bridge';
  players: Array<BridgePlayer & { handCount: number; tricksWon: number }>;
  hostId: string;
  youId: string;
  mode: BridgeMode | null;
  phase: BridgeGameState['phase'];
  dealerId: string;
  dealNumber: number;
  vulnerability: [boolean, boolean];
  auction: BridgeAuctionEntry[];
  contract: BridgeContract | null;
  trick: BridgeTrickCard[];
  tricksWon: [number, number];
  currentTurnId: string | null;
  currentActorId: string | null;
  leaderId: string | null;
  dummyRevealed: boolean;
  yourHand: StandardCard[];
  dummyHand: StandardCard[];
  sessionScores: [number, number];
  rubber: BridgeRubberState;
  dealHistory: BridgeDealSummary[];
  canAct: boolean;
  legalModes: BridgeMode[];
  legalBids: BridgeBid[];
  canPass: boolean;
  canDouble: boolean;
  canRedouble: boolean;
  legalCardIds: string[];
  actingHand: 'own' | 'dummy' | null;
  winnerId: string | null;
  winnerTeam: BridgeTeam | null;
  isDraw: boolean;
}

export type BourreAction =
  | { type: 'bourre_decide'; play: boolean; discardIds: string[] }
  | { type: 'play_bourre_card'; cardId: string }
  | { type: 'next_bourre_hand' };
export interface BourreTrickCard { playerId: string; card: StandardCard }
export interface BourreHandSummary {
  handNumber: number; winnerId: string | null; splitIds: string[];
  bourreIds: string[]; pot: number;
}
export interface BourreGameState {
  players: DistinctPlayer[]; hostId: string; hands: Record<string, StandardCard[]>;
  stock: StandardCard[]; recyclePool: StandardCard[]; dealerIndex: number;
  trumpSuit: CardSuit; trumpCard: StandardCard; decisions: Record<string, 'pending' | 'folded' | 'stayed'>;
  activePlayerIds: string[]; tricksWon: Record<string, number>; trick: BourreTrickCard[];
  currentTurnId: string | null; leaderId: string | null; pot: number; scores: Record<string, number>;
  handNumber: number; lastHand: BourreHandSummary | null;
  phase: 'deciding' | 'playing' | 'hand_complete' | 'finished'; winnerId: string | null;
  isDraw: boolean; finishReason: 'target_score' | 'surrender' | null;
}
export interface BourreResult {
  gameKey: 'bourre'; winnerId: string | null; isDraw: boolean;
  reason: 'target_score' | 'surrender'; scores: Record<string, number>;
}
export interface BourrePlayerView {
  gameKey: 'bourre'; players: Array<DistinctPlayer & { handCount: number; decision: BourreGameState['decisions'][string]; tricksWon: number; score: number }>;
  hostId: string; youId: string; yourHand: StandardCard[]; dealerId: string;
  trumpSuit: CardSuit; trumpCard: StandardCard; currentTurnId: string | null; leaderId: string | null;
  trick: BourreTrickCard[]; pot: number; handNumber: number; lastHand: BourreHandSummary | null;
  phase: BourreGameState['phase']; winnerId: string | null; isDraw: boolean; canAct: boolean;
  canFold: boolean; legalCardIds: string[];
}

export type BluffAction =
  | { type: 'bluff_play'; cardIds: string[] }
  | { type: 'bluff_accept' }
  | { type: 'bluff_challenge' };
export interface BluffReveal { claimantId: string; challengerId: string; cards: StandardCard[]; truthful: boolean; collectorId: string }
export interface BluffGameState {
  players: DistinctPlayer[]; hands: Record<string, StandardCard[]>; pile: StandardCard[];
  currentTurnId: string; claimRank: CardRank; pendingClaim: { playerId: string; cardIds: string[]; count: number } | null;
  lastReveal: BluffReveal | null; phase: 'claiming' | 'challenge' | 'finished';
  winnerId: string | null; isDraw: false; finishReason: 'empty_hand' | 'surrender' | null;
}
export interface BluffResult { gameKey: 'bluff'; winnerId: string; isDraw: false; reason: 'empty_hand' | 'surrender' }
export interface BluffPlayerView {
  gameKey: 'bluff'; players: Array<DistinctPlayer & { handCount: number }>;
  youId: string; yourHand: StandardCard[]; pileCount: number; currentTurnId: string;
  claimRank: CardRank; pendingClaim: { playerId: string; count: number; rank: CardRank } | null;
  lastReveal: BluffReveal | null; phase: BluffGameState['phase']; winnerId: string | null;
  canAct: boolean; canClaim: boolean; canAccept: boolean; canChallenge: boolean;
}

export type SevensAction =
  | { type: 'play_sevens_card'; cardId: string }
  | { type: 'pass_sevens' }
  | { type: 'next_sevens_round' };
export interface SevensSuitLayout { low: CardRank | null; high: CardRank | null }
export interface SevensRoundSummary { roundNumber: number; winnerId: string; points: number; handPoints: Record<string, number> }
export interface SevensGameState {
  players: DistinctPlayer[]; hostId: string; hands: Record<string, StandardCard[]>;
  layout: Record<CardSuit, SevensSuitLayout>; scores: Record<string, number>; currentTurnId: string;
  dealerIndex: number; roundNumber: number; lastRound: SevensRoundSummary | null;
  phase: 'playing' | 'round_complete' | 'finished'; winnerId: string | null;
  isDraw: false; finishReason: 'target_score' | 'surrender' | null;
}
export interface SevensResult {
  gameKey: 'sevens'; winnerId: string; isDraw: false;
  reason: 'target_score' | 'surrender'; scores: Record<string, number>;
}
export interface SevensPlayerView {
  gameKey: 'sevens'; players: Array<DistinctPlayer & { handCount: number; score: number }>;
  hostId: string; youId: string; yourHand: StandardCard[]; layout: Record<CardSuit, SevensSuitLayout>;
  currentTurnId: string; dealerId: string; roundNumber: number; lastRound: SevensRoundSummary | null;
  phase: SevensGameState['phase']; winnerId: string | null; canAct: boolean;
  legalCardIds: string[]; canPass: boolean;
}

export type NinetyNineAction =
  | { type: 'play_ninety_nine'; cardId: string; chosenValue: number }
  | { type: 'concede_ninety_nine' };
export interface NinetyNineGameState {
  players: DistinctPlayer[]; hands: Record<string, StandardCard[]>; stock: StandardCard[];
  discardPile: StandardCard[]; tokens: Record<string, number>; activePlayerIds: string[];
  total: number; direction: 1 | -1; dealerIndex: number; currentTurnId: string;
  handNumber: number; phase: 'playing' | 'finished'; winnerId: string | null;
  isDraw: false; finishReason: 'last_with_tokens' | 'surrender' | null;
}
export interface NinetyNineResult {
  gameKey: 'ninety-nine'; winnerId: string; isDraw: false;
  reason: 'last_with_tokens' | 'surrender'; tokens: Record<string, number>;
}
export interface NinetyNinePlayerView {
  gameKey: 'ninety-nine'; players: Array<DistinctPlayer & { handCount: number; tokens: number; active: boolean }>;
  youId: string; yourHand: StandardCard[]; total: number; direction: 1 | -1;
  dealerId: string; currentTurnId: string; handNumber: number; phase: NinetyNineGameState['phase'];
  winnerId: string | null; canAct: boolean; legalPlays: Array<{ cardId: string; values: number[] }>;
  mustConcede: boolean;
}

export type EuchreCall =
  | { type: 'pass' }
  | { type: 'order_up'; alone: boolean }
  | { type: 'name_trump'; suit: CardSuit; alone: boolean };
export type EuchreAction =
  | { type: 'euchre_call'; euchreCall: EuchreCall }
  | { type: 'euchre_discard'; cardId: string }
  | { type: 'play_euchre_card'; cardId: string }
  | { type: 'next_euchre_hand' };
export interface EuchrePlayer extends DistinctPlayer { team: 0 | 1 }
export interface EuchreTrickCard { playerId: string; card: StandardCard }
export interface EuchreHandSummary { makerTeam: 0 | 1; makerId: string; alone: boolean; tricks: [number, number]; points: [number, number] }
export interface EuchreGameState {
  players: [EuchrePlayer, EuchrePlayer, EuchrePlayer, EuchrePlayer]; hostId: string;
  hands: Record<string, StandardCard[]>; kitty: StandardCard[]; dealerIndex: number;
  upcard: StandardCard; biddingRound: 1 | 2; passes: number; makerId: string | null;
  makerTeam: 0 | 1 | null; trumpSuit: CardSuit | null; alone: boolean; sittingOutId: string | null;
  activePlayerIds: string[]; currentTurnId: string; leaderId: string | null;
  trick: EuchreTrickCard[]; tricksWon: [number, number]; teamScores: [number, number]; handNumber: number;
  lastHand: EuchreHandSummary | null; phase: 'bidding' | 'dealer_discard' | 'playing' | 'hand_complete' | 'finished';
  winnerId: string | null; winnerTeam: 0 | 1 | null; isDraw: false; finishReason: 'target_score' | 'surrender' | null;
}
export interface EuchreResult { gameKey: 'euchre'; winnerId: string; winnerTeam: 0 | 1; isDraw: false; reason: 'target_score' | 'surrender'; teamScores: [number, number] }
export interface EuchrePlayerView {
  gameKey: 'euchre'; players: Array<EuchrePlayer & { handCount: number; tricksWon: number; sittingOut: boolean }>;
  hostId: string; youId: string; yourHand: StandardCard[]; dealerId: string; upcard: StandardCard;
  biddingRound: 1 | 2; rejectedSuit: CardSuit | null; makerId: string | null; makerTeam: 0 | 1 | null;
  trumpSuit: CardSuit | null; alone: boolean; currentTurnId: string; leaderId: string | null;
  trick: EuchreTrickCard[]; teamScores: [number, number]; tricksWon: [number, number]; handNumber: number;
  lastHand: EuchreHandSummary | null; phase: EuchreGameState['phase']; winnerId: string | null;
  winnerTeam: 0 | 1 | null; canAct: boolean; canPass: boolean; canOrderUp: boolean;
  legalTrumpSuits: CardSuit[]; legalCardIds: string[]; canDiscard: boolean;
}

export type WhistAction = { type: 'play_whist_card'; cardId: string } | { type: 'next_whist_hand' };
export interface WhistPlayer extends DistinctPlayer { team: 0 | 1 }
export interface WhistTrickCard { playerId: string; card: StandardCard }
export interface WhistHandSummary { handNumber: number; tricks: [number, number]; oddPoints: [number, number] }
export interface WhistGameState {
  players: [WhistPlayer, WhistPlayer, WhistPlayer, WhistPlayer]; hostId: string;
  hands: Record<string, StandardCard[]>; dealerIndex: number; trumpCard: StandardCard; trumpSuit: CardSuit;
  trick: WhistTrickCard[]; teamTricks: [number, number]; gamePoints: [number, number];
  currentTurnId: string; leaderId: string; handNumber: number; lastHand: WhistHandSummary | null;
  phase: 'playing' | 'hand_complete' | 'finished'; winnerId: string | null; winnerTeam: 0 | 1 | null;
  isDraw: false; finishReason: 'five_points' | 'surrender' | null;
}
export interface WhistResult { gameKey: 'whist'; winnerId: string; winnerTeam: 0 | 1; isDraw: false; reason: 'five_points' | 'surrender'; gamePoints: [number, number] }
export interface WhistPlayerView {
  gameKey: 'whist'; players: Array<WhistPlayer & { handCount: number; tricksWon: number }>;
  hostId: string; youId: string; yourHand: StandardCard[]; dealerId: string; trumpCard: StandardCard;
  trumpSuit: CardSuit; trick: WhistTrickCard[]; teamTricks: [number, number]; gamePoints: [number, number];
  currentTurnId: string; leaderId: string; handNumber: number; lastHand: WhistHandSummary | null;
  phase: WhistGameState['phase']; winnerId: string | null; winnerTeam: 0 | 1 | null;
  canAct: boolean; legalCardIds: string[];
}

export type OhHellAction =
  | { type: 'bid_oh_hell'; bid: number }
  | { type: 'play_oh_hell_card'; cardId: string }
  | { type: 'next_oh_hell_deal' };
export interface OhHellTrickCard { playerId: string; card: StandardCard }
export interface OhHellDealSummary { dealNumber: number; handSize: number; bids: Record<string, number>; tricks: Record<string, number>; points: Record<string, number> }
export interface OhHellGameState {
  players: DistinctPlayer[]; hostId: string; hands: Record<string, StandardCard[]>; dealerIndex: number;
  dealNumber: number; handSize: number; trumpCard: StandardCard; trumpSuit: CardSuit;
  bids: Record<string, number | null>; tricksWon: Record<string, number>; scores: Record<string, number>;
  trick: OhHellTrickCard[]; currentTurnId: string; leaderId: string; lastDeal: OhHellDealSummary | null;
  phase: 'bidding' | 'playing' | 'deal_complete' | 'finished'; winnerId: string | null; isDraw: boolean;
  finishReason: 'schedule_complete' | 'surrender' | null;
}
export interface OhHellResult { gameKey: 'oh-hell'; winnerId: string | null; isDraw: boolean; reason: 'schedule_complete' | 'surrender'; scores: Record<string, number> }
export interface OhHellPlayerView {
  gameKey: 'oh-hell'; players: Array<DistinctPlayer & { handCount: number; bid: number | null; tricksWon: number; score: number }>;
  hostId: string; youId: string; yourHand: StandardCard[]; dealerId: string; dealNumber: number; handSize: number;
  trumpCard: StandardCard; trumpSuit: CardSuit; trick: OhHellTrickCard[]; currentTurnId: string;
  leaderId: string; lastDeal: OhHellDealSummary | null; phase: OhHellGameState['phase']; winnerId: string | null;
  isDraw: boolean; canAct: boolean; legalBids: number[]; legalCardIds: string[];
}

export type PresidentAction =
  | { type: 'play_president_cards'; cardIds: string[] }
  | { type: 'pass_president' }
  | { type: 'return_president_card'; cardId: string }
  | { type: 'next_president_round' };
export interface PresidentPilePlay { playerId: string; rank: CardRank; count: number; cards: StandardCard[] }
export interface PresidentRoundSummary { roundNumber: number; ranking: string[]; points: Record<string, number> }
export interface PresidentGameState {
  players: DistinctPlayer[]; hostId: string; hands: Record<string, StandardCard[]>;
  dealerIndex: number; roundNumber: number; currentTurnId: string; activePlayerIds: string[];
  pilePlay: PresidentPilePlay | null; passedSincePlay: string[]; ranking: string[];
  previousRanking: string[]; scores: Record<string, number>; exchangeFromId: string | null;
  lastRound: PresidentRoundSummary | null; phase: 'exchange' | 'playing' | 'round_complete' | 'finished';
  winnerId: string | null; isDraw: boolean; finishReason: 'eight_rounds' | 'surrender' | null;
}
export interface PresidentResult { gameKey: 'president'; winnerId: string | null; isDraw: boolean; reason: 'eight_rounds' | 'surrender'; scores: Record<string, number>; lastRanking: string[] }
export interface PresidentPlayerView {
  gameKey: 'president'; players: Array<DistinctPlayer & { handCount: number; score: number; finishPlace: number | null }>;
  hostId: string; youId: string; yourHand: StandardCard[]; roundNumber: number; currentTurnId: string;
  pilePlay: PresidentPilePlay | null; ranking: string[]; previousRanking: string[]; lastRound: PresidentRoundSummary | null;
  phase: PresidentGameState['phase']; winnerId: string | null; isDraw: boolean; canAct: boolean;
  legalPlays: Array<{ rank: CardRank; cardIds: string[] }>; canPass: boolean; canReturn: boolean;
}

export type SlapjackAction =
  | { type: 'flip_slapjack' }
  | { type: 'slap_jack' }
  | { type: 'continue_slapjack' };
export interface SlapjackPileCard { playerId: string; card: StandardCard }
export interface SlapjackGameState {
  players: DistinctPlayer[]; stacks: Record<string, StandardCard[]>; pile: SlapjackPileCard[];
  currentTurnId: string; topPlayerId: string | null; eliminatedIds: string[]; lastChanceIds: string[];
  phase: 'playing' | 'slap_window' | 'finished'; winnerId: string | null; isDraw: false;
  finishReason: 'all_cards' | 'last_active' | 'surrender' | null;
}
export interface SlapjackResult { gameKey: 'slapjack'; winnerId: string; isDraw: false; reason: 'all_cards' | 'last_active' | 'surrender'; cardCounts: Record<string, number> }
export interface SlapjackPlayerView {
  gameKey: 'slapjack'; players: Array<DistinctPlayer & { cardCount: number; eliminated: boolean; lastChance: boolean }>;
  youId: string; pileCount: number; topCard: StandardCard | null; topPlayerId: string | null;
  currentTurnId: string; phase: SlapjackGameState['phase']; winnerId: string | null;
  canAct: boolean; canFlip: boolean; canSlap: boolean; canContinue: boolean;
}

export type SpoonsAction = { type: 'pass_spoon_card'; cardId: string } | { type: 'grab_spoon' } | { type: 'next_spoons_round' };
export interface SpoonsRoundSummary { roundNumber: number; loserId: string; eliminated: boolean; letters: Record<string, number> }
export interface SpoonsGameState {
  players: DistinctPlayer[]; hostId: string; hands: Record<string, StandardCard[]>; stock: StandardCard[];
  trash: StandardCard[]; activePlayerIds: string[]; dealerIndex: number; currentTurnId: string;
  spoonsRemaining: number; grabbedIds: string[]; letters: Record<string, number>; roundNumber: number;
  lastRound: SpoonsRoundSummary | null; phase: 'passing' | 'spoon_rush' | 'round_complete' | 'finished';
  winnerId: string | null; isDraw: false; finishReason: 'last_player' | 'surrender' | null;
}
export interface SpoonsResult { gameKey: 'spoons'; winnerId: string; isDraw: false; reason: 'last_player' | 'surrender'; letters: Record<string, number> }
export interface SpoonsPlayerView {
  gameKey: 'spoons'; players: Array<DistinctPlayer & { handCount: number; letters: number; active: boolean; grabbed: boolean }>;
  hostId: string; youId: string; yourHand: StandardCard[]; currentTurnId: string; dealerId: string;
  spoonsRemaining: number; roundNumber: number; lastRound: SpoonsRoundSummary | null;
  phase: SpoonsGameState['phase']; winnerId: string | null; canPass: boolean; canGrab: boolean; canStartNext: boolean;
  canAct: boolean;
}

export type DurakAction =
  | { type: 'durak_attack'; cardId: string }
  | { type: 'durak_defend'; pairIndex: number; cardId: string }
  | { type: 'durak_take' }
  | { type: 'durak_pass' };
export interface DurakPair { attack: StandardCard; attackerId: string; defense: StandardCard | null }
export interface DurakGameState {
  players: DistinctPlayer[]; hands: Record<string, StandardCard[]>; stock: StandardCard[];
  trumpCard: StandardCard; trumpSuit: CardSuit; table: DurakPair[]; activePlayerIds: string[];
  safeOrder: string[]; mainAttackerId: string; defenderId: string; currentTurnId: string;
  attackLimit: number; passedAttackerIds: string[]; phase: 'attack' | 'defend' | 'throw_in' | 'finished';
  winnerId: string | null; loserId: string | null; isDraw: boolean; finishReason: 'durak' | 'surrender' | null;
}
export interface DurakResult { gameKey: 'durak'; winnerId: string | null; loserId: string | null; isDraw: boolean; reason: 'durak' | 'surrender'; safeOrder: string[] }
export interface DurakPlayerView {
  gameKey: 'durak'; players: Array<DistinctPlayer & { handCount: number; safePlace: number | null }>;
  youId: string; yourHand: StandardCard[]; stockCount: number; trumpCard: StandardCard; trumpSuit: CardSuit;
  table: DurakPair[]; mainAttackerId: string; defenderId: string; currentTurnId: string;
  attackLimit: number; phase: 'attack' | 'defend' | 'throw_in' | 'finished'; winnerId: string | null; loserId: string | null;
  canAct: boolean; legalAttackCardIds: string[]; legalDefenses: Array<{ pairIndex: number; cardIds: string[] }>;
  canTake: boolean; canPass: boolean;
}

export type GolfAction =
  | { type: 'reveal_golf_cards'; indices: number[] }
  | { type: 'draw_golf_card'; source: 'stock' | 'discard' }
  | { type: 'replace_golf_card'; index: number }
  | { type: 'discard_golf_draw'; revealIndex: number | null }
  | { type: 'next_golf_hole' };
export interface GolfGridCard { card: StandardCard; faceUp: boolean }
export interface GolfGameState {
  players: DistinctPlayer[]; hostId: string; grids: Record<string, GolfGridCard[]>; stock: StandardCard[];
  discardPile: StandardCard[]; setupCompleteIds: string[]; dealerIndex: number; currentTurnId: string;
  drawn: { playerId: string; card: StandardCard; source: 'stock' | 'discard' } | null;
  totalScores: Record<string, number>; holeNumber: number; lastHole: GolfHoleSummary | null;
  phase: 'setup' | 'drawing' | 'placing' | 'hole_complete' | 'finished'; winnerId: string | null;
  isDraw: boolean; finishReason: 'nine_holes' | 'surrender' | null;
}
export interface GolfGridCardView { card: StandardCard | null; faceUp: boolean }
export interface GolfHoleSummary { holeNumber: number; scores: Record<string, number>; grids: Record<string, StandardCard[]> }
export interface GolfResult { gameKey: 'six-card-golf'; winnerId: string | null; isDraw: boolean; reason: 'nine_holes' | 'surrender'; totalScores: Record<string, number> }
export interface GolfPlayerView {
  gameKey: 'six-card-golf'; players: Array<DistinctPlayer & { totalScore: number; setupComplete: boolean }>;
  hostId: string; youId: string; yourGrid: GolfGridCardView[]; publicGrids: Record<string, GolfGridCardView[]>;
  stockCount: number; topDiscard: StandardCard; currentTurnId: string; dealerId: string;
  drawnCard: StandardCard | null; drawnSource: 'stock' | 'discard' | null; holeNumber: number;
  lastHole: GolfHoleSummary | null; phase: 'setup' | 'drawing' | 'placing' | 'hole_complete' | 'finished';
  winnerId: string | null; isDraw: boolean; canAct: boolean; canRevealSetup: boolean; canDraw: boolean;
  canReplace: boolean; canDiscardDraw: boolean;
}

export const COLOR_MATCH_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type ColorMatchColor = (typeof COLOR_MATCH_COLORS)[number];
export interface ColorMatchCard { id: string; color: ColorMatchColor; value: number }
export type ColorMatchAction = { type: 'commit_color_match'; cardIds: string[] };
export interface ColorMatchReveal { roundNumber: number; targets: [ColorMatchColor, ColorMatchColor, ColorMatchColor]; commitments: Record<string, ColorMatchCard[]>; points: Record<string, number> }
export interface ColorMatchGameState {
  players: DistinctPlayer[]; hands: Record<string, ColorMatchCard[]>; deck: ColorMatchCard[];
  targets: [ColorMatchColor, ColorMatchColor, ColorMatchColor]; targetDeck: ColorMatchColor[];
  commitments: Record<string, ColorMatchCard[] | null>; scores: Record<string, number>;
  roundNumber: number; lastReveal: ColorMatchReveal | null; phase: 'planning' | 'finished';
  winnerId: string | null; isDraw: boolean; finishReason: 'six_rounds' | 'surrender' | null;
}
export interface ColorMatchResult { gameKey: 'color-match'; winnerId: string | null; isDraw: boolean; reason: 'six_rounds' | 'surrender'; scores: Record<string, number> }
export interface ColorMatchPlayerView {
  gameKey: 'color-match'; players: Array<DistinctPlayer & { score: number; committed: boolean }>;
  youId: string; yourHand: ColorMatchCard[]; yourCommitment: ColorMatchCard[] | null;
  targets: [ColorMatchColor, ColorMatchColor, ColorMatchColor]; roundNumber: number;
  lastReveal: ColorMatchReveal | null; phase: 'planning' | 'finished'; winnerId: string | null;
  isDraw: boolean; canAct: boolean;
}

export interface DistinctGameContractMap {
  reversi: { action: ReversiAction; view: ReversiPlayerView; result: ReversiResult };
  checkers: { action: CheckersAction; view: CheckersPlayerView; result: CheckersResult };
  mancala: { action: MancalaAction; view: MancalaPlayerView; result: MancalaResult };
  dotsandboxes: { action: DotsAndBoxesAction; view: DotsAndBoxesPlayerView; result: DotsAndBoxesResult };
  pig: { action: PigAction; view: PigPlayerView; result: PigResult };
  'grid-salvo': { action: GridSalvoAction; view: GridSalvoPlayerView; result: GridSalvoResult };
  'peg-codebreaker': { action: PegCodeAction; view: PegCodePlayerView; result: PegCodeResult };
  hangman: { action: HangmanAction; view: HangmanPlayerView; result: HangmanResult };
  'go-fish': { action: GoFishAction; view: GoFishPlayerView; result: GoFishResult };
  'crazy-eights': { action: CrazyEightsAction; view: CrazyEightsPlayerView; result: CrazyEightsResult };
  'five-dice-yacht': { action: YachtAction; view: YachtPlayerView; result: YachtResult };
  'liars-dice': { action: LiarsDiceAction; view: LiarsDicePlayerView; result: LiarsDiceResult };
  farkle: { action: FarkleAction; view: FarklePlayerView; result: FarkleResult };
  'shut-the-box': { action: ShutTheBoxAction; view: ShutTheBoxPlayerView; result: ShutTheBoxResult };
  'draw-dominoes': { action: DrawDominoesAction; view: DrawDominoesPlayerView; result: DrawDominoesResult };
  hearts: { action: HeartsAction; view: HeartsPlayerView; result: HeartsResult };
  spades: { action: SpadesAction; view: SpadesPlayerView; result: SpadesResult };
  'gin-rummy': { action: GinRummyAction; view: GinRummyPlayerView; result: GinRummyResult };
  'card-war': { action: CardWarAction; view: CardWarPlayerView; result: CardWarResult };
  'old-maid': { action: OldMaidAction; view: OldMaidPlayerView; result: OldMaidResult };
  hex: { action: HexAction; view: HexPlayerView; result: HexResult };
  'nine-mens-morris': { action: MorrisAction; view: MorrisPlayerView; result: MorrisResult };
  'cee-lo': { action: CeeLoAction; view: CeeLoPlayerView; result: CeeLoResult };
  'trivia-quiz-bowl': { action: TriviaAction; view: TriviaPlayerView; result: TriviaResult };
  'memory-match': { action: MemoryMatchAction; view: MemoryMatchPlayerView; result: MemoryMatchResult };
  'contract-bridge': { action: BridgeAction; view: BridgePlayerView; result: BridgeResult };
  bourre: { action: BourreAction; view: BourrePlayerView; result: BourreResult };
  bluff: { action: BluffAction; view: BluffPlayerView; result: BluffResult };
  sevens: { action: SevensAction; view: SevensPlayerView; result: SevensResult };
  'ninety-nine': { action: NinetyNineAction; view: NinetyNinePlayerView; result: NinetyNineResult };
  euchre: { action: EuchreAction; view: EuchrePlayerView; result: EuchreResult };
  whist: { action: WhistAction; view: WhistPlayerView; result: WhistResult };
  'oh-hell': { action: OhHellAction; view: OhHellPlayerView; result: OhHellResult };
  president: { action: PresidentAction; view: PresidentPlayerView; result: PresidentResult };
  slapjack: { action: SlapjackAction; view: SlapjackPlayerView; result: SlapjackResult };
  spoons: { action: SpoonsAction; view: SpoonsPlayerView; result: SpoonsResult };
  durak: { action: DurakAction; view: DurakPlayerView; result: DurakResult };
  'six-card-golf': { action: GolfAction; view: GolfPlayerView; result: GolfResult };
  'color-match': { action: ColorMatchAction; view: ColorMatchPlayerView; result: ColorMatchResult };
}

export type DistinctGameAction = DistinctGameContractMap[DistinctGameKey]['action'];
export type DistinctGamePlayerView = DistinctGameContractMap[DistinctGameKey]['view'];
export type DistinctTypedGameResult = DistinctGameContractMap[DistinctGameKey]['result'];
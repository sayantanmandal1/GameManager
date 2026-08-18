import { GameType } from './types/lobby';

export type GameCategory =
  | 'board'
  | 'cards'
  | 'party'
  | 'strategy'
  | 'race'
  | 'puzzle';

export type GameFamily =
  | 'bingo'
  | 'chess'
  | 'ludo'
  | 'photobooth'
  | 'uno'
  | 'tictactoe'
  | 'connectfour'
  | 'sudoku'
  | 'alignment'
  | 'takeaway'
  | 'race'
  | 'memory';

export interface GameCatalogEntry {
  key: string;
  name: string;
  gameType: GameType;
  family: GameFamily;
  category: GameCategory;
  description: string;
  mark: string;
  route: string;
  minPlayers: number;
  maxPlayers: number;
  accent: string;
  surface: string;
  rules: Record<string, unknown>;
}

const palette: Record<GameCategory, { accent: string; surface: string }> = {
  board: { accent: '#65aaf6', surface: '#182938' },
  cards: { accent: '#f2c94c', surface: '#382d16' },
  party: { accent: '#ff8db3', surface: '#351d2a' },
  strategy: { accent: '#d7a7ff', surface: '#2c2036' },
  race: { accent: '#63d5a4', surface: '#173126' },
  puzzle: { accent: '#8dd8c1', surface: '#1d302d' },
};

function entry(
  definition: Omit<GameCatalogEntry, 'accent' | 'surface'>,
): GameCatalogEntry {
  return { ...definition, ...palette[definition.category] };
}

const established: GameCatalogEntry[] = [
  entry({ key: 'bingo', name: 'Bingo Classic', gameType: GameType.BINGO, family: 'bingo', category: 'party', description: 'Build your card and race for five lines.', mark: '75', route: '/games/bingo', minPlayers: 2, maxPlayers: 8, rules: {} }),
  entry({ key: 'bingo-duel', name: 'Bingo Duel', gameType: GameType.BINGO, family: 'bingo', category: 'party', description: 'A focused two-player race for five lines.', mark: '2P', route: '/games/preset/bingo-duel', minPlayers: 2, maxPlayers: 2, rules: {} }),
  entry({ key: 'bingo-party', name: 'Bingo Party', gameType: GameType.BINGO, family: 'bingo', category: 'party', description: 'A fast four-seat Bingo table.', mark: '4P', route: '/games/preset/bingo-party', minPlayers: 2, maxPlayers: 4, rules: {} }),
  entry({ key: 'chess', name: 'Chess Classic', gameType: GameType.CHESS, family: 'chess', category: 'board', description: 'Untimed standard chess with legal move validation.', mark: 'N', route: '/games/preset/chess', minPlayers: 2, maxPlayers: 2, rules: { timeControl: null } }),
  entry({ key: 'chess-bullet-1', name: 'Bullet Chess 1+0', gameType: GameType.CHESS, family: 'chess', category: 'board', description: 'One minute per side with no increment.', mark: '1', route: '/games/preset/chess-bullet-1', minPlayers: 2, maxPlayers: 2, rules: { timeControl: { baseMs: 60000, incrementMs: 0 } } }),
  entry({ key: 'chess-bullet-2', name: 'Bullet Chess 2+1', gameType: GameType.CHESS, family: 'chess', category: 'board', description: 'Two minutes with a one-second increment.', mark: '2', route: '/games/preset/chess-bullet-2', minPlayers: 2, maxPlayers: 2, rules: { timeControl: { baseMs: 120000, incrementMs: 1000 } } }),
  entry({ key: 'chess-blitz-3', name: 'Blitz Chess 3+0', gameType: GameType.CHESS, family: 'chess', category: 'board', description: 'Three-minute tactical chess.', mark: '3', route: '/games/preset/chess-blitz-3', minPlayers: 2, maxPlayers: 2, rules: { timeControl: { baseMs: 180000, incrementMs: 0 } } }),
  entry({ key: 'chess-blitz-5', name: 'Blitz Chess 5+3', gameType: GameType.CHESS, family: 'chess', category: 'board', description: 'Five minutes with a three-second increment.', mark: '5', route: '/games/preset/chess-blitz-5', minPlayers: 2, maxPlayers: 2, rules: { timeControl: { baseMs: 300000, incrementMs: 3000 } } }),
  entry({ key: 'chess-rapid-10', name: 'Rapid Chess 10+0', gameType: GameType.CHESS, family: 'chess', category: 'board', description: 'Ten-minute standard chess.', mark: '10', route: '/games/preset/chess-rapid-10', minPlayers: 2, maxPlayers: 2, rules: { timeControl: { baseMs: 600000, incrementMs: 0 } } }),
  entry({ key: 'uno', name: 'UNO Classic', gameType: GameType.UNO, family: 'uno', category: 'cards', description: 'Official matching rules for two to four players.', mark: '7', route: '/games/preset/uno', minPlayers: 2, maxPlayers: 4, rules: { unoRules: { mode: 'classic', targetScore: null, stacking: false, drawToMatch: false, jumpIn: false, sevenZero: false, forcePlay: false, noBluffing: false } } }),
  entry({ key: 'uno-no-mercy', name: 'UNO No Mercy', gameType: GameType.UNO, family: 'uno', category: 'cards', description: 'Elimination rules and punishing draw chains.', mark: '+10', route: '/games/preset/uno-no-mercy', minPlayers: 2, maxPlayers: 4, rules: { unoRules: { mode: 'noMercy', targetScore: null, stacking: false, drawToMatch: false, jumpIn: false, sevenZero: false, forcePlay: false, noBluffing: false } } }),
  entry({ key: 'uno-flip', name: 'UNO Flip', gameType: GameType.UNO, family: 'uno', category: 'cards', description: 'Two-sided cards with light and dark rules.', mark: 'F', route: '/games/preset/uno-flip', minPlayers: 2, maxPlayers: 4, rules: { unoRules: { mode: 'flip', targetScore: null, stacking: false, drawToMatch: false, jumpIn: false, sevenZero: false, forcePlay: false, noBluffing: false } } }),
  entry({ key: 'uno-stacking', name: 'UNO Stack Attack', gameType: GameType.UNO, family: 'uno', category: 'cards', description: 'Custom UNO with draw-card stacking enabled.', mark: '+', route: '/games/preset/uno-stacking', minPlayers: 2, maxPlayers: 4, rules: { unoRules: { mode: 'custom', targetScore: null, stacking: true, drawToMatch: false, jumpIn: false, sevenZero: false, forcePlay: false, noBluffing: false } } }),
  entry({ key: 'uno-seven-zero', name: 'UNO Seven-Zero', gameType: GameType.UNO, family: 'uno', category: 'cards', description: 'Sevens swap hands and zeroes rotate them.', mark: '7/0', route: '/games/preset/uno-seven-zero', minPlayers: 2, maxPlayers: 4, rules: { unoRules: { mode: 'custom', targetScore: null, stacking: false, drawToMatch: false, jumpIn: false, sevenZero: true, forcePlay: false, noBluffing: false } } }),
  entry({ key: 'ludo', name: 'Ludo Classic', gameType: GameType.LUDO, family: 'ludo', category: 'race', description: 'Race four tokens around the classic board.', mark: 'O', route: '/games/ludo', minPlayers: 2, maxPlayers: 4, rules: {} }),
  entry({ key: 'ludo-duel', name: 'Ludo Duel', gameType: GameType.LUDO, family: 'ludo', category: 'race', description: 'Two opposite colors in a direct race.', mark: '2P', route: '/games/preset/ludo-duel', minPlayers: 2, maxPlayers: 2, rules: {} }),
  entry({ key: 'ludo-trio', name: 'Ludo Trio', gameType: GameType.LUDO, family: 'ludo', category: 'race', description: 'A balanced three-player Ludo table.', mark: '3P', route: '/games/preset/ludo-trio', minPlayers: 2, maxPlayers: 3, rules: {} }),
  entry({ key: 'photobooth', name: 'Photobooth', gameType: GameType.PHOTOBOOTH, family: 'photobooth', category: 'party', description: 'Create a collaborative photo strip together.', mark: 'C', route: '/games/photobooth', minPlayers: 2, maxPlayers: 2, rules: {} }),
  entry({ key: 'tictactoe', name: 'Tic Tac Toe', gameType: GameType.TICTACTOE, family: 'tictactoe', category: 'strategy', description: 'Classic and limited-piece tactical play.', mark: 'X', route: '/games/tictactoe', minPlayers: 2, maxPlayers: 2, rules: {} }),
  entry({ key: 'connectfour', name: 'Connect Four', gameType: GameType.CONNECTFOUR, family: 'connectfour', category: 'strategy', description: 'Drop discs and connect a line of four.', mark: '4', route: '/games/connectfour', minPlayers: 2, maxPlayers: 2, rules: {} }),
  entry({ key: 'sudoku', name: 'Sudoku', gameType: GameType.SUDOKU, family: 'sudoku', category: 'puzzle', description: 'A focused solo number grid with notes and validation.', mark: '9', route: '/games/sudoku', minPlayers: 1, maxPlayers: 1, rules: {} }),
];

const alignmentPresets = [
  ['three-grid', 'Three Grid', 3, 3, false, false, 0],
  ['misere-three', 'Misere Three', 3, 3, false, true, 0],
  ['three-piece-grid', 'Three Piece Grid', 3, 3, false, false, 3],
  ['four-grid-three', 'Four Grid: Connect 3', 4, 3, false, false, 0],
  ['four-grid-four', 'Four Grid: Connect 4', 4, 4, false, false, 0],
  ['four-grid-misere', 'Four Grid Misere', 4, 3, false, true, 0],
  ['four-grid-limited', 'Four Grid Limited', 4, 3, false, false, 4],
  ['five-grid-four', 'Five Grid: Connect 4', 5, 4, false, false, 0],
  ['five-grid-five', 'Five Grid: Connect 5', 5, 5, false, false, 0],
  ['five-grid-misere', 'Five Grid Misere', 5, 4, false, true, 0],
  ['five-grid-limited', 'Five Grid Limited', 5, 4, false, false, 5],
  ['gomoku-nine', 'Gomoku 9', 9, 5, false, false, 0],
  ['gomoku-eleven', 'Gomoku 11', 11, 5, false, false, 0],
  ['gomoku-thirteen', 'Gomoku 13', 13, 5, false, false, 0],
  ['misere-gomoku', 'Misere Gomoku', 9, 5, false, true, 0],
  ['gravity-four', 'Gravity Four', 7, 4, true, false, 0],
  ['gravity-five', 'Gravity Five', 8, 5, true, false, 0],
  ['gravity-three', 'Pocket Connect 3', 5, 3, true, false, 0],
  ['gravity-wide', 'Wide Connect 4', 9, 4, true, false, 0],
  ['gravity-tall', 'Tall Connect 4', 6, 4, true, false, 0],
  ['gravity-misere', 'Gravity Misere', 7, 4, true, true, 0],
  ['six-grid-four', 'Six Grid: Connect 4', 6, 4, false, false, 0],
  ['seven-grid-five', 'Seven Grid: Connect 5', 7, 5, false, false, 0],
  ['eight-grid-five', 'Eight Grid: Connect 5', 8, 5, false, false, 0],
  ['nine-grid-six', 'Nine Grid: Connect 6', 9, 6, false, false, 0],
] as const;

const alignment = alignmentPresets.map(([key, name, size, connect, gravity, misere, pieceLimit]) =>
  entry({ key, name, gameType: GameType.ARCADE, family: 'alignment', category: 'strategy', description: `${size} by ${size} board; ${misere ? 'avoid' : 'make'} a line of ${connect}${gravity ? ' with gravity' : ''}.`, mark: String(connect), route: `/games/arcade/${key}`, minPlayers: 2, maxPlayers: 2, rules: { size, connect, gravity, misere, pieceLimit } }),
);

const takeawayPresets = [
  ['nim-classic', 'Classic Nim', [3, 4, 5], 0, false],
  ['nim-misere', 'Misere Nim', [3, 4, 5], 0, true],
  ['nim-mini', 'Mini Nim', [2, 3, 4], 0, false],
  ['nim-grand', 'Grand Nim', [5, 7, 9], 0, false],
  ['nim-four-heaps', 'Four Heap Nim', [2, 3, 4, 5], 0, false],
  ['nim-four-misere', 'Four Heap Misere', [2, 3, 4, 5], 0, true],
  ['take-15', 'Take 15', [15], 3, false],
  ['take-15-misere', 'Avoid 15', [15], 3, true],
  ['take-21', 'Take 21', [21], 4, false],
  ['take-21-misere', 'Avoid 21', [21], 4, true],
  ['take-31', 'Take 31', [31], 5, false],
  ['take-31-misere', 'Avoid 31', [31], 5, true],
  ['double-pile', 'Double Pile', [10, 10], 3, false],
  ['double-pile-misere', 'Double Pile Misere', [10, 10], 3, true],
  ['triple-seven', 'Triple Seven', [7, 7, 7], 3, false],
  ['triple-seven-misere', 'Triple Seven Misere', [7, 7, 7], 3, true],
  ['staircase-nim', 'Staircase Nim', [1, 2, 3, 4, 5], 0, false],
  ['staircase-misere', 'Staircase Misere', [1, 2, 3, 4, 5], 0, true],
  ['tower-take', 'Tower Take', [25], 6, false],
  ['tower-avoid', 'Tower Avoid', [25], 6, true],
] as const;

const takeaway = takeawayPresets.map(([key, name, heaps, maxTake, misere]) =>
  entry({ key, name, gameType: GameType.ARCADE, family: 'takeaway', category: 'strategy', description: `${misere ? 'Avoid taking' : 'Take'} the final counter across ${heaps.length} ${heaps.length === 1 ? 'pile' : 'piles'}.`, mark: 'N', route: `/games/arcade/${key}`, minPlayers: 2, maxPlayers: 2, rules: { heaps, maxTake, misere } }),
);

const racePresets = [
  ['sprint-30', 'Sprint 30', 30, 6, true, 3, 101],
  ['sprint-30-fast', 'Sprint 30 Turbo', 30, 8, false, 4, 102],
  ['race-40', 'Race 40', 40, 6, true, 5, 103],
  ['race-40-open', 'Race 40 Open', 40, 6, false, 6, 104],
  ['race-50', 'Race 50', 50, 6, true, 7, 105],
  ['race-50-turbo', 'Race 50 Turbo', 50, 10, false, 8, 106],
  ['chutes-64', 'Chutes 64', 64, 6, true, 10, 107],
  ['ladders-64', 'Ladders 64', 64, 6, false, 12, 108],
  ['race-75', 'Race 75', 75, 8, true, 12, 109],
  ['race-75-wild', 'Race 75 Wild', 75, 10, false, 14, 110],
  ['century-race', 'Century Race', 100, 6, true, 16, 111],
  ['century-open', 'Century Open', 100, 6, false, 16, 112],
  ['century-turbo', 'Century Turbo', 100, 12, false, 18, 113],
  ['mini-chutes', 'Mini Chutes', 36, 6, true, 8, 114],
  ['quick-ladders', 'Quick Ladders', 49, 8, false, 10, 115],
  ['precision-race', 'Precision Race', 60, 4, true, 8, 116],
  ['d12-dash', 'D12 Dash', 72, 12, false, 10, 117],
  ['marathon-120', 'Marathon 120', 120, 8, true, 20, 118],
  ['marathon-wild', 'Marathon Wild', 120, 12, false, 24, 119],
  ['tiny-track', 'Tiny Track', 24, 4, true, 4, 120],
] as const;

const races = racePresets.map(([key, name, boardSize, dieSides, exactFinish, jumpCount, seed]) =>
  entry({ key, name, gameType: GameType.ARCADE, family: 'race', category: 'race', description: `Roll a d${dieSides} across ${boardSize} spaces with ${jumpCount} shortcuts and setbacks.`, mark: `d${dieSides}`, route: `/games/arcade/${key}`, minPlayers: 2, maxPlayers: 4, rules: { boardSize, dieSides, exactFinish, jumpCount, seed } }),
);

const memoryPresets = [
  ['memory-animals', 'Animal Memory', 6, 'animals'],
  ['memory-shapes', 'Shape Memory', 6, 'shapes'],
  ['memory-food', 'Food Memory', 8, 'food'],
  ['memory-space', 'Space Memory', 8, 'space'],
  ['memory-flags', 'Flag Memory', 10, 'flags'],
  ['memory-sports', 'Sports Memory', 10, 'sports'],
  ['memory-music', 'Music Memory', 12, 'music'],
  ['memory-travel', 'Travel Memory', 12, 'travel'],
  ['memory-nature', 'Nature Memory', 14, 'nature'],
  ['memory-tech', 'Tech Memory', 14, 'tech'],
  ['memory-ocean', 'Ocean Memory', 16, 'ocean'],
  ['memory-garden', 'Garden Memory', 16, 'garden'],
  ['memory-symbols', 'Symbol Memory', 18, 'symbols'],
  ['memory-master', 'Memory Master', 20, 'master'],
  ['memory-sprint', 'Memory Sprint', 5, 'sprint'],
] as const;

const memory = memoryPresets.map(([key, name, pairs, theme]) =>
  entry({ key, name, gameType: GameType.ARCADE, family: 'memory', category: 'puzzle', description: `Compete to collect the most pairs from a ${pairs * 2}-tile ${theme} deck.`, mark: String(pairs), route: `/games/arcade/${key}`, minPlayers: 2, maxPlayers: 4, rules: { pairs, theme } }),
);

export const GAME_CATALOG: readonly GameCatalogEntry[] = Object.freeze([
  ...established,
  ...alignment,
  ...takeaway,
  ...races,
  ...memory,
]);

const catalogByKey = new Map(GAME_CATALOG.map((game) => [game.key, game]));

export function getGameDefinition(key: string): GameCatalogEntry | null {
  return catalogByKey.get(key) ?? null;
}

export function getDefaultGameDefinition(gameType: GameType): GameCatalogEntry | null {
  return GAME_CATALOG.find((game) => game.gameType === gameType) ?? null;
}

import {
  DISTINCT_GAME_KEYS,
  GameType,
  isDistinctGameKey,
  type GameCatalogEntry,
  type GameCatalogResponse,
} from '@/shared';

const ROUTE_PATTERN = /^\/games\/[a-z0-9/-]+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const EXPECTED_GAME_COUNT = 8 + DISTINCT_GAME_KEYS.length;

export function parseGameCatalog(value: unknown): GameCatalogResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid game catalog');
  const candidate = value as { games?: unknown; total?: unknown };
  if (!Array.isArray(candidate.games) || candidate.games.length !== EXPECTED_GAME_COUNT) {
    throw new Error('Invalid game catalog');
  }
  const games = candidate.games.filter(isCatalogEntry);
  if (games.length !== candidate.games.length || candidate.total !== games.length) {
    throw new Error('Invalid game catalog');
  }
  if (new Set(games.map((game) => game.key)).size !== games.length) {
    throw new Error('Invalid game catalog');
  }
  return { games, total: games.length };
}

function isCatalogEntry(value: unknown): value is GameCatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<GameCatalogEntry>;
  const validText =
    typeof entry.key === 'string' &&
    /^[a-z0-9-]{1,32}$/.test(entry.key) &&
    typeof entry.name === 'string' &&
    entry.name.length > 0 &&
    entry.name.length <= 40 &&
    typeof entry.mark === 'string' &&
    entry.mark.length > 0 &&
    entry.mark.length <= 4 &&
    typeof entry.description === 'string' &&
    entry.description.length <= 160;
  const validPresentation =
    typeof entry.route === 'string' &&
    ROUTE_PATTERN.test(entry.route) &&
    typeof entry.accent === 'string' &&
    COLOR_PATTERN.test(entry.accent) &&
    typeof entry.surface === 'string' &&
    COLOR_PATTERN.test(entry.surface);
  const validCapacity =
    Number.isInteger(entry.minPlayers) &&
    Number.isInteger(entry.maxPlayers) &&
    (entry.minPlayers ?? 0) >= 1 &&
    (entry.maxPlayers ?? 0) >= (entry.minPlayers ?? 0) &&
    (entry.maxPlayers ?? 0) <= 10;
  const validType = Object.values(GameType).includes(entry.gameType as GameType);
  const validKey =
    entry.gameType === GameType.DISTINCT
      ? typeof entry.gameKey === 'string' && isDistinctGameKey(entry.gameKey)
      : entry.gameKey === null;
  const validModes =
    Array.isArray(entry.modes) &&
    entry.modes.length > 0 &&
    entry.modes.length <= 4 &&
    entry.modes.every(
      (mode) =>
        !!mode &&
        ['online', 'offline', 'bot', 'solo'].includes(mode.key) &&
        typeof mode.route === 'string' &&
        ROUTE_PATTERN.test(mode.route),
    );
  return validText && validPresentation && validCapacity && validType && validKey && validModes;
}
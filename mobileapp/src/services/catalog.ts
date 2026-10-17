import { API_URL } from '../config';
import type { GameDefinition, GameModeKey } from '../types';

interface CatalogEntry {
  key: string;
  name: string;
  mark: string;
  description: string;
  route: string;
  accent: string;
  surface: string;
  minPlayers?: unknown;
  maxPlayers?: unknown;
  modes?: unknown;
}

const ROUTE_PATTERN = /^\/games\/[a-z0-9/-]+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MODE_KEYS: readonly GameModeKey[] = ['online', 'offline', 'bot', 'solo'];
const MAX_CATALOG_SIZE = 500;

/**
 * Loads the live game catalog. Validation is structural rather than tied to a
 * fixed game count, so installed apps pick up newly released games without an
 * APK update. Malformed entries are skipped instead of hiding the whole shelf.
 */
export async function getGameCatalog(signal?: AbortSignal): Promise<GameDefinition[]> {
  const response = await fetch(`${API_URL}/games/catalog`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  return parseGameCatalog(await response.json());
}

export function parseGameCatalog(payload: unknown): GameDefinition[] {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid game catalog');
  const candidate = payload as { games?: unknown };
  if (!Array.isArray(candidate.games) || candidate.games.length > MAX_CATALOG_SIZE) {
    throw new Error('Invalid game catalog');
  }

  const seen = new Set<string>();
  const games: GameDefinition[] = [];
  for (const value of candidate.games) {
    if (!isCatalogEntry(value) || seen.has(value.key)) continue;
    seen.add(value.key);
    games.push({
      id: value.key,
      title: value.name,
      mark: value.mark,
      description: value.description,
      route: value.route,
      accent: value.accent,
      surface: value.surface,
      minPlayers: playerCount(value.minPlayers),
      maxPlayers: playerCount(value.maxPlayers),
      modes: parseModes(value.modes),
    });
  }
  if (games.length === 0) throw new Error('No games are available right now');
  return games;
}

function playerCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 16 ? value : null;
}

function parseModes(value: unknown): GameModeKey[] {
  if (!Array.isArray(value)) return [];
  const modes = new Set<GameModeKey>();
  for (const mode of value) {
    const key = (mode as { key?: unknown } | null)?.key;
    if (typeof key === 'string' && (MODE_KEYS as readonly string[]).includes(key)) {
      modes.add(key as GameModeKey);
    }
  }
  return [...modes];
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CatalogEntry>;
  return (
    typeof entry.key === 'string' &&
    /^[a-z0-9-]{1,40}$/.test(entry.key) &&
    typeof entry.name === 'string' &&
    entry.name.length > 0 &&
    entry.name.length <= 60 &&
    typeof entry.mark === 'string' &&
    entry.mark.length > 0 &&
    entry.mark.length <= 8 &&
    typeof entry.description === 'string' &&
    entry.description.length <= 300 &&
    typeof entry.route === 'string' &&
    ROUTE_PATTERN.test(entry.route) &&
    typeof entry.accent === 'string' &&
    COLOR_PATTERN.test(entry.accent) &&
    typeof entry.surface === 'string' &&
    COLOR_PATTERN.test(entry.surface)
  );
}
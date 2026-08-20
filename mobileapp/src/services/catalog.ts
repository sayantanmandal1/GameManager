import { API_URL } from '../config';
import type { GameDefinition } from '../types';

interface CatalogEntry {
  key: string;
  name: string;
  mark: string;
  description: string;
  route: string;
  accent: string;
  surface: string;
}

const ROUTE_PATTERN = /^\/games\/[a-z0-9/-]+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export async function getGameCatalog(signal?: AbortSignal): Promise<GameDefinition[]> {
  const response = await fetch(`${API_URL}/games/catalog`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Invalid game catalog');
  const candidate = payload as { games?: unknown; total?: unknown };
  if (!Array.isArray(candidate.games) || candidate.games.length !== 33 || candidate.total !== 33) {
    throw new Error('Invalid game catalog');
  }

  const entries = candidate.games.filter(isCatalogEntry);
  if (entries.length !== 33 || new Set(entries.map((entry) => entry.key)).size !== 33) {
    throw new Error('Invalid game catalog');
  }
  return entries.map((entry) => ({
    id: entry.key,
    title: entry.name,
    mark: entry.mark,
    description: entry.description,
    route: entry.route,
    accent: entry.accent,
    surface: entry.surface,
  }));
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CatalogEntry>;
  return (
    typeof entry.key === 'string' &&
    /^[a-z0-9-]{1,32}$/.test(entry.key) &&
    typeof entry.name === 'string' &&
    entry.name.length > 0 &&
    entry.name.length <= 40 &&
    typeof entry.mark === 'string' &&
    entry.mark.length > 0 &&
    entry.mark.length <= 4 &&
    typeof entry.description === 'string' &&
    entry.description.length <= 160 &&
    typeof entry.route === 'string' &&
    ROUTE_PATTERN.test(entry.route) &&
    typeof entry.accent === 'string' &&
    COLOR_PATTERN.test(entry.accent) &&
    typeof entry.surface === 'string' &&
    COLOR_PATTERN.test(entry.surface)
  );
}
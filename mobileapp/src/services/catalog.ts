import { API_URL } from '../config';
import type { GameCategory, GameDefinition } from '../types';

const REQUEST_TIMEOUT_MS = 15_000;
const CATEGORIES = new Set<GameCategory>(['board', 'cards', 'party', 'strategy', 'race', 'puzzle']);

export async function loadGameCatalog(): Promise<GameDefinition[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/games/catalog`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length !== 101 || !payload.every(isGameDefinition)) {
      throw new Error('The server returned an invalid game catalog.');
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The game catalog took too long to load.');
    }
    if (error instanceof Error) throw error;
    throw new Error('Unable to load the game catalog.');
  } finally {
    clearTimeout(timeout);
  }
}

function isGameDefinition(value: unknown): value is GameDefinition {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<GameDefinition>;
  return (
    typeof game.key === 'string' &&
    /^[a-z0-9-]{2,64}$/.test(game.key) &&
    typeof game.name === 'string' &&
    game.name.length >= 2 &&
    game.name.length <= 80 &&
    typeof game.gameType === 'string' &&
    typeof game.family === 'string' &&
    typeof game.category === 'string' &&
    CATEGORIES.has(game.category as GameCategory) &&
    typeof game.mark === 'string' &&
    game.mark.length <= 4 &&
    typeof game.description === 'string' &&
    game.description.length <= 180 &&
    typeof game.route === 'string' &&
    /^\/games(?:\/[a-z0-9-]+)*(?:\?[a-zA-Z0-9=&_-]+)?$/.test(game.route) &&
    Number.isInteger(game.minPlayers) &&
    Number.isInteger(game.maxPlayers) &&
    game.minPlayers! >= 1 &&
    game.maxPlayers! >= game.minPlayers! &&
    game.maxPlayers! <= 8 &&
    typeof game.accent === 'string' &&
    /^#[0-9a-f]{6}$/i.test(game.accent) &&
    typeof game.surface === 'string' &&
    /^#[0-9a-f]{6}$/i.test(game.surface)
  );
}

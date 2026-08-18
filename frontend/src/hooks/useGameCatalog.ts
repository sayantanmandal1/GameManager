'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { GameCatalogEntry } from '@/shared';

let cachedCatalog: readonly GameCatalogEntry[] | null = null;
let catalogRequest: Promise<readonly GameCatalogEntry[]> | null = null;

export function useGameCatalog(): {
  games: readonly GameCatalogEntry[];
  isLoading: boolean;
  error: string | null;
} {
  const [games, setGames] = useState<readonly GameCatalogEntry[]>(cachedCatalog ?? []);
  const [isLoading, setIsLoading] = useState(!cachedCatalog);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedCatalog) return;
    let active = true;
    catalogRequest ??= apiGet<readonly GameCatalogEntry[]>('/games/catalog');
    catalogRequest
      .then((catalog) => {
        cachedCatalog = catalog;
        if (active) {
          setGames(catalog);
          setIsLoading(false);
        }
      })
      .catch((reason: unknown) => {
        catalogRequest = null;
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unable to load games');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { games, isLoading, error };
}

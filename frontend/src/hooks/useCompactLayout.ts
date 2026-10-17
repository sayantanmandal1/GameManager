'use client';

import { useSyncExternalStore } from 'react';

/** Phones in portrait, and short landscape screens such as phones on their side. */
export const COMPACT_LAYOUT_QUERY = '(max-width: 767px), (max-height: 520px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(COMPACT_LAYOUT_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function readCompact(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(COMPACT_LAYOUT_QUERY).matches;
}

/**
 * True on phone-sized viewports. Server rendering and environments without
 * matchMedia (tests) use the desktop layout.
 */
export function useCompactLayout(): boolean {
  return useSyncExternalStore(subscribe, readCompact, () => false);
}

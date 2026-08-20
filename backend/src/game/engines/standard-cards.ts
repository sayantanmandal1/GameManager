import { randomInt } from 'node:crypto';
import { CARD_RANKS, CARD_SUITS, StandardCard } from '../../shared';

export function createStandardDeck(): StandardCard[] {
  return CARD_SUITS.flatMap((suit) =>
    CARD_RANKS.map((rank) => ({ id: `c-${suit}-${rank}`, suit, rank })),
  );
}

export function secureShuffle<T>(values: T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
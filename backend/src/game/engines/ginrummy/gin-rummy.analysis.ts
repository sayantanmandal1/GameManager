import type { GinHandAnalysis, GinMeld, StandardCard } from '../../../shared';

export function ginCardValue(card: StandardCard): number {
  if (card.rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function analyzeGinHand(cards: StandardCard[]): GinHandAnalysis {
  const candidates = candidateMelds(cards);
  let bestMelds: GinMeld[] = [];
  let bestDeadwood = cards.reduce((sum, card) => sum + ginCardValue(card), 0);
  const search = (index: number, used: Set<string>, melds: GinMeld[]): void => {
    if (index === candidates.length) {
      const deadwood = cards.filter((card) => !used.has(card.id));
      const value = deadwood.reduce((sum, card) => sum + ginCardValue(card), 0);
      if (value < bestDeadwood) { bestDeadwood = value; bestMelds = melds.map(cloneMeld); }
      return;
    }
    search(index + 1, used, melds);
    const candidate = candidates[index];
    if (candidate.cards.some((card) => used.has(card.id))) return;
    const nextUsed = new Set(used);
    candidate.cards.forEach((card) => nextUsed.add(card.id));
    search(index + 1, nextUsed, [...melds, candidate]);
  };
  search(0, new Set(), []);
  const used = new Set(bestMelds.flatMap((meld) => meld.cards.map((card) => card.id)));
  return {
    melds: bestMelds,
    deadwood: cards.filter((card) => !used.has(card.id)).map((card) => ({ ...card })),
    deadwoodValue: bestDeadwood,
  };
}

export function deadwoodAfterLayoff(cards: StandardCard[], knockerMelds: GinMeld[]): number {
  let best = cards.reduce((sum, card) => sum + ginCardValue(card), 0);
  const search = (remaining: StandardCard[], melds: GinMeld[], deadwood: number): void => {
    if (remaining.length === 0) { best = Math.min(best, deadwood); return; }
    if (deadwood >= best) return;
    const [card, ...rest] = remaining;
    search(rest, melds, deadwood + ginCardValue(card));
    melds.forEach((meld, index) => {
      if (!canLayOff(card, meld)) return;
      const nextMelds = melds.map(cloneMeld);
      nextMelds[index].cards.push({ ...card });
      nextMelds[index].cards.sort((left, right) => rankValue(left) - rankValue(right));
      search(rest, nextMelds, deadwood);
    });
  };
  search(cards, knockerMelds.map(cloneMeld), 0);
  return best;
}

function candidateMelds(cards: StandardCard[]): GinMeld[] {
  const melds: GinMeld[] = [];
  const byRank = new Map<string, StandardCard[]>();
  const bySuit = new Map<string, StandardCard[]>();
  cards.forEach((card) => {
    byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
    bySuit.set(card.suit, [...(bySuit.get(card.suit) ?? []), card]);
  });
  for (const rankCards of byRank.values()) {
    if (rankCards.length >= 3) melds.push(...combinations(rankCards, 3).map((set) => ({ type: 'set' as const, cards: set })));
    if (rankCards.length === 4) melds.push({ type: 'set', cards: [...rankCards] });
  }
  for (const suitCards of bySuit.values()) {
    const sorted = [...suitCards].sort((left, right) => rankValue(left) - rankValue(right));
    for (let start = 0; start < sorted.length; start += 1) {
      for (let end = start + 2; end < sorted.length; end += 1) {
        const run = sorted.slice(start, end + 1);
        if (run.every((card, index) => index === 0 || rankValue(card) === rankValue(run[index - 1]) + 1)) melds.push({ type: 'run', cards: run });
      }
    }
  }
  return melds;
}

function combinations<T>(values: T[], size: number): T[][] {
  if (size === 0) return [[]];
  return values.flatMap((value, index) => combinations(values.slice(index + 1), size - 1).map((rest) => [value, ...rest]));
}

function canLayOff(card: StandardCard, meld: GinMeld): boolean {
  if (meld.type === 'set') return meld.cards.length < 4 && meld.cards[0].rank === card.rank;
  if (meld.cards[0].suit !== card.suit) return false;
  const values = meld.cards.map(rankValue);
  return rankValue(card) === Math.min(...values) - 1 || rankValue(card) === Math.max(...values) + 1;
}

function rankValue(card: StandardCard): number {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return ranks.indexOf(card.rank) + 1;
}

function cloneMeld(meld: GinMeld): GinMeld {
  return { type: meld.type, cards: meld.cards.map((card) => ({ ...card })) };
}
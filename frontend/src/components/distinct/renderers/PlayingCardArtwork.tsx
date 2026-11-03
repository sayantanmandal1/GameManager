import type { StandardCard } from '@/shared';

const SUIT_PATHS: Record<StandardCard['suit'], string> = {
  hearts: 'M50 91C39 78 7 56 7 32C7 8 36 2 50 24C64 2 93 8 93 32C93 56 61 78 50 91Z',
  diamonds: 'M50 3L87 50L50 97L13 50Z',
  clubs: 'M43 69C21 88 1 66 12 49C18 40 28 39 36 43C15 20 34 3 50 5C68 3 85 23 64 43C85 31 105 53 89 71C81 81 65 79 57 69L64 95H36Z',
  spades: 'M50 3C39 19 7 39 7 61C7 85 36 89 44 69L36 95H64L56 69C64 89 93 85 93 61C93 39 61 19 50 3Z',
};

export function SuitSymbol({ suit, className = '' }: Readonly<{
  suit: StandardCard['suit'];
  className?: string;
}>) {
  return <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false"><path fill="currentColor" d={SUIT_PATHS[suit]} /></svg>;
}

type Pip = readonly [number, number];
const PIPS: Readonly<Record<string, readonly Pip[]>> = {
  A: [[50, 75]],
  '2': [[50, 38], [50, 112]],
  '3': [[50, 38], [50, 75], [50, 112]],
  '4': [[32, 38], [68, 38], [32, 112], [68, 112]],
  '5': [[32, 38], [68, 38], [50, 75], [32, 112], [68, 112]],
  '6': [[32, 38], [68, 38], [32, 75], [68, 75], [32, 112], [68, 112]],
  '7': [[32, 38], [68, 38], [50, 56], [32, 75], [68, 75], [32, 112], [68, 112]],
  '8': [[32, 35], [68, 35], [32, 61], [68, 61], [32, 89], [68, 89], [32, 115], [68, 115]],
  '9': [[32, 35], [68, 35], [32, 61], [68, 61], [50, 75], [32, 89], [68, 89], [32, 115], [68, 115]],
  '10': [[32, 35], [68, 35], [50, 48], [32, 61], [68, 61], [32, 89], [68, 89], [50, 102], [32, 115], [68, 115]],
};

function Suit({ suit, x, y, size, inverted = false }: Readonly<{
  suit: StandardCard['suit']; x: number; y: number; size: number; inverted?: boolean;
}>) {
  return (
    <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 100 100">
      <path d={SUIT_PATHS[suit]} fill="currentColor" transform={inverted ? 'rotate(180 50 50)' : undefined} />
    </svg>
  );
}

function Court({ rank, suit }: Readonly<{ rank: string; suit: StandardCard['suit'] }>) {
  const queen = rank === 'Q';
  return (
    <g data-card-court={rank}>
      <rect x="24" y="24" width="52" height="102" rx="2" fill="#eee5c9" stroke="#ad8b42" strokeWidth="0.8" />
      {[false, true].map((reverse) => (
        <g key={String(reverse)} transform={reverse ? 'rotate(180 50 75)' : undefined}>
          <path d="M25 75L30 59L47 53L64 58L75 75Z" fill="#234f70" stroke="#162b40" strokeWidth="0.7" />
          <path d="M31 75L41 58L51 75M51 75L61 59L70 75" fill="#b42d39" stroke="#d4ae53" strokeWidth="2" />
          <path d="M38 43Q35 30 48 30Q64 29 62 45L57 53L46 55L40 50Z" fill="#eac8a0" stroke="#63452b" strokeWidth="0.8" />
          <path d="M38 41Q35 31 45 30L61 32L64 46L58 43L57 35L42 36L41 48L37 53Z" fill="#342b25" />
          <path d={queen ? 'M37 33L35 25L43 29L49 24L55 29L63 25L61 34Z' : rank === 'K' ? 'M37 33L35 24L43 28L49 23L55 28L63 24L61 33Z' : 'M35 32Q47 20 63 31L62 35L37 35Z'} fill="#d5ac4a" stroke="#63452b" strokeWidth="0.8" />
          <path d="M47 41H49M55 41H57M53 42L52 46H55M49 49Q53 51 56 48" fill="none" stroke="#63452b" strokeWidth="0.9" />
          {rank === 'K' && <path d="M44 48L47 57L55 56L59 48L53 51Z" fill="#63452b" />}
          {queen ? <path d="M29 70V45M29 44L25 40L29 36L33 40Z" fill="#b42d39" stroke="#ad8b42" strokeWidth="1.5" /> : <path d="M69 70V37L72 29L74 37L72 70M66 54H75" fill="#f3f0da" stroke="#ad8b42" strokeWidth="1.3" />}
          <Suit suit={suit} x={32} y={56} size={9} />
        </g>
      ))}
      <path d="M25 75H75" stroke="#ad8b42" strokeWidth="1" />
    </g>
  );
}

export function PlayingCardArtwork({ card }: Readonly<{ card: StandardCard }>) {
  const pips = PIPS[card.rank];
  return (
    <svg viewBox="0 0 100 150" className="block h-full w-full" aria-hidden="true" focusable="false" data-card-artwork={`${card.rank}-${card.suit}`}>
      <rect x="3" y="3" width="94" height="144" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.07" />
      {[false, true].map((reverse) => (
        <g key={String(reverse)} transform={reverse ? 'rotate(180 50 75)' : undefined}>
          <text x="13" y="21" textAnchor="middle" fill="currentColor" fontFamily="Georgia, serif" fontSize={card.rank === '10' ? 17 : 19} fontWeight="bold">{card.rank}</text>
          <Suit suit={card.suit} x={13} y={31} size={12} />
        </g>
      ))}
      {pips ? pips.map(([x, y], index) => (
        <g key={index} data-card-pip>
          <Suit suit={card.suit} x={x} y={y} size={card.rank === 'A' ? 37 : 17} inverted={y > 75} />
        </g>
      )) : <Court rank={card.rank} suit={card.suit} />}
    </svg>
  );
}

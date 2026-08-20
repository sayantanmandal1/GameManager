import type { DistinctGameKey } from '@/shared';

const EXPANSION_GAME_KEYS = [
  'hearts',
  'spades',
  'gin-rummy',
  'card-war',
  'old-maid',
  'hex',
  'nine-mens-morris',
  'cee-lo',
  'trivia-quiz-bowl',
  'memory-match',
] as const satisfies readonly DistinctGameKey[];

type ExpansionGameKey = (typeof EXPANSION_GAME_KEYS)[number];

export function isExpansionGameKey(gameKey: DistinctGameKey): gameKey is ExpansionGameKey {
  return EXPANSION_GAME_KEYS.includes(gameKey as ExpansionGameKey);
}

export function ExpansionGamePreview({ gameKey }: Readonly<{ gameKey: ExpansionGameKey }>) {
  switch (gameKey) {
    case 'hearts':
      return <HeartsPreview />;
    case 'spades':
      return <SpadesPreview />;
    case 'gin-rummy':
      return <GinRummyPreview />;
    case 'card-war':
      return <CardWarPreview />;
    case 'old-maid':
      return <OldMaidPreview />;
    case 'hex':
      return <HexPreview />;
    case 'nine-mens-morris':
      return <MorrisPreview />;
    case 'cee-lo':
      return <CeeLoPreview />;
    case 'trivia-quiz-bowl':
      return <TriviaPreview />;
    case 'memory-match':
      return <MemoryPreview />;
  }
}

function HeartsPreview() {
  const cards = [
    { key: 'heart', rank: 'A', suit: '♥' },
    { key: 'queen', rank: 'Q', suit: '♠' },
    { key: 'club', rank: '2', suit: '♣' },
  ];
  return <div className="flex aspect-[4/3] w-full max-w-md items-center justify-center gap-2 border border-white/15 bg-[#342024] shadow-2xl">{cards.map((card) => <span key={card.key} className={`flex h-44 w-28 flex-col justify-between border-2 border-[#201b1b] bg-[#f5f1e7] p-4 text-4xl font-black shadow-xl ${card.suit === '♥' ? 'text-[#c64243]' : 'text-[#222420]'}`}><span>{card.rank}</span><span className="self-center">{card.suit}</span></span>)}</div>;
}

function SpadesPreview() {
  return <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center border border-white/15 bg-[#22282a] shadow-2xl"><span className="text-8xl text-[#d8d5ca]">♠</span><div className="mt-6 grid grid-cols-2 gap-x-12 gap-y-3 text-center"><span className="text-sm text-white/45">TEAM 1</span><span className="text-sm text-white/45">TEAM 2</span><strong className="text-3xl">120</strong><strong className="text-3xl">90</strong></div></div>;
}

function GinRummyPreview() {
  const cards = ['3♥', '4♥', '5♥', '7♣', '7♦', '7♠'];
  return <div className="aspect-[4/3] w-full max-w-md border border-white/15 bg-[#193129] p-7 shadow-2xl"><div className="flex justify-center gap-1">{cards.map((face) => <span key={face} className={`flex h-32 w-16 items-start border bg-[#f5f1e7] p-2 text-xl font-black shadow-lg ${face.includes('♥') || face.includes('♦') ? 'text-[#c64243]' : 'text-[#242722]'}`}>{face}</span>)}</div><p className="mt-6 text-center text-sm font-bold text-[#77cfa8]">TWO MELDS · 6 DEADWOOD</p></div>;
}

function CardWarPreview() {
  return <div className="grid aspect-[4/3] w-full max-w-md grid-cols-2 place-items-center gap-8 border border-white/15 bg-[#34271c] p-8 shadow-2xl"><span className="flex h-48 w-28 items-start border-2 border-[#241c14] bg-[#f5f1e7] p-4 text-5xl font-black text-[#22231f] shadow-xl">K</span><span className="flex h-48 w-28 items-start border-2 border-[#241c14] bg-[#f5f1e7] p-4 text-5xl font-black text-[#c64243] shadow-xl">9</span><strong className="col-span-2 text-[#f0b25d]">BATTLE 12 · POT 2</strong></div>;
}

function OldMaidPreview() {
  return <div className="relative aspect-square w-full max-w-sm border border-white/15 bg-[#34212d] shadow-2xl"><span className="absolute left-[12%] top-[28%] flex h-44 w-28 items-center justify-center border-2 border-[#1e171b] bg-[#512b40] text-5xl font-black">?</span><span className="absolute left-[36%] top-[20%] flex h-44 w-28 flex-col justify-between border-2 border-[#1e171b] bg-[#f5f1e7] p-4 text-4xl font-black text-[#c64243] shadow-xl"><span>Q</span><span className="self-center">♥</span></span><span className="absolute left-[60%] top-[28%] flex h-44 w-28 items-center justify-center border-2 border-[#1e171b] bg-[#512b40] text-5xl font-black">?</span></div>;
}

function HexPreview() {
  const cells = Array.from({ length: 25 }, (_, cell) => ({ key: `hex-preview-${cell}`, cell }));
  return <div className="grid aspect-square w-full max-w-sm grid-cols-5 gap-1 border border-white/15 bg-[#183038] p-8 shadow-2xl">{cells.map(({ key, cell }) => { const row = Math.floor(cell / 5); return <span key={key} className={`aspect-square border border-black/30 ${hexCellTone(cell)}`} style={{ transform: `translateX(${row * 0.35}rem) rotate(30deg)`, clipPath: 'polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)' }} />; })}</div>;
}

function hexCellTone(cell: number): string {
  if ([2, 7, 12, 17, 22].includes(cell)) return 'bg-[#f16b76]';
  if ([10, 11].includes(cell)) return 'bg-[#6fc6d1]';
  return 'bg-[#eee9da]';
}

function MorrisPreview() {
  const stones = [
    { key: 'a', left: '8%', top: '8%', light: true },
    { key: 'b', left: '50%', top: '8%', light: false },
    { key: 'c', left: '92%', top: '50%', light: true },
    { key: 'd', left: '25%', top: '75%', light: false },
  ];
  return <div className="relative aspect-square w-full max-w-sm border-8 border-[#30291d] bg-[#d9c18e] shadow-2xl"><div className="absolute inset-[8%] border-4 border-[#493b26]" /><div className="absolute inset-[25%] border-4 border-[#493b26]" /><div className="absolute inset-[40%] border-4 border-[#493b26]" />{stones.map((stone) => <span key={stone.key} className={`absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg ${stone.light ? 'border-[#29241a] bg-[#f4eedf]' : 'border-[#eee2c8] bg-[#29251e]'}`} style={{ left: stone.left, top: stone.top }} />)}</div>;
}

function CeeLoPreview() {
  const dice = [{ key: 'four', value: 4 }, { key: 'five', value: 5 }, { key: 'six', value: 6 }];
  return <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center border border-white/15 bg-[#30301b] shadow-2xl"><p className="mb-6 text-xs font-bold text-white/45">BANKER QUALIFIES</p><div className="flex gap-3">{dice.map((die) => <span key={die.key} className="flex h-20 w-20 items-center justify-center bg-[#f5f1e7] text-4xl font-black text-[#29281d] shadow-lg">{die.value}</span>)}</div><strong className="mt-6 text-[#f3d45a]">AUTOMATIC WIN</strong></div>;
}

function TriviaPreview() {
  const options = ['A · Square', 'B · Circle', 'C · Triangle', 'D · Pentagon'];
  return <div className="aspect-[4/3] w-full max-w-md border border-white/15 bg-[#1b2d3a] p-7 shadow-2xl"><p className="text-xs font-bold text-[#75b9f0]">QUESTION 4 OF 10</p><h3 className="mt-4 text-xl font-black">Which shape has exactly three sides?</h3><div className="mt-6 grid grid-cols-2 gap-3">{options.map((option) => <span key={option} className={`border p-3 text-sm font-bold ${option.startsWith('C') ? 'border-[#77cfa8] bg-[#1d4b38]' : 'border-white/15 bg-black/15'}`}>{option}</span>)}</div></div>;
}

function MemoryPreview() {
  const tiles = [
    { key: 'one', symbol: 'A' }, { key: 'two', symbol: '?' }, { key: 'three', symbol: 'K' },
    { key: 'four', symbol: '?' }, { key: 'five', symbol: '?' }, { key: 'six', symbol: 'A' },
    { key: 'seven', symbol: '?' }, { key: 'eight', symbol: 'K' }, { key: 'nine', symbol: '?' },
    { key: 'ten', symbol: '?' }, { key: 'eleven', symbol: '?' }, { key: 'twelve', symbol: '?' },
  ];
  return <div className="grid aspect-[4/3] w-full max-w-md grid-cols-4 gap-2 border border-white/15 bg-[#35251f] p-7 shadow-2xl">{tiles.map((tile) => <span key={tile.key} className={`flex aspect-square items-center justify-center border text-xl font-black ${tile.symbol === '?' ? 'border-white/15 bg-[#503127] text-[#f28f62]' : 'border-[#77cfa8] bg-[#f0e4d5] text-[#35251f]'}`}>{tile.symbol}</span>)}</div>;
}
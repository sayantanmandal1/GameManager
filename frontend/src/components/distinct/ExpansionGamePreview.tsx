import type { CardSuit, DistinctGameKey, MonopolyPlayer } from '@/shared';
import { CARD_RANKS } from '@/shared';
import { CardBack, CardFace } from './renderers/CardFace';
import { MonopolyBoard } from './renderers/MonopolyBoard';
import { buildMonopolyCanonicalPreviewBoard } from './renderers/monopolyBoardData';

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
  'contract-bridge',
  'bourre',
  'bluff',
  'sevens',
  'ninety-nine',
  'euchre',
  'whist',
  'oh-hell',
  'president',
  'slapjack',
  'spoons',
  'monopoly',
  'wrongway',
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
    case 'contract-bridge':
      return <BridgePreview />;
    case 'bourre':
      return <CardMechanicPreview title="BOURRÉ" badge="TRUMP · POT 5" cards={['A♥', 'K♥', '10♥', '7♣']} accent="#f0c96a" />;
    case 'bluff':
      return <CardMechanicPreview title="BLUFF" badge="THREE 8s · TRUE?" cards={['?', '?', '?', '8♠']} accent="#e68aa6" hidden />;
    case 'sevens':
      return <CardMechanicPreview title="SEVENS" badge="BUILD BOTH WAYS" cards={['6♠', '7♠', '8♠', '7♥']} accent="#75c9a3" />;
    case 'ninety-nine':
      return <CardMechanicPreview title="NINETY-NINE" badge="TOTAL 87" cards={['9♦', '10♣', 'K♥', '4♠']} accent="#ee8364" />;
    case 'euchre':
      return <CardMechanicPreview title="EUCHRE" badge="HEARTS TRUMP" cards={['J♥', 'J♦', 'A♥', '9♣']} accent="#e8c663" />;
    case 'whist':
      return <CardMechanicPreview title="WHIST" badge="13 TRICKS" cards={['A♣', 'Q♣', '8♣', 'K♦']} accent="#86c5b2" />;
    case 'oh-hell':
      return <CardMechanicPreview title="OH HELL" badge="BID 3 · TOOK 3" cards={['A♠', '9♠', '5♥', '2♦']} accent="#ef8c6d" />;
    case 'president':
      return <CardMechanicPreview title="PRESIDENT" badge="PAIR OF KINGS" cards={['K♠', 'K♥', 'Q♣', '2♦']} accent="#efcf69" />;
    case 'slapjack':
      return <CardMechanicPreview title="SLAPJACK" badge="SLAP!" cards={['J♥', '?', '?', '?']} accent="#f07b67" hidden />;
    case 'spoons':
      return <CardMechanicPreview title="SPOONS" badge="FOUR OF A KIND" cards={['7♠', '7♥', '7♣', '7♦']} accent="#d9e2e0" />;
    case 'monopoly':
      return <MonopolyPreview />;
    case 'wrongway':
      return <WrongwayPreview />;
  }
}

function HeartsPreview() {
  const cards = [
    'A♥', 'Q♠', '2♣',
  ];
  return <div className="flex aspect-[4/3] w-full max-w-md items-center justify-center gap-2 border border-white/15 bg-[#342024] shadow-2xl">{cards.map((card) => <PreviewCard key={card} card={card} className="!w-[25%]" />)}</div>;
}

function SpadesPreview() {
  return <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center border border-white/15 bg-[#22282a] shadow-2xl"><span className="text-8xl text-[#d8d5ca]">♠</span><div className="mt-6 grid grid-cols-2 gap-x-12 gap-y-3 text-center"><span className="text-sm text-white/45">TEAM 1</span><span className="text-sm text-white/45">TEAM 2</span><strong className="text-3xl">120</strong><strong className="text-3xl">90</strong></div></div>;
}

function GinRummyPreview() {
  const cards = ['3♥', '4♥', '5♥', '7♣', '7♦', '7♠'];
  return <div className="aspect-[4/3] w-full max-w-md border border-white/15 bg-[#193129] p-7 shadow-2xl"><div className="flex justify-center gap-1">{cards.map((face) => <PreviewCard key={face} card={face} className="!w-[15%]" />)}</div><p className="mt-6 text-center text-sm font-bold text-[#77cfa8]">TWO MELDS · 6 DEADWOOD</p></div>;
}

function CardWarPreview() {
  return <div className="grid aspect-[4/3] w-full max-w-md grid-cols-2 place-items-center gap-8 border border-white/15 bg-[#34271c] p-8 shadow-2xl"><PreviewCard card="K♠" className="!w-full max-w-28" /><PreviewCard card="9♥" className="!w-full max-w-28" /><strong className="col-span-2 text-[#f0b25d]">BATTLE 12 · POT 2</strong></div>;
}

function OldMaidPreview() {
  return <div className="relative aspect-square w-full max-w-sm border border-white/15 bg-[#34212d] shadow-2xl"><PreviewBack className="absolute left-[12%] top-[28%] !w-[28%]" /><PreviewCard card="Q♥" className="absolute left-[36%] top-[20%] !w-[28%]" /><PreviewBack className="absolute left-[60%] top-[28%] !w-[28%]" /></div>;
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

function BridgePreview() {
  const hand = ['Q♠', '9♠', 'A♥', 'K♣', '7♦'];
  return (
    <div aria-label="Contract Bridge table preview" className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border-4 border-[#2b2114] bg-[#17634d] shadow-2xl">
      <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-xs font-bold">NORTH · 13</span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 rounded-full bg-black/45 px-3 py-1 text-xs font-bold">WEST · 13</span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 rounded-full bg-black/45 px-3 py-1 text-xs font-bold">EAST · 13</span>
      <div className="absolute left-1/2 top-[38%] flex -translate-x-1/2 gap-1">
        {['7♠', 'A♠', 'J♠', '4♠'].map((card) => <PreviewCard key={card} card={card} small />)}
      </div>
      <div className="absolute inset-x-2 bottom-2 flex items-end justify-center">
        {hand.map((card, index) => <PreviewCard key={card} card={card} className={index === 0 ? '' : '-ml-3'} />)}
      </div>
      <span className="absolute bottom-[5.7rem] left-1/2 -translate-x-1/2 rounded-full bg-[#ead17e] px-3 py-1 text-[11px] font-black text-[#1d2a24]">3NT · NET +120</span>
    </div>
  );
}

function MonopolyPreview() {
  const board = buildMonopolyCanonicalPreviewBoard();
  board[16].ownerId = 'preview-top-hat';
  board[16].buildingCount = 2;
  board[18].ownerId = 'preview-top-hat';
  board[19].ownerId = 'preview-top-hat';
  board[24].ownerId = 'preview-racecar';
  board[37].ownerId = 'preview-battleship';
  board[39].ownerId = 'preview-battleship';
  board[39].buildingCount = 5;

  const players: MonopolyPlayer[] = [
    previewMonopolyPlayer('preview-top-hat', 'Ava', 'top_hat', '#e43b36', 16, [16, 18, 19]),
    previewMonopolyPlayer('preview-racecar', 'Max', 'racecar', '#2786df', 24, [24]),
    previewMonopolyPlayer('preview-battleship', 'Rio', 'battleship', '#21a65a', 39, [37, 39]),
  ];

  return (
    <div role="group" aria-label="Monopoly board preview" className="w-full max-w-[42rem] p-1">
      <MonopolyBoard
        board={board}
        players={players}
        mode="preview"
        showAttribution
        lastRoll={null}
      />
    </div>
  );
}

function previewMonopolyPlayer(
  id: string,
  name: string,
  originalToken: string,
  originalColor: string,
  position: number,
  properties: number[],
): MonopolyPlayer {
  return {
    id,
    name,
    isBot: false,
    originalToken,
    originalColor,
    position,
    cash: 1500,
    inJail: false,
    jailTurns: 0,
    jailCards: 0,
    bankrupt: false,
    bankruptOrder: null,
    properties,
  };
}

function WrongwayPreview() {
  return (
    <div role="group" aria-label="Wrongway board preview" className="w-full max-w-md rounded-md border border-[#203655] bg-[#050b1e] p-3 shadow-2xl">
      <div className="relative mx-auto aspect-square w-full max-w-[20rem] overflow-hidden rounded-md border border-[#2a4467] bg-[#08142d]">
        <div className="grid h-full w-full grid-cols-9 grid-rows-9">
          {Array.from({ length: 81 }, (_, index) => {
            const row = Math.floor(index / 9);
            const column = index % 9;
            const tone = (row + column) % 2 === 0 ? 'bg-[#0b1b3b]' : 'bg-[#08142d]';
            const redPawn = row === 8 && column === 4;
            const bluePawn = row === 0 && column === 4;
            return (
              <span key={`wrongway-preview-cell-${index}`} className={`relative border border-[#314869] ${tone}`}>
                {redPawn && (
                  <span
                    className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ff9ca3] bg-[#ff4e59]"
                    style={{ boxShadow: '0 0 8px rgba(255, 78, 89, 0.8)' }}
                  />
                )}
                {bluePawn && (
                  <span
                    className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#9ac3ff] bg-[#4d9cff]"
                    style={{ boxShadow: '0 0 8px rgba(77, 156, 255, 0.8)' }}
                  />
                )}
              </span>
            );
          })}
        </div>
        <span
          className="pointer-events-none absolute rounded-[2px] border border-[#ff9ca3]/70 bg-[#ff4e59]"
          style={{ left: '22.222%', top: 'calc(33.333% - 1.1%)', width: '22.222%', height: '2.2%', boxShadow: '0 0 8px rgba(255, 78, 89, 0.78)' }}
        />
        <span
          className="pointer-events-none absolute rounded-[2px] border border-[#adc7ff]/70 bg-[#4d9cff]"
          style={{ left: 'calc(66.666% - 1.1%)', top: '55.555%', width: '2.2%', height: '22.222%', boxShadow: '0 0 8px rgba(77, 156, 255, 0.75)' }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-[#2b3f66] bg-[#08142d] px-2.5 py-2 text-xs font-semibold text-[#cfe0ff]">
        <span className="rounded-sm border border-[#675cff] bg-[#675cff] px-2 py-1 text-white">MOVE</span>
        <span className="rounded-sm border border-[#675cff] bg-[#675cff]/25 px-2 py-1">WALL · H</span>
      </div>
    </div>
  );
}

function CardMechanicPreview({ title, badge, cards, accent, hidden = false }: Readonly<{
  title: string;
  badge: string;
  cards: string[];
  accent: string;
  hidden?: boolean;
}>) {
  return (
    <div aria-label={`${title} game preview`} className="flex aspect-[4/3] w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-[#17352c] p-6 shadow-2xl">
      <p className="text-xs font-black tracking-[0.18em]" style={{ color: accent }}>{title}</p>
      <div className="mt-5 flex items-end justify-center">
        {cards.map((card, index) => (
          hidden && card === '?'
            ? <PreviewBack key={`${card}-${index}`} className={index === 0 ? '' : '-ml-3'} />
            : <PreviewCard key={`${card}-${index}`} card={card} className={index === 0 ? '' : '-ml-3'} />
        ))}
      </div>
      <span className="mt-5 rounded-full border border-white/15 bg-black/25 px-4 py-1 text-xs font-bold">{badge}</span>
    </div>
  );
}

function PreviewCard({ card, small = false, className = '' }: Readonly<{
  card: string;
  small?: boolean;
  className?: string;
}>) {
  const suitBySymbol: Record<string, CardSuit> = { '♣': 'clubs', '♦': 'diamonds', '♥': 'hearts', '♠': 'spades' };
  const suit = suitBySymbol[card.slice(-1)];
  const rank = CARD_RANKS.find((value) => value === card.slice(0, -1));
  if (!suit || !rank) throw new Error(`Invalid preview card: ${card}`);
  return <span className={`block ${small ? 'w-10' : 'w-16'} shrink-0 ${className}`}><CardFace card={{ id: card, rank, suit }} size="fluid" /></span>;
}

function PreviewBack({ className = '' }: Readonly<{ className?: string }>) {
  return <span className={`block w-16 shrink-0 ${className}`}><CardBack className="!h-auto !w-full aspect-[2/3]" /></span>;
}
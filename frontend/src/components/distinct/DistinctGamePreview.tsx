import type { DistinctGameKey } from '@/shared';
import { ExpansionGamePreview, isExpansionGameKey } from './ExpansionGamePreview';

export function DistinctGamePreview({ gameKey }: Readonly<{ gameKey: DistinctGameKey }>) {
  if (isExpansionGameKey(gameKey)) return <ExpansionGamePreview gameKey={gameKey} />;
  if (gameKey === 'reversi') {
    return (
      <div className="grid aspect-square w-full max-w-md grid-cols-8 overflow-hidden rounded-lg border-4 border-[#17251f] bg-[#329365] shadow-2xl">
        {Array.from({ length: 64 }, (_, cell) => (
          <div key={cell} className="flex items-center justify-center border border-[#1f6845]">
            {[27, 36].includes(cell) && <span className="h-[70%] w-[70%] rounded-full bg-[#f4f1e8]" />}
            {[28, 35].includes(cell) && <span className="h-[70%] w-[70%] rounded-full bg-[#101512]" />}
          </div>
        ))}
      </div>
    );
  }
  if (gameKey === 'checkers') {
    return (
      <div className="grid aspect-square w-full max-w-md grid-cols-8 overflow-hidden rounded-lg border-4 border-[#261715] shadow-2xl">
        {Array.from({ length: 64 }, (_, cell) => {
          const row = Math.floor(cell / 8);
          const dark = (row + (cell % 8)) % 2 === 1;
          const piece = dark && (row < 3 || row > 4);
          return <div key={cell} className={`flex items-center justify-center ${dark ? 'bg-[#6d3f35]' : 'bg-[#ead8bb]'}`}>{piece && <span className={`h-[65%] w-[65%] rounded-full border-4 ${row < 3 ? 'border-[#6d7380] bg-[#17191d]' : 'border-[#ff9488] bg-[#c43f36]'}`} />}</div>;
        })}
      </div>
    );
  }
  if (gameKey === 'mancala') {
    return (
      <div className="grid w-full max-w-xl grid-cols-[4rem_repeat(6,1fr)_4rem] grid-rows-2 gap-2 rounded-lg bg-[#5b3c25] p-4 shadow-2xl">
        <div className="row-span-2 rounded-full bg-[#be8150]" />
        {Array.from({ length: 12 }, (_, pit) => <div key={pit} className="aspect-square rounded-full bg-[#d8a46d] shadow-inner" />)}
        <div className="row-span-2 rounded-full bg-[#d29a66]" />
      </div>
    );
  }
  if (gameKey === 'dotsandboxes') {
    return (
      <div className="grid aspect-square w-full max-w-md grid-cols-5 place-items-center rounded-lg bg-[#efe9da] p-7 shadow-2xl">
        {Array.from({ length: 25 }, (_, dot) => <span key={dot} className="h-4 w-4 rounded-full bg-[#18201c]" />)}
      </div>
    );
  }
  if (gameKey === 'grid-salvo') {
    return <div className="grid aspect-square w-full max-w-md grid-cols-10 overflow-hidden border-4 border-[#102832] bg-[#123844] shadow-2xl">{Array.from({ length: 100 }, (_, cell) => <span key={cell} className={`border border-white/10 ${[11, 12, 13, 14, 15, 27, 37, 47, 66, 67, 68].includes(cell) ? 'bg-[#58c7d9]' : cell === 37 ? 'bg-[#ff684d]' : ''}`} />)}</div>;
  }
  if (gameKey === 'peg-codebreaker') {
    const colors = ['#ef5b54', '#5aa9e6', '#67c587', '#f3cf55', '#ef9948', '#b986d7'];
    return <div className="w-full max-w-sm border-4 border-[#241c13] bg-[#d9b777] p-6 shadow-2xl"><div className="space-y-4">{Array.from({ length: 6 }, (_, row) => <div key={row} className="flex items-center justify-between"><div className="flex gap-3">{Array.from({ length: 4 }, (_, peg) => <span key={peg} className="h-9 w-9 rounded-full border-2 border-black/20" style={{ backgroundColor: colors[(row + peg) % colors.length] }} />)}</div><div className="grid grid-cols-2 gap-1">{Array.from({ length: 4 }, (_, clue) => <span key={clue} className={`h-2.5 w-2.5 rounded-full ${clue < row % 4 ? 'bg-[#201b16]' : 'bg-[#f4eee0]'}`} />)}</div></div>)}</div></div>;
  }
  if (gameKey === 'hangman') {
    return <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center border border-white/15 bg-[#e9e3ce] p-8 text-[#292824] shadow-2xl"><div className="mb-8 h-40 w-32 border-l-8 border-t-8 border-[#292824] after:ml-[7.5rem] after:block after:h-12 after:w-1 after:bg-[#292824]" /><p className="font-mono text-4xl font-black tracking-[0.2em]">_ A _ E</p><p className="mt-5 text-sm font-bold">3 / 8 misses</p></div>;
  }
  if (gameKey === 'go-fish') {
    return <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden border border-white/15 bg-[#276650] shadow-2xl">{['A', 'A', 'A', 'A'].map((rank, index) => <span key={index} className="absolute flex h-40 w-24 items-start border-2 border-[#1e241f] bg-[#f5f1e7] p-3 text-3xl font-black text-[#b83f39] shadow-xl" style={{ left: `${18 + index * 16}%`, top: `${20 + Math.abs(index - 1.5) * 6}%`, transform: `rotate(${(index - 1.5) * 8}deg)` }}>{rank}</span>)}</div>;
  }
  if (gameKey === 'crazy-eights') {
    return <div className="flex aspect-square w-full max-w-sm items-center justify-center border border-white/15 bg-[#351f21] shadow-2xl"><div className="flex h-64 w-40 flex-col justify-between border-4 border-[#1f201c] bg-[#f5f1e7] p-5 text-[#c63f37] shadow-2xl"><span className="text-5xl font-black">8</span><span className="self-center text-7xl">♥</span><span className="self-end rotate-180 text-5xl font-black">8</span></div></div>;
  }
  if (gameKey === 'five-dice-yacht') {
    return <div className="grid aspect-square w-full max-w-sm grid-cols-2 place-items-center gap-4 border border-white/15 bg-[#30301b] p-10 shadow-2xl">{[1, 3, 4, 5].map((die) => <span key={die} className="flex aspect-square w-full items-center justify-center bg-[#f5f1e7] text-6xl font-black text-[#28281b] shadow-lg">{die}</span>)}</div>;
  }
  if (gameKey === 'liars-dice') {
    return <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center border border-white/15 bg-[#302039] shadow-2xl"><div className="h-44 w-44 rounded-b-[5rem] border-4 border-[#d0a96b] bg-[#6d3f30] shadow-xl" /><div className="mt-5 flex gap-3">{[2, 5, 3].map((die, index) => <span key={index} className="flex h-14 w-14 items-center justify-center bg-[#f5f1e7] text-2xl font-black text-[#292329]">{die}</span>)}</div></div>;
  }
  if (gameKey === 'farkle') {
    return <div className="grid aspect-square w-full max-w-sm grid-cols-3 place-items-center gap-3 border border-white/15 bg-[#34251a] p-9 shadow-2xl">{[1, 5, 2, 2, 2, 6].map((die, index) => <span key={index} className={`flex aspect-square w-full items-center justify-center text-4xl font-black shadow-lg ${die === 1 || die === 5 || die === 2 ? 'bg-[#ff9f52] text-[#2b2018]' : 'bg-[#f5f1e7] text-[#29231e]'}`}>{die}</span>)}</div>;
  }
  if (gameKey === 'shut-the-box') {
    return <div className="grid aspect-[3/2] w-full max-w-lg grid-cols-9 gap-1 border-4 border-[#201b14] bg-[#5b3c25] p-5 shadow-2xl">{Array.from({ length: 9 }, (_, index) => <span key={index} className={`flex items-center justify-center border border-[#281f15] text-2xl font-black ${index < 5 ? 'bg-[#d9c39a] text-[#2b2319]' : 'bg-[#2c2118] text-white/20 line-through'}`}>{index + 1}</span>)}</div>;
  }
  if (gameKey === 'draw-dominoes') {
    return <div className="flex aspect-[4/3] w-full max-w-md items-center justify-center gap-2 border border-white/15 bg-[#252a2c] p-6 shadow-2xl">{[[6, 6], [6, 3], [3, 1], [1, 5]].map(([a, b], index) => <span key={index} className="flex h-28 w-14 flex-col items-center justify-around border border-[#171a19] bg-[#f0eee5] text-xl font-black text-[#242725] shadow-lg"><span>{a}</span><span className="h-px w-full bg-black/25" /><span>{b}</span></span>)}</div>;
  }
  return (
    <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-lg border border-white/15 bg-[#f4f1e8] text-[10rem] leading-none text-[#221a15] shadow-2xl">
      {'\u2684'}
    </div>
  );
}
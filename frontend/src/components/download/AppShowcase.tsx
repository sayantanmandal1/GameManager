import Image from 'next/image';
import { FEATURED_APP_GAMES, GAME_COUNT } from '@/lib/gameShowcase';

/**
 * Illustration of the Android app: the game library and a live Monopoly table.
 * Rendered with the app's real colors and layout so screenshots never go stale.
 */
export function AppShowcase({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <div
      role="img"
      aria-label="The GameVerse Android app showing the game library and a live Monopoly table"
      className={`relative mx-auto h-[30rem] w-full max-w-[24rem] sm:h-[34rem] sm:max-w-[28rem] ${className}`}
    >
      <div aria-hidden="true" className="absolute inset-x-8 top-10 bottom-6 rounded-full bg-[radial-gradient(circle,rgba(99,213,164,0.28),transparent_68%)] blur-2xl" />

      {/* Back phone: a live Monopoly table */}
      <PhoneFrame className="absolute right-0 top-6 hidden w-[13.5rem] rotate-[7deg] sm:block">
        <div className="flex h-9 items-center justify-between border-b border-game-border px-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-game-card text-sm text-game-text">×</span>
          <span className="text-center leading-none">
            <span className="block text-[10px] font-black text-[#f4f1e8]">Monopoly</span>
            <span className="block text-[7px] font-black text-[#63d5a4]">LIVE CROSSPLAY</span>
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-game-card text-xs text-game-text">↻</span>
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 pt-2">
          {['$1,500', '$1,320', '$1,640', '$980'].map((cash, index) => (
            <span key={cash} className={`rounded-md px-1 py-1 text-center text-[8px] font-black ${index === 0 ? 'bg-[#f0b55d] text-[#241a10]' : 'bg-white/10 text-white'}`}>{cash}</span>
          ))}
        </div>
        <div className="relative mx-2 mt-2 aspect-square overflow-hidden rounded-md border border-black/40">
          <Image src="/monopoly-classic-us-board.jpg" alt="" fill sizes="200px" className="object-cover" />
        </div>
        <div className="mx-2 mt-2 grid grid-cols-3 gap-1">
          <span className="rounded-md bg-[#f0b55d] py-2 text-center text-[8px] font-black text-[#241a10]">ROLL DICE</span>
          <span className="rounded-md bg-white/10 py-2 text-center text-[8px] font-black text-white">MY DEEDS</span>
          <span className="rounded-md bg-white/10 py-2 text-center text-[8px] font-black text-white">TRADE</span>
        </div>
      </PhoneFrame>

      {/* Front phone: the game library */}
      <PhoneFrame className="absolute left-1/2 top-0 w-[15.5rem] -translate-x-1/2 sm:left-2 sm:translate-x-0 sm:-rotate-[4deg]">
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Image src="/gameverse-mark.svg" alt="" width={22} height={22} />
              <span className="leading-none">
                <span className="block text-[11px] font-semibold text-game-text">GameVerse</span>
                <span className="block text-[7px] font-black text-[#63d5a4]">CROSSPLAY READY</span>
              </span>
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-game-border bg-game-card text-[11px]">🦊</span>
          </div>
          <p className="mt-4 text-lg font-semibold tracking-tight text-game-text">Hello, Alex</p>
          <p className="mt-1 text-[9px] text-game-muted">Pick a table or enter a friend&apos;s room code.</p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-game-border bg-game-card p-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[7px] font-medium tracking-wider text-game-muted">JOIN A ROOM</span>
              <span className="block font-mono text-sm font-medium tracking-wider text-game-text">482913</span>
            </span>
            <span className="rounded-lg bg-game-text px-2.5 py-1.5 text-[9px] font-semibold text-game-bg">Join</span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-xs font-semibold text-game-text">Choose a game</span>
            <span className="text-[8px] font-medium text-game-muted">{GAME_COUNT} games</span>
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 px-3 pb-3">
          {FEATURED_APP_GAMES.slice(0, 6).map((game) => (
            <span key={game.key} className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-game-border bg-game-card p-2">
              <span className="flex items-start justify-between gap-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-[#17201a]" style={{ backgroundColor: game.accent }}>{game.mark}</span>
                <span className="text-right text-[6.5px] font-bold leading-tight text-[#e4e8e0]">{game.players}</span>
              </span>
              <span className="truncate text-[9px] font-semibold text-game-text">{game.name}</span>
            </span>
          ))}
        </div>
      </PhoneFrame>
    </div>
  );
}

function PhoneFrame({ children, className = '' }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div aria-hidden="true" className={`overflow-hidden rounded-[2.2rem] border-[9px] border-[#222733] bg-game-bg shadow-[0_30px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/20 ${className}`}>
      <div className="flex h-6 items-center justify-between px-4 text-[8px] font-bold text-[#f4f1e8]">
        <span>9:41</span>
        <span className="h-3.5 w-16 rounded-full bg-black" />
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-sm bg-[#f4f1e8]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#f4f1e8]" />
        </span>
      </div>
      {children}
    </div>
  );
}

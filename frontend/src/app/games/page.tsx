'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';

const GAMES = [
  { id: 'bingo', name: 'Bingo', mark: '75', description: 'Build your card and race for five lines.', href: '/games/bingo', accent: '#ff684d', surface: '#351d19' },
  { id: 'chess', name: 'Chess', mark: '♞', description: 'Live clocks, legal moves and classic match play.', href: '/games/chess', accent: '#65aaf6', surface: '#182938' },
  { id: 'ludo', name: 'Ludo', mark: '●', description: 'Race four tokens around a true 15×15 board.', href: '/games/ludo', accent: '#63d5a4', surface: '#173126' },
  { id: 'photobooth', name: 'Photobooth', mark: '◎', description: 'A cozy couples photo session. Snap a keepsake strip together!', href: '/games/photobooth', accent: '#ff8db3', surface: '#351d2a' },
  { id: 'uno', name: 'UNO', mark: '7', description: 'The classic card game for 2–4. Match, stack, and shout UNO!', href: '/games/uno', accent: '#f2c94c', surface: '#382d16' },
  { id: 'tictactoe', name: 'Tic Tac Toe', mark: 'X', description: 'Classic and limited-piece tactical modes, with bots.', href: '/games/tictactoe', accent: '#d7a7ff', surface: '#2c2036' },
  { id: 'connectfour', name: 'Connect Four', mark: '4', description: 'Drop discs, build a line, or challenge a bot.', href: '/games/connectfour', accent: '#ffcf4a', surface: '#26304a' },
  { id: 'sudoku', name: 'Sudoku', mark: '9', description: 'A focused solo grid with notes and validation.', href: '/games/sudoku', accent: '#8dd8c1', surface: '#1d302d' },
] as const;

export default function GamesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const { isConnected } = useSocket();
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);

  const join = () => {
    if (/^\d{6}$/.test(joinCode)) router.push(`/lobby/${joinCode}`);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-game-coral">GAME ROOM</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Choose a table</h1>
            <p className="mt-2 text-game-muted">{user?.username}, your eight games are ready.</p>
          </div>
          <div className="flex w-full max-w-lg items-center gap-2 rounded-lg border border-white/12 bg-[#1b211d] p-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && join()}
              inputMode="numeric"
              aria-label="Join lobby code"
              placeholder="Enter 6-digit room code"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-lg font-bold text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-white/35"
            />
            <button
              type="button"
              disabled={joinCode.length !== 6}
              onClick={join}
              className="h-11 rounded-lg bg-[#f4f1e8] px-5 font-bold text-[#171912] disabled:opacity-35"
            >
              Join
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 text-xs text-game-muted">
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-game-mint' : 'bg-game-coral'}`} />
          {isConnected ? 'Connected' : 'Reconnecting'}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {GAMES.map((game, index) => (
            <motion.button
              key={game.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.055 }}
              onClick={() => router.push(game.href)}
              className="group relative flex min-h-72 flex-col overflow-hidden rounded-lg border border-white/14 p-5 text-left shadow-xl shadow-black/15 transition-transform hover:-translate-y-1"
              style={{ backgroundColor: game.surface }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: game.accent }} />
              <div className="flex h-16 w-16 items-center justify-center rounded-lg text-3xl font-black text-[#141712]" style={{ backgroundColor: game.accent }}>
                {game.mark}
              </div>
              <div className="mt-auto pt-8">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-white">{game.name}</h2>
                  <span className="text-lg text-white/50" aria-hidden="true">→</span>
                </div>
                <p className="text-sm leading-5 text-white/65">{game.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';

const GAMES = [
  {
    id: 'bingo',
    name: 'Bingo',
    mark: '75',
    description: 'Build your card and race for five lines.',
    available: true,
    href: '/games/bingo',
    accent: '#ff684d',
    surface: '#351d19',
  },
  {
    id: 'chess',
    name: 'Chess',
    mark: '♞',
    description: 'Live clocks, legal moves and classic match play.',
    available: true,
    href: '/games/chess',
    accent: '#65aaf6',
    surface: '#182938',
  },
  {
    id: 'ludo',
    name: 'Ludo',
    mark: '●',
    description: 'Race four tokens around a true 15×15 board.',
    available: true,
    href: '/games/ludo',
    accent: '#63d5a4',
    surface: '#173126',
  },
  {
    id: 'photobooth',
    name: 'Photobooth',
    mark: '◎',
    description: 'A cozy couples photo session. Snap a keepsake strip together!',
    available: true,
    href: '/games/photobooth',
    accent: '#ff8db3',
    surface: '#351d2a',
  },
  {
    id: 'uno',
    name: 'UNO',
    mark: '7',
    description: 'The classic card game for 2–4. Match, stack, and shout UNO!',
    available: true,
    href: '/games/uno',
    accent: '#f2c94c',
    surface: '#382d16',
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    mark: 'X',
    description: 'Classic and limited-piece tactical modes, with bots.',
    available: true,
    href: '/games/tictactoe',
    accent: '#d7a7ff',
    surface: '#2c2036',
  },
  {
    id: 'connect4',
    name: 'Connect Four',
    mark: '4',
    description: 'Drop discs, build a line, or challenge a bot.',
    available: true,
    href: '/games/connectfour',
    accent: '#ffcf4a',
    surface: '#26304a',
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    mark: '9',
    description: 'A focused solo grid with notes and validation.',
    available: true,
    href: '/games/sudoku',
    accent: '#8dd8c1',
    surface: '#1d302d',
  },
];

export default function GamesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  useSocket();

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-game-coral">GAME ROOM</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Choose a table</h1>
            <p className="mt-2 text-game-muted">
              {user?.username}, your games are ready.
            </p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-game-muted sm:flex">
            <span className="h-2 w-2 rounded-full bg-game-mint" />
            Connected
          </div>
        </div>

        {/* Game grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {GAMES.map((game, i) => (
            <motion.button
              key={game.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.055 }}
              disabled={!game.available}
              onClick={() => game.available && router.push(game.href)}
              className={`group relative flex min-h-72 flex-col overflow-hidden rounded-lg border p-5 text-left shadow-xl shadow-black/15 transition-transform enabled:hover:-translate-y-1 ${
                game.available ? 'border-white/14' : 'cursor-not-allowed border-white/8 opacity-60'
              }`}
              style={{ backgroundColor: game.surface }}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: game.accent }}
              />
              <div
                className="flex h-16 w-16 items-center justify-center rounded-lg text-3xl font-black text-[#141712]"
                style={{ backgroundColor: game.accent }}
              >
                {game.mark}
              </div>
              <div className="mt-auto pt-8">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-white">{game.name}</h2>
                  <span className="text-lg text-white/50" aria-hidden="true">{game.available ? '→' : '·'}</span>
                </div>
                <p className="text-sm leading-5 text-white/65">{game.description}</p>
                {!game.available && (
                  <span className="mt-3 inline-block text-xs font-bold" style={{ color: game.accent }}>
                    IN DEVELOPMENT
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </main>
  );
}
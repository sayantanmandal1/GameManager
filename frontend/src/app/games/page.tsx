'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';

const GAMES = [
  {
    id: 'bingo',
    name: 'Bingo',
    emoji: '🎰',
    description: 'Classic number-calling game. Be first to complete a pattern!',
    available: true,
    href: '/games/bingo',
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    id: 'chess',
    name: 'Chess',
    emoji: '♟️',
    description: 'The king of strategy games.',
    available: false,
    href: '#',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'ludo',
    name: 'Ludo',
    emoji: '🎲',
    description: 'Race your tokens to the finish line!',
    available: true,
    href: '/games/ludo',
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    emoji: '❌',
    description: 'Classic X and O battle.',
    available: false,
    href: '#',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    id: 'poker',
    name: 'Poker',
    emoji: '🃏',
    description: 'Texas Hold\'em with friends.',
    available: false,
    href: '#',
    gradient: 'from-red-500 to-red-700',
  },
  {
    id: 'scrabble',
    name: 'Scrabble',
    emoji: '📝',
    description: 'Build words, score points.',
    available: false,
    href: '#',
    gradient: 'from-teal-500 to-cyan-600',
  },
];

export default function GamesPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  useSocket();

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">Choose a Game</h1>
            <p className="text-game-muted mt-1">
              Welcome back, {user?.avatar} {user?.username}!
            </p>
          </div>
          <button
            onClick={() => {
              useAuthStore.getState().logout();
              router.push('/');
            }}
            className="text-sm text-game-muted hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Game grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                hoverable={game.available}
                className={`relative overflow-hidden ${
                  !game.available ? 'opacity-50' : ''
                }`}
                onClick={() => game.available && router.push(game.href)}
              >
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${game.gradient}`}
                />

                <div className="text-4xl mb-3">{game.emoji}</div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {game.name}
                </h2>
                <p className="text-sm text-game-muted">{game.description}</p>

                {!game.available && (
                  <span className="absolute top-3 right-3 text-xs px-2 py-1 bg-game-border rounded-full text-game-muted">
                    Coming Soon
                  </span>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}

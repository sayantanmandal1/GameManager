'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

function FloatingParticle({ delay, seed }: { delay: number; seed: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const startX = seed * window.innerWidth;
  const startY = window.innerHeight + 10;
  const drift = seed * 200 - 100;
  const duration = 6 + seed * 4;

  return (
    <motion.div
      className="absolute w-1 h-1 bg-primary/30 rounded-full"
      initial={{ x: startX, y: startY }}
      animate={{
        y: -10,
        x: `+=${drift}`,
        opacity: [0, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, login, isLoading, error } = useAuthStore();
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/games');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (!username.trim()) return;
    await login(username.trim());
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <FloatingParticle key={i} delay={i * 0.3} seed={((i * 7 + 3) % 20) / 20} />
      ))}

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center z-10"
      >
        <motion.h1
          className="text-7xl md:text-8xl font-black mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
          animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ backgroundSize: '200%' }}
        >
          GAMEVERSE
        </motion.h1>
        <p className="text-xl text-game-muted mb-12">
          Play multiplayer games with friends in real-time
        </p>

        <Button
          size="lg"
          className="animate-pulse-glow text-xl px-12 py-5"
          onClick={() => setShowLogin(true)}
        >
          🎮 PLAY
        </Button>
      </motion.div>

      {/* Login Modal */}
      <Modal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        title="Enter the Arena"
      >
        <div className="space-y-4">
          <Input
            label="Choose a Username"
            placeholder="e.g. ProGamer42"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            maxLength={20}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            className="w-full"
            onClick={handleLogin}
            isLoading={isLoading}
            disabled={!username.trim()}
          >
            Enter as Guest
          </Button>
          <p className="text-xs text-center text-game-muted">
            No account needed — just pick a name and play!
          </p>
        </div>
      </Modal>
    </main>
  );
}

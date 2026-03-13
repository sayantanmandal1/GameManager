'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { BingoBoard } from '@/components/bingo/BingoBoard';
import { NumberDisplay } from '@/components/bingo/NumberDisplay';
import { Button } from '@/components/ui/Button';
import type { BingoBoard as BingoBoardType, BingoCell } from '@multiplayer-games/shared';
import {
  BINGO_BOARD_SIZE,
  BINGO_TOTAL_NUMBERS,
  BINGO_COLUMNS,
  BINGO_COLUMN_RANGES,
  BINGO_FREE_ROW,
  BINGO_FREE_COL,
  BingoWinPattern,
} from '@multiplayer-games/shared';

// ─── Offline engine helpers ───

function rangeArray(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateBoard(): BingoBoardType {
  const board: BingoBoardType = [];
  for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
    const cells: BingoCell[] = [];
    for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
      if (row === BINGO_FREE_ROW && col === BINGO_FREE_COL) {
        cells.push({ value: 'FREE', marked: true });
      } else {
        cells.push({ value: 0, marked: false });
      }
    }
    board.push(cells);
  }

  for (let col = 0; col < BINGO_BOARD_SIZE; col++) {
    const column = BINGO_COLUMNS[col];
    const [min, max] = BINGO_COLUMN_RANGES[column];
    const pool = shuffleArray(rangeArray(min, max));
    let idx = 0;
    for (let row = 0; row < BINGO_BOARD_SIZE; row++) {
      if (row === BINGO_FREE_ROW && col === BINGO_FREE_COL) continue;
      board[row][col] = { value: pool[idx++], marked: false };
    }
  }
  return board;
}

function checkWin(board: BingoBoardType): BingoWinPattern | null {
  for (let r = 0; r < BINGO_BOARD_SIZE; r++) {
    if (board[r].every((c) => c.marked)) return BingoWinPattern.ROW;
  }
  for (let c = 0; c < BINGO_BOARD_SIZE; c++) {
    if (Array.from({ length: BINGO_BOARD_SIZE }, (_, r) => board[r][c].marked).every(Boolean))
      return BingoWinPattern.COLUMN;
  }
  if (Array.from({ length: BINGO_BOARD_SIZE }, (_, i) => board[i][i].marked).every(Boolean))
    return BingoWinPattern.DIAGONAL;
  if (
    Array.from({ length: BINGO_BOARD_SIZE }, (_, i) =>
      board[i][BINGO_BOARD_SIZE - 1 - i].marked,
    ).every(Boolean)
  )
    return BingoWinPattern.DIAGONAL;
  if (board.every((row) => row.every((c) => c.marked)))
    return BingoWinPattern.FULL_HOUSE;
  return null;
}

// ─── Component ───

export default function OfflineBingoPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BingoBoardType>(() => generateBoard());
  const [drawPool, setDrawPool] = useState<number[]>(() =>
    shuffleArray(rangeArray(1, BINGO_TOTAL_NUMBERS)),
  );
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [winner, setWinner] = useState<BingoWinPattern | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const drawNumber = useCallback(() => {
    setDrawPool((pool) => {
      if (pool.length === 0) return pool;
      const newPool = [...pool];
      const num = newPool.pop()!;
      setCurrentNumber(num);
      setCalledNumbers((prev) => [...prev, num]);
      return newPool;
    });
  }, []);

  // Auto-draw timer
  useEffect(() => {
    if (winner || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(drawNumber, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [drawNumber, winner, isPaused]);

  const handleMark = (number: number) => {
    setBoard((prev) => {
      const newBoard = prev.map((row) =>
        row.map((cell) =>
          cell.value === number ? { ...cell, marked: true } : cell,
        ),
      );
      // Check win
      const win = checkWin(newBoard);
      if (win) {
        setWinner(win);
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#ec4899', '#fbbf24', '#34d399'],
        });
      }
      return newBoard;
    });
  };

  const handleNewGame = () => {
    setBoard(generateBoard());
    setDrawPool(shuffleArray(rangeArray(1, BINGO_TOTAL_NUMBERS)));
    setCalledNumbers([]);
    setCurrentNumber(null);
    setWinner(null);
    setIsPaused(false);
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/games/bingo')}
            className="text-sm text-game-muted hover:text-white transition-colors"
          >
            ← Back
          </button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              disabled={!!winner}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleNewGame}>
              New Game
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          <BingoBoard
            board={board}
            currentNumber={currentNumber}
            onMarkNumber={handleMark}
            disabled={!!winner}
          />

          <NumberDisplay
            currentNumber={currentNumber}
            calledNumbers={calledNumbers}
          />
        </div>

        {/* Winner overlay */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="text-center p-8 bg-game-card border border-game-border rounded-2xl max-w-sm">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-black text-white mb-2">BINGO!</h2>
              <p className="text-game-muted mb-4">
                You won with a {winner} pattern!
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleNewGame}>Play Again</Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/games/bingo')}
                >
                  Back
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

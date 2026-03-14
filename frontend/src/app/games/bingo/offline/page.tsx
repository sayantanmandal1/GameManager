'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { BingoBoard } from '@/components/bingo/BingoBoard';
import { Button } from '@/components/ui/Button';
import type { BingoBoard as BingoBoardType, BingoCell } from '@/shared';
import { BINGO_BOARD_SIZE, BINGO_TOTAL_NUMBERS } from '@/shared';

// ─── Offline helpers ───

function createEmptyBoard(): BingoBoardType {
  const board: BingoBoardType = [];
  for (let r = 0; r < BINGO_BOARD_SIZE; r++) {
    const row: BingoCell[] = [];
    for (let c = 0; c < BINGO_BOARD_SIZE; c++) {
      row.push({ value: 0, marked: false });
    }
    board.push(row);
  }
  return board;
}

function countCompletedLines(board: BingoBoardType): number {
  let count = 0;
  for (let r = 0; r < 5; r++) {
    if (board[r].every((c) => c.marked)) count++;
  }
  for (let c = 0; c < 5; c++) {
    let all = true;
    for (let r = 0; r < 5; r++) if (!board[r][c].marked) { all = false; break; }
    if (all) count++;
  }
  let d1 = true, d2 = true;
  for (let i = 0; i < 5; i++) {
    if (!board[i][i].marked) d1 = false;
    if (!board[i][4 - i].marked) d2 = false;
  }
  if (d1) count++;
  if (d2) count++;
  return count;
}

// ─── Component ───

type Phase = 'setup' | 'playing' | 'finished';

export default function OfflineBingoPage() {
  const router = useRouter();
  const [myBoard, setMyBoard] = useState<BingoBoardType>(() => createEmptyBoard());
  const [botBoard] = useState<BingoBoardType>(() => {
    // Bot fills its board randomly
    const b = createEmptyBoard();
    const nums = Array.from({ length: BINGO_TOTAL_NUMBERS }, (_, i) => i + 1);
    // shuffle
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    let idx = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        b[r][c] = { value: nums[idx++], marked: false };
      }
    }
    return b;
  });
  const [phase, setPhase] = useState<Phase>('setup');
  const [nextPlaceNumber, setNextPlaceNumber] = useState(1);
  const [chosenNumbers, setChosenNumbers] = useState<number[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [myLines, setMyLines] = useState(0);
  const [botLines, setBotLines] = useState(0);
  const [winner, setWinner] = useState<'you' | 'bot' | null>(null);

  const handleSetupClick = useCallback(
    (row: number, col: number) => {
      if (myBoard[row][col].value !== 0 || nextPlaceNumber > BINGO_TOTAL_NUMBERS) return;
      const newBoard = myBoard.map((r) => r.map((c) => ({ ...c })));
      newBoard[row][col] = { value: nextPlaceNumber, marked: false };
      setMyBoard(newBoard);
      const next = nextPlaceNumber + 1;
      setNextPlaceNumber(next);
      if (next > BINGO_TOTAL_NUMBERS) {
        setPhase('playing');
      }
    },
    [myBoard, nextPlaceNumber],
  );

  const markNumber = useCallback(
    (num: number) => {
      // Mark on both boards
      const newMy = myBoard.map((r) =>
        r.map((c) => (c.value === num ? { ...c, marked: true } : c)),
      );
      setMyBoard(newMy);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (botBoard[r][c].value === num) botBoard[r][c].marked = true;
        }
      }
      setChosenNumbers((prev) => [...prev, num]);

      const ml = countCompletedLines(newMy);
      const bl = countCompletedLines(botBoard);
      setMyLines(ml);
      setBotLines(bl);

      if (ml >= 5) {
        setWinner('you');
        setPhase('finished');
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
      } else if (bl >= 5) {
        setWinner('bot');
        setPhase('finished');
      }
    },
    [myBoard, botBoard],
  );

  const handleChoose = useCallback(
    (num: number) => {
      if (!isMyTurn || chosenNumbers.includes(num) || phase !== 'playing') return;
      markNumber(num);
      setIsMyTurn(false);

      // Bot's turn: pick a random unchosen number after delay
      setTimeout(() => {
        const allNums = Array.from({ length: BINGO_TOTAL_NUMBERS }, (_, i) => i + 1);
        const available = allNums.filter(
          (n) => !chosenNumbers.includes(n) && n !== num,
        );
        if (available.length > 0) {
          const botPick = available[Math.floor(Math.random() * available.length)];
          markNumber(botPick);
        }
        setIsMyTurn(true);
      }, 600);
    },
    [isMyTurn, chosenNumbers, phase, markNumber],
  );

  const handleNewGame = () => {
    window.location.reload();
  };

  const allNumbers = Array.from({ length: BINGO_TOTAL_NUMBERS }, (_, i) => i + 1);

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/games/bingo')}
            className="text-sm text-game-muted hover:text-white transition-colors"
          >
            ← Back
          </button>
          <Button variant="secondary" size="sm" onClick={handleNewGame}>
            New Game
          </Button>
        </div>

        {/* SETUP */}
        {phase === 'setup' && (
          <div className="text-center">
            <h1 className="text-2xl font-black text-white mb-2">Set Up Your Board</h1>
            <p className="text-game-muted mb-4">
              Click an empty cell to place{' '}
              <span className="text-primary font-bold">{nextPlaceNumber}</span>
            </p>
            <BingoBoard
              board={myBoard}
              onCellClick={handleSetupClick}
              nextPlaceNumber={nextPlaceNumber <= BINGO_TOTAL_NUMBERS ? nextPlaceNumber : undefined}
              label="Your Board"
            />
          </div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && (
          <div>
            <div className="text-center mb-4">
              <span
                className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                  isMyTurn
                    ? 'bg-primary/20 text-primary border border-primary/50'
                    : 'bg-game-card text-game-muted border border-game-border'
                }`}
              >
                {isMyTurn ? '🎯 Your Turn — Pick a number!' : "⏳ Bot's Turn…"}
              </span>
            </div>

            {/* BINGO progress */}
            <div className="flex justify-center gap-8 mb-4">
              {[
                { label: 'You', lines: myLines },
                { label: 'Bot', lines: botLines },
              ].map(({ label, lines }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-sm text-game-muted">{label}:</span>
                  {'BINGO'.split('').map((l, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded text-xs font-black flex items-center justify-center ${
                        i < lines ? 'bg-primary text-white' : 'bg-game-bg text-game-muted/40 border border-game-border'
                      }`}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <BingoBoard board={myBoard} disabled label="Your Board" />

              {/* Number picker */}
              <div className="bg-game-card border border-game-border rounded-xl p-4">
                <h3 className="text-xs text-game-muted uppercase tracking-wider mb-3 text-center">
                  Choose a Number
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {allNumbers.map((num) => {
                    const used = chosenNumbers.includes(num);
                    const canPick = isMyTurn && !used;
                    return (
                      <button
                        key={num}
                        onClick={() => canPick && handleChoose(num)}
                        disabled={!canPick}
                        className={`aspect-square rounded-lg text-sm font-bold transition-all ${
                          used
                            ? 'bg-game-bg text-game-muted/30 line-through'
                            : canPick
                              ? 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary/40 cursor-pointer'
                              : 'bg-game-bg text-game-muted/60 border border-game-border'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              <BingoBoard board={botBoard} disabled label="Bot's Board" compact />
            </div>
          </div>
        )}

        {/* Winner overlay */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="text-center p-8 bg-game-card border border-game-border rounded-2xl max-w-sm">
              <div className="text-6xl mb-4">{winner === 'you' ? '🏆' : '🤖'}</div>
              <h2 className="text-3xl font-black text-white mb-2">
                {winner === 'you' ? 'YOU WON!' : 'Bot Wins!'}
              </h2>
              <div className="flex gap-3 justify-center mt-6">
                <Button onClick={handleNewGame}>Play Again</Button>
                <Button variant="secondary" onClick={() => router.push('/games/bingo')}>
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

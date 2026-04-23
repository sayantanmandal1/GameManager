'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { VoiceChat } from '@/components/voice/VoiceChat';
import {
  ChessBoard,
  ChessClock,
  ChessControls,
  ChessHistory,
  PromotionDialog,
  chessStrings,
} from '@/components/chess';
import { useAuthStore } from '@/stores/authStore';
import {
  useChessStore,
  selectIsMyTurn,
  selectOrientation,
} from '@/stores/chessStore';
import { useSocket } from '@/hooks/useSocket';
import { useChessSocket } from '@/hooks/useChessSocket';

interface ChessPlayClientProps {
  code: string;
}

export default function ChessPlayClient({ code }: ChessPlayClientProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { isConnected } = useSocket();

  useChessSocket(code);

  const view = useChessStore((s) => s.view);
  const clocks = useChessStore((s) => s.clocks);
  const pendingMove = useChessStore((s) => s.pendingMove);
  const promotion = useChessStore((s) => s.promotion);
  const result = useChessStore((s) => s.result);
  const error = useChessStore((s) => s.error);
  const role = useChessStore((s) => s.role);
  const myTurn = useChessStore(selectIsMyTurn);
  const orientation = useChessStore(selectOrientation);
  const makeMove = useChessStore((s) => s.makeMove);
  const openPromotion = useChessStore((s) => s.openPromotion);
  const cancelPromotion = useChessStore((s) => s.cancelPromotion);
  const resign = useChessStore((s) => s.resign);
  const offerDraw = useChessStore((s) => s.offerDraw);
  const respondDraw = useChessStore((s) => s.respondDraw);
  const reset = useChessStore((s) => s.reset);

  const [pendingPromoTarget, setPendingPromoTarget] = useState<
    { from: string; to: string } | null
  >(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!code) {
      router.push('/games/chess');
    }
  }, [code, router]);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  const lastMove = useMemo(() => {
    if (!view || view.history.length === 0) return null;
    const last = view.history[view.history.length - 1];
    return { from: last.from, to: last.to };
  }, [view]);

  const handleMoveAttempt = (
    from: string,
    to: string,
    promo?: 'q' | 'r' | 'b' | 'n',
  ) => {
    if (!view) return;
    // Detect promotion via FEN: was a pawn on `from` moving to last rank?
    const isLastRank = to.endsWith('8') || to.endsWith('1');
    // Cheap check: look up the piece from view.fen.
    const boardPart = view.fen.split(' ')[0];
    const fileIdx = 'abcdefgh'.indexOf(from[0]);
    const rankIdx = parseInt(from[1], 10) - 1;
    let piece: string | null = null;
    if (fileIdx >= 0 && rankIdx >= 0 && rankIdx < 8) {
      const ranks = boardPart.split('/');
      const row = ranks[7 - rankIdx];
      let f = 0;
      for (const ch of row) {
        const run = parseInt(ch, 10);
        if (!Number.isNaN(run)) {
          f += run;
        } else {
          if (f === fileIdx) {
            piece = ch;
            break;
          }
          f += 1;
        }
      }
    }
    const isPawn = piece?.toLowerCase() === 'p';
    if (isPawn && isLastRank && !promo) {
      const color = piece === 'P' ? 'w' : 'b';
      setPendingPromoTarget({ from, to });
      openPromotion(from, to, color);
      return;
    }
    makeMove(from, to, promo);
  };

  const handlePickPromotion = (piece: 'q' | 'r' | 'b' | 'n') => {
    const target = pendingPromoTarget;
    cancelPromotion();
    setPendingPromoTarget(null);
    if (target) makeMove(target.from, target.to, piece);
  };

  const handleCancelPromotion = () => {
    cancelPromotion();
    setPendingPromoTarget(null);
  };

  const handleBackToLobby = () => {
    reset();
    router.push(`/lobby/${code}`);
  };

  if (!isConnected && !view) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40">{chessStrings.errors.disconnected}</p>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading game…</p>
        </div>
      </main>
    );
  }

  const myColor: 'w' | 'b' | null =
    role === 'white' ? 'w' : role === 'black' ? 'b' : null;
  const canResign = role !== 'spectator' && view.status === 'in_progress';
  const canOfferDraw = canResign;
  const drawOfferFrom: 'me' | 'opponent' | null = view.drawOffer
    ? view.drawOffer.by === myColor
      ? 'me'
      : 'opponent'
    : null;
  const untimed = !view.timeControl;
  const whiteRemaining = clocks?.whiteMs ?? 0;
  const blackRemaining = clocks?.blackMs ?? 0;
  const lastTickAt = clocks?.lastTickAt ?? Date.now();

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Board column */}
        <div className="lg:col-span-8 flex flex-col items-center gap-3">
          <ChessClock
            label={orientation === 'white' ? 'black' : 'white'}
            remainingMs={orientation === 'white' ? blackRemaining : whiteRemaining}
            lastTickAt={lastTickAt}
            active={
              view.status === 'in_progress' &&
              view.turn === (orientation === 'white' ? 'b' : 'w')
            }
            untimed={untimed}
          />

          <ChessBoard
            fen={view.fen}
            orientation={orientation}
            myTurn={myTurn}
            pendingMove={pendingMove}
            lastMove={lastMove}
            onMoveAttempt={handleMoveAttempt}
            disabled={view.status !== 'in_progress'}
          />

          <ChessClock
            label={orientation === 'white' ? 'white' : 'black'}
            remainingMs={orientation === 'white' ? whiteRemaining : blackRemaining}
            lastTickAt={lastTickAt}
            active={
              view.status === 'in_progress' &&
              view.turn === (orientation === 'white' ? 'w' : 'b')
            }
            untimed={untimed}
          />

          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="text-white/60">♔ {view.whiteName}</div>
                <div className="text-white/60">♚ {view.blackName}</div>
              </div>
              <div className="text-xs text-white/40">
                {view.spectatorCount > 0 && `👁 ${view.spectatorCount}`}
              </div>
            </div>
          </Card>

          <ChessControls
            canResign={canResign}
            canOfferDraw={canOfferDraw}
            drawOfferFrom={drawOfferFrom}
            onResign={resign}
            onOfferDraw={offerDraw}
            onRespondDraw={respondDraw}
          />

          <ChessHistory moves={view.history} />

          <VoiceChat roomId={code} />
        </div>
      </div>

      <PromotionDialog
        open={promotion !== null}
        color={promotion?.color ?? null}
        onPick={handlePickPromotion}
        onCancel={handleCancelPromotion}
      />

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chess-gameover-title"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center max-w-md mx-4"
            >
              <div className="text-6xl mb-4">
                {result.result === '1/2-1/2'
                  ? '🤝'
                  : role === 'spectator'
                  ? '🎮'
                  : (result.winnerId === user?.id ? '🏆' : '🪦')}
              </div>
              <h2 id="chess-gameover-title" className="text-3xl font-black text-white mb-2">
                {result.result === '1/2-1/2'
                  ? chessStrings.gameOver.draw
                  : role === 'spectator'
                  ? chessStrings.gameOver.spectatorEnded
                  : result.winnerId === user?.id
                  ? chessStrings.gameOver.win
                  : chessStrings.gameOver.loss}
              </h2>
              <p className="text-white/60 mb-4">
                {chessStrings.gameOver.termination[result.termination]}
              </p>
              <Button onClick={handleBackToLobby}>
                {chessStrings.gameOver.returnToLobby}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

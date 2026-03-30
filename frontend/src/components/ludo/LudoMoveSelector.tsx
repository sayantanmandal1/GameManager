'use client';

import { motion } from 'framer-motion';
import type { LudoMoveAction } from '@/shared';

interface LudoMoveSelectorProps {
  moves: LudoMoveAction[][];
  tokenId: number;
  onSelect: (moves: LudoMoveAction[]) => void;
  onCancel: () => void;
}

export function LudoMoveSelector({
  moves,
  tokenId,
  onSelect,
  onCancel,
}: LudoMoveSelectorProps) {
  // Filter to moves involving this token
  const relevantMoves = moves.filter((combo) =>
    combo.some((a) => a.tokenId === tokenId),
  );

  if (relevantMoves.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute z-10 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 shadow-xl min-w-[180px]"
    >
      <p className="text-xs text-white/40 mb-2 font-semibold uppercase tracking-wider">
        Choose move
      </p>
      <div className="space-y-1.5">
        {relevantMoves.map((combo, idx) => {
          const description = describeMoveCombo(combo, tokenId);
          return (
            <button
              key={idx}
              onClick={() => onSelect(combo)}
              className="w-full text-left px-3 py-2 rounded-lg bg-black hover:bg-white/20 
                border border-transparent hover:border-white/50 transition-all
                text-sm text-white"
            >
              {description}
            </button>
          );
        })}
      </div>
      <button
        onClick={onCancel}
        className="mt-2 w-full text-xs text-white/40 hover:text-white transition-colors py-1"
      >
        Cancel
      </button>
    </motion.div>
  );
}

function describeMoveCombo(combo: LudoMoveAction[], selectedTokenId: number): string {
  if (combo.length === 1) {
    const a = combo[0];
    if (a.steps === 6 && a.tokenId === selectedTokenId) {
      return `🚀 Enter board (6)`;
    }
    return `Move ${a.steps} step${a.steps > 1 ? 's' : ''}`;
  }

  // Two-part move
  const parts: string[] = [];
  for (const a of combo) {
    if (a.tokenId === selectedTokenId) {
      parts.push(`This token: ${a.steps}`);
    } else {
      parts.push(`Token ${a.tokenId + 1}: ${a.steps}`);
    }
  }
  return parts.join(' + ');
}

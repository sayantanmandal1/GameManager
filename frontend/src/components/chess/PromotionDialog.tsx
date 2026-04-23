'use client';

import { useEffect, useRef } from 'react';
import { chessStrings } from './strings';

export interface PromotionDialogProps {
  open: boolean;
  color: 'w' | 'b' | null;
  onPick: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const PIECES: Array<{ key: 'q' | 'r' | 'b' | 'n'; label: string }> = [
  { key: 'q', label: chessStrings.promotion.queen },
  { key: 'r', label: chessStrings.promotion.rook },
  { key: 'b', label: chessStrings.promotion.bishop },
  { key: 'n', label: chessStrings.promotion.knight },
];

/** Native <dialog> promotion picker, default focus = Queen. */
export function PromotionDialog({ open, color, onPick, onCancel }: PromotionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const queenRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      // Some environments (jsdom) do not implement showModal; fall back.
      if (typeof dlg.showModal === 'function') {
        try {
          dlg.showModal();
        } catch {
          dlg.setAttribute('open', '');
        }
      } else {
        dlg.setAttribute('open', '');
      }
      // Default focus on Queen after open
      requestAnimationFrame(() => queenRef.current?.focus());
    } else if (!open && dlg.open) {
      if (typeof dlg.close === 'function') {
        try {
          dlg.close();
        } catch {
          dlg.removeAttribute('open');
        }
      } else {
        dlg.removeAttribute('open');
      }
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={chessStrings.promotion.title}
      data-testid="promotion-dialog"
      data-color={color ?? ''}
      onKeyDown={handleKeyDown}
      className="rounded-xl p-4 bg-stone-900 text-white border border-white/10 backdrop:bg-black/60"
    >
      <h2 className="text-sm font-semibold mb-3">{chessStrings.promotion.title}</h2>
      <div className="flex gap-2" role="group" aria-label={chessStrings.promotion.title}>
        {PIECES.map((p) => (
          <button
            key={p.key}
            type="button"
            ref={p.key === 'q' ? queenRef : undefined}
            onClick={() => onPick(p.key)}
            aria-label={p.label}
            className="px-4 py-3 rounded-lg bg-white/[0.06] hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {p.label}
          </button>
        ))}
      </div>
    </dialog>
  );
}

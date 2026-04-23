'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { chessStrings } from './strings';

export interface ChessControlsProps {
  canResign: boolean;
  canOfferDraw: boolean;
  /** 'me' when the draw offer was made by the local player (hide Accept/Decline).
   *  'opponent' when the opponent offered (show Accept/Decline). null when no offer. */
  drawOfferFrom: 'me' | 'opponent' | null;
  onResign: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (response: 'accept' | 'decline') => void;
}

export function ChessControls({
  canResign,
  canOfferDraw,
  drawOfferFrom,
  onResign,
  onOfferDraw,
  onRespondDraw,
}: ChessControlsProps) {
  const [confirmingResign, setConfirmingResign] = useState(false);

  const handleResignClick = () => {
    if (!canResign) return;
    setConfirmingResign(true);
  };

  const confirmResign = () => {
    setConfirmingResign(false);
    onResign();
  };

  return (
    <div
      data-testid="chess-controls"
      className="flex flex-col gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={handleResignClick}
          disabled={!canResign}
          aria-label={chessStrings.controls.resign}
        >
          {chessStrings.controls.resign}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOfferDraw}
          disabled={!canOfferDraw || drawOfferFrom !== null}
          aria-label={
            drawOfferFrom === 'me'
              ? chessStrings.controls.drawOffered
              : chessStrings.controls.offerDraw
          }
        >
          {drawOfferFrom === 'me'
            ? chessStrings.controls.drawOffered
            : chessStrings.controls.offerDraw}
        </Button>
      </div>

      {drawOfferFrom === 'opponent' && (
        <div
          role="region"
          aria-label={chessStrings.controls.drawPendingFromOpponent}
          className="flex flex-wrap gap-2 items-center"
        >
          <span className="text-sm text-white/70">
            {chessStrings.controls.drawPendingFromOpponent}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onRespondDraw('accept')}
          >
            {chessStrings.controls.accept}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRespondDraw('decline')}
          >
            {chessStrings.controls.decline}
          </Button>
        </div>
      )}

      {confirmingResign && (
        <div
          role="alertdialog"
          aria-labelledby="resign-confirm-title"
          className="mt-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10"
        >
          <p id="resign-confirm-title" className="text-sm text-white mb-2">
            {chessStrings.controls.resignConfirmTitle}
          </p>
          <p className="text-xs text-white/60 mb-3">
            {chessStrings.controls.resignConfirmBody}
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={confirmResign}>
              {chessStrings.controls.resignConfirm}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmingResign(false)}
            >
              {chessStrings.controls.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

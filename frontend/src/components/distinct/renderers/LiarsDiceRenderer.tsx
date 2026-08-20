'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LiarsDiceAction, LiarsDicePlayerView } from '@/shared';

interface Props { view: LiarsDicePlayerView; disabled: boolean; onAction: (action: LiarsDiceAction) => void }

export function LiarsDiceRenderer({ view, disabled, onAction }: Props) {
  const bidQuantity = view.currentBid?.quantity;
  const bidFace = view.currentBid?.face;
  const minimumQuantity = bidQuantity ?? 1;
  const [quantity, setQuantity] = useState(minimumQuantity);
  const [face, setFace] = useState(bidFace ? Math.min(6, bidFace + 1) : 1);
  useEffect(() => {
    setQuantity(bidQuantity ?? 1);
    setFace(bidFace ? Math.min(6, bidFace + 1) : 1);
  }, [bidQuantity, bidFace, view.round]);
  const bidValid = quantity >= 1 && quantity <= view.totalDice && face >= 1 && face <= 6 && (!view.currentBid || quantity > view.currentBid.quantity || (quantity === view.currentBid.quantity && face > view.currentBid.face));
  return (
    <div className="w-full max-w-[46rem]">
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((player) => <div key={player.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2"><span className="truncate font-semibold">{player.name}</span><span className="text-sm text-white/55">{player.diceCount} dice</span></div>)}
      </div>
      <div className="mt-7 text-center">
        <p className="text-xs font-bold text-white/45">CURRENT BID</p>
        <p className="mt-1 text-3xl font-black text-[#db8cf0]">{view.currentBid ? `${view.currentBid.quantity} dice showing ${view.currentBid.face}` : 'Open the bidding'}</p>
        <p className="mt-2 text-sm text-white/45">Round {view.round} / {view.totalDice} dice remain</p>
      </div>
      <div className="mt-7 flex flex-wrap justify-center gap-3" aria-label="Your private dice">
        {view.yourDice.map((die, index) => <span key={index} className="flex h-16 w-16 items-center justify-center border border-white/15 bg-[#f5f1e7] text-3xl font-black text-[#25212a] shadow-lg" aria-label={`Your die ${index + 1}: ${die}`}>{die}</span>)}
      </div>
      {view.canAct && (
        <div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-3">
          <label className="text-sm text-white/60">Quantity<input type="number" min={1} max={view.totalDice} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 min-h-11 w-full border border-white/15 bg-black/25 px-3 text-white" /></label>
          <label className="text-sm text-white/60">Face<select value={face} onChange={(event) => setFace(Number(event.target.value))} className="mt-1 min-h-11 w-full border border-white/15 bg-black/25 px-3 text-white">{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <Button disabled={disabled || !bidValid} onClick={() => onAction({ type: 'bid', quantity, face })}>Raise bid</Button>
          <Button variant="danger" disabled={disabled || !view.currentBid} onClick={() => onAction({ type: 'challenge' })}>Challenge</Button>
        </div>
      )}
      {view.lastResolution && <p className="mt-5 text-center text-sm text-white/55">{view.lastResolution}</p>}
    </div>
  );
}
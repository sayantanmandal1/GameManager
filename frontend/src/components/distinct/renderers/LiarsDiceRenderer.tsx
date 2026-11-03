'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LiarsDiceAction, LiarsDicePlayerView } from '@/shared';
import { LiarDie, LiarTableScene } from './LiarTableScene';

interface Props { view: LiarsDicePlayerView; disabled: boolean; onAction: (action: LiarsDiceAction) => void }

export function LiarsDiceRenderer({ view, disabled, onAction }: Props) {
  const bidQuantity = view.currentBid?.quantity;
  const bidFace = view.currentBid?.face;
  const minimumQuantity = (bidQuantity ?? 0) + 1;
  const canRaise = minimumQuantity <= view.totalDice;
  const [quantity, setQuantity] = useState(minimumQuantity);
  const [face, setFace] = useState(bidFace ? Math.min(6, bidFace + 1) : 1);
  const [cupOpen, setCupOpen] = useState(false);
  useEffect(() => {
    setQuantity((bidQuantity ?? 0) + 1);
    setFace(1);
  }, [bidQuantity, bidFace, view.round]);
  useEffect(() => setCupOpen(false), [view.round]);
  const bidValid = Number.isInteger(quantity) && quantity >= minimumQuantity && quantity <= view.totalDice && Number.isInteger(face) && face >= 1 && face <= 6;
  const playerName = (id: string) => view.players.find((player) => player.id === id)?.name ?? 'Player';
  if (view.phase === 'setup') return <section className="w-full max-w-3xl rounded-3xl border border-[#d1af68]/25 bg-[#201a14] p-6 text-center">
    <p className="eyebrow text-[#e5bd72]">Liar&apos;s Dice</p>
    <h2 className="mt-3 text-2xl font-semibold">Choose the table rules</h2>
    <p className="mt-3 text-sm leading-6 text-white/65">Five hidden dice each. Raise the quantity or challenge the last bid. A failed call or a caught bluff costs one poison penalty; two penalties eliminate a player.</p>
    {view.canAct ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button disabled={disabled} onClick={() => onAction({ type: 'select_liars_dice_mode', mode: 'classic' })}>Classic</Button><Button disabled={disabled} variant="secondary" onClick={() => onAction({ type: 'select_liars_dice_mode', mode: 'traditional' })}>Traditional · wild ones</Button></div> : <p role="status" className="mt-6 text-sm text-[#e5bd72]">Waiting for {playerName(view.hostId)} to choose the rules.</p>}
    <p className="mt-4 text-xs leading-5 text-white/55">Traditional adds wild ones and Spot on: a correct exact-count call penalizes everyone else; an incorrect call penalizes only you.</p>
  </section>;
  return (
    <div className="w-full max-w-[64rem] space-y-4">
      <LiarTableScene kind="dice" players={view.players.map((player) => ({ ...player, active: player.diceCount > 0 }))} youId={view.youId} currentTurnId={view.currentTurnId} round={view.round} privateDice={cupOpen ? view.yourDice : []} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {view.players.map((player) => <div key={player.id} className={`min-w-0 rounded-xl border px-3 py-2 ${player.id === view.currentTurnId && view.phase === 'playing' ? 'border-[#dfbd70]/70 bg-[#dfbd70]/10' : 'border-white/10 bg-black/15'} ${player.diceCount === 0 ? 'opacity-45' : ''}`}><p className="truncate font-semibold" title={player.name}>{player.name}{player.id === view.youId ? ' · you' : ''}</p><p className="mt-1 text-xs text-white/65">{player.diceCount > 0 ? `${player.diceCount} dice · ${view.penalties[player.id]}/2 poison` : 'Eliminated'}</p></div>)}
      </div>
      <div className="rounded-2xl border border-[#dfbd70]/20 bg-black/20 px-4 py-4 text-center">
        <p className="text-xs font-bold text-white/65">{view.mode === 'traditional' ? 'TRADITIONAL · ONES ARE WILD' : 'CLASSIC · NO WILD DICE'}</p>
        <p className="mt-1 text-3xl font-black text-[#db8cf0]">{view.currentBid ? `${view.currentBid.quantity} dice showing ${view.currentBid.face}` : 'Open the bidding'}</p>
        <p className="mt-2 text-sm text-white/45">Round {view.round} / {view.totalDice} dice remain</p>
      </div>
      {view.phase === 'playing' && view.yourDice.length > 0 && <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
        <button type="button" className="min-h-11 rounded-xl border border-[#dfbd70]/35 px-5 text-sm font-bold text-[#edd393] hover:bg-white/5" aria-expanded={cupOpen} aria-controls="liar-private-dice" onClick={() => setCupOpen((open) => !open)}>{cupOpen ? 'Lower cup · hide dice' : 'Lift cup · view your dice'}</button>
        <div id="liar-private-dice" className="mt-3 flex min-h-14 flex-wrap items-center justify-center gap-2" aria-label="Your private dice">
          {cupOpen ? view.yourDice.map((die, index) => <LiarDie key={index} value={die} label={`Your die ${index + 1}: ${die}`} />) : <p className="text-sm text-white/60">Your dice are hidden under your cup.</p>}
        </div>
      </div>}
      {view.canAct && view.phase === 'playing' && (
        <div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-3">
          {canRaise ? <>
            <label className="text-sm text-game-muted">Quantity<input type="number" min={minimumQuantity} max={view.totalDice} step={1} disabled={disabled} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="game-field mt-1" /></label>
            <label className="text-sm text-game-muted">Face<select disabled={disabled} value={face} onChange={(event) => setFace(Number(event.target.value))} className="game-field mt-1">{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <Button disabled={disabled || !bidValid} onClick={() => onAction({ type: 'bid', quantity, face })}>Raise bid</Button>
          </> : <p role="status" className="col-span-2 text-center text-sm text-[#edd393]">No higher bid is possible. Challenge{view.mode === 'traditional' ? ' or call Spot on' : ''}.</p>}
          <Button variant="danger" disabled={disabled || !view.canChallenge} onClick={() => onAction({ type: 'challenge' })}>Challenge</Button>
          {view.mode === 'traditional' && <Button className="col-span-2" variant="secondary" disabled={disabled || !view.canSpotOn} onClick={() => onAction({ type: 'spot_on' })}>Spot on · exact count</Button>}
        </div>
      )}
      {view.lastReveal && (view.phase === 'reveal' || view.phase === 'finished') && <section role="status" className="rounded-2xl border border-[#d1af68]/30 bg-[#241c15] p-5 text-center" aria-label="Dice reveal">
        <p className="text-sm font-bold text-[#e5bd72]">{view.lastReveal.kind === 'spot_on' ? 'Spot on' : 'Challenge'} · {view.lastReveal.actual} matching dice</p>
        <p className="mt-2 text-sm text-white/75">{view.lastResolution}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{Object.entries(view.lastReveal.dice).map(([id, dice]) => <div key={id}><p className="mb-2 truncate text-xs font-bold">{playerName(id)}</p><div className="flex flex-wrap justify-center gap-1">{dice.map((die, index) => <LiarDie key={index} value={die} label={`${playerName(id)} revealed die ${index + 1}: ${die}`} />)}</div></div>)}</div>
        {view.phase === 'reveal' && <p className="mt-4 text-xs text-white/55">All surviving players keep five dice. A new round starts in a few seconds.</p>}
        {view.phase === 'reveal' && view.youId === view.hostId && <Button className="mt-4" variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'next_liars_dice_round' })}>Next round</Button>}
      </section>}
      {view.phase === 'reveal' && !view.lastReveal && <section role="status" className="rounded-2xl border border-[#d1af68]/30 bg-[#241c15] p-5 text-center">
        <p className="text-sm text-white/80">{view.lastResolution}</p>
        <p className="mt-3 text-xs text-white/55">A fresh round starts in a few seconds.</p>
        {view.youId === view.hostId && <Button className="mt-4" variant="secondary" disabled={disabled} onClick={() => onAction({ type: 'next_liars_dice_round' })}>Next round</Button>}
      </section>}
    </div>
  );
}

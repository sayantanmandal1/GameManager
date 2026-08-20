'use client';

import { Button } from '@/components/ui/Button';
import type { CeeLoAction, CeeLoPlayerView, CeeLoRoll } from '@/shared';

interface Props { view: CeeLoPlayerView; disabled: boolean; onAction: (action: CeeLoAction) => void }

function RollDisplay({ roll, label }: Readonly<{ roll: CeeLoRoll | null; label: string }>) {
  const slots = roll ? [
    { key: 'left', value: roll.dice[0] },
    { key: 'center', value: roll.dice[1] },
    { key: 'right', value: roll.dice[2] },
  ] : [];
  return <div className="text-center"><p className="mb-2 text-xs font-bold text-white/45">{label}</p><div className="flex min-h-16 justify-center gap-2">{roll ? slots.map((slot) => <span key={slot.key} className="flex h-16 w-16 items-center justify-center border border-black/20 bg-[#f5f1e7] text-3xl font-black text-[#29281d] shadow-lg">{slot.value}</span>) : <span className="py-5 text-white/35">Waiting</span>}</div>{roll && <p className="mt-2 text-sm font-bold capitalize text-[#f3d45a]">{roll.category.replaceAll('_', ' ')}</p>}</div>;
}

export function CeeLoRenderer({ view, disabled, onAction }: Readonly<Props>) {
  return (
    <div className="w-full max-w-[48rem]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="flex justify-between border-b border-white/10 px-3 py-2"><span className="truncate font-bold">{player.name}{player.id === view.bankerId ? ' · Banker' : ''}</span><span>{view.scores[player.id]}</span></div>)}</div>
      <div className="mt-8 grid gap-8 sm:grid-cols-2"><RollDisplay roll={view.bankerRoll} label="BANKER" /><RollDisplay roll={view.challengerRolls[view.currentTurnId] ?? null} label="CURRENT CHALLENGER" /></div>
      <div className="mt-7 flex justify-center"><Button disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'roll_ceelo' })}>Roll qualifying hand</Button></div>
      <p className="mt-4 text-center text-sm text-white/50">Round {view.currentRound} of {view.roundsToPlay}</p>
    </div>
  );
}
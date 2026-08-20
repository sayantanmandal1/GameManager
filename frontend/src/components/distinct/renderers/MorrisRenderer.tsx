'use client';

import { useState } from 'react';
import type { MorrisAction, MorrisPlayerView } from '@/shared';

interface Props { view: MorrisPlayerView; disabled: boolean; onAction: (action: MorrisAction) => void }

const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [5, 5], [50, 5], [95, 5], [20, 20], [50, 20], [80, 20], [35, 35], [50, 35], [65, 35],
  [5, 50], [20, 50], [35, 50], [65, 50], [80, 50], [95, 50], [35, 65], [50, 65], [65, 65],
  [20, 80], [50, 80], [80, 80], [5, 95], [50, 95], [95, 95],
];

export function MorrisRenderer({ view, disabled, onAction }: Readonly<Props>) {
  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const legalDestinations = selectedFrom === null ? [] : view.legalMoves.filter((move) => move.from === selectedFrom).map((move) => move.to);
  const selectNode = (node: number) => {
    if (view.phase === 'placement') return onAction({ type: 'place_stone', node });
    if (view.phase === 'removing') return onAction({ type: 'remove_stone', node });
    if (selectedFrom !== null && legalDestinations.includes(node)) {
      onAction({ type: 'move_stone', from: selectedFrom, to: node });
      setSelectedFrom(null);
    } else if (view.board[node] === view.youId) setSelectedFrom(node);
  };
  const legalNode = (node: number) => {
    if (view.phase === 'placement') return view.legalPlacements.includes(node);
    if (view.phase === 'removing') return view.removableNodes.includes(node);
    return view.board[node] === view.youId || legalDestinations.includes(node);
  };
  const instruction = view.phase === 'placement' ? 'Place a stone' : morrisMoveInstruction(view);
  return (
    <div className="w-full max-w-[39rem]">
      <div className="relative mx-auto aspect-square w-full max-w-[36rem] border border-white/10 bg-[#d9c18e] shadow-2xl" aria-label="Nine Men's Morris board">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full stroke-[#352b1c]" fill="none" strokeWidth="1.2"><rect x="5" y="5" width="90" height="90" /><rect x="20" y="20" width="60" height="60" /><rect x="35" y="35" width="30" height="30" /><path d="M50 5V35 M50 65V95 M5 50H35 M65 50H95" /></svg>
        {view.board.map((owner, node) => {
          const [left, top] = POSITIONS[node];
          const ownerIndex = view.players.findIndex((player) => player.id === owner);
          const nodeKey = `morris-node-${node + 1}`;
          const ownerName = owner ? view.players[ownerIndex]?.name : null;
          return <button key={nodeKey} type="button" disabled={disabled || !view.canAct || !legalNode(node)} onClick={() => selectNode(node)} aria-label={`Node ${node + 1}, ${ownerName ?? 'empty'}`} aria-pressed={selectedFrom === node} className={`absolute h-[clamp(1.4rem,5vw,2.5rem)] w-[clamp(1.4rem,5vw,2.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg ${morrisNodeTone(ownerIndex, legalDestinations.includes(node))} ${selectedFrom === node ? 'outline outline-4 outline-[#f16b76]' : ''} disabled:opacity-100`} style={{ left: `${left}%`, top: `${top}%` }} />;
        })}
      </div>
      <p className="mt-4 text-center text-sm text-white/55">{instruction}</p>
    </div>
  );
}

function morrisNodeTone(ownerIndex: number, legalDestination: boolean): string {
  if (ownerIndex === 0) return 'border-[#24221c] bg-[#f2eee0]';
  if (ownerIndex === 1) return 'border-[#eee2c8] bg-[#2c2922]';
  if (legalDestination) return 'border-[#f16b76] bg-[#f16b76]/30';
  return 'border-[#3f3322] bg-[#bda06f]';
}

function morrisMoveInstruction(view: MorrisPlayerView): string {
  if (view.phase === 'removing') return 'Remove a legal opponent stone';
  return view.canFly ? 'Move anywhere: three stones can fly' : 'Move to an adjacent node';
}
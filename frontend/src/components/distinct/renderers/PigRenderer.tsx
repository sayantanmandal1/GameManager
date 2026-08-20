import { Button } from '@/components/ui/Button';
import type { PigAction, PigPlayerView } from '@/shared';

interface PigRendererProps {
  view: PigPlayerView;
  disabled: boolean;
  onAction: (action: PigAction) => void;
}

const DIE_FACES: Record<number, string> = {
  1: '\u2680',
  2: '\u2681',
  3: '\u2682',
  4: '\u2683',
  5: '\u2684',
  6: '\u2685',
};

export function PigRenderer({ view, disabled, onAction }: PigRendererProps) {
  return (
    <div className="w-full max-w-[42rem]">
      <div className="grid grid-cols-2 gap-3">
        {view.players.map((player) => (
          <div key={player.id} className={`border-b-4 px-3 py-4 ${player.id === view.currentTurnId && view.phase === 'playing' ? 'border-[#f09b57] bg-white/5' : 'border-white/10'}`}>
            <p className="truncate text-sm font-bold text-game-muted">{player.name}{player.id === view.youId ? ' (you)' : ''}</p>
            <p className="mt-1 text-4xl font-black text-white">{view.scores[player.id]}</p>
            <p className="text-xs text-game-muted">of {view.targetScore}</p>
          </div>
        ))}
      </div>
      <div className="flex min-h-72 flex-col items-center justify-center py-8">
        <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-white/15 bg-[#f4f1e8] text-8xl leading-none text-[#221a15] shadow-2xl shadow-black/30" aria-label={view.lastRoll ? `Last roll ${view.lastRoll}` : 'No roll yet'}>
          {view.lastRoll ? DIE_FACES[view.lastRoll] : '?'}
        </div>
        <p className="mt-5 text-xs font-bold text-game-muted">TURN TOTAL</p>
        <p className="text-5xl font-black text-[#f09b57]">{view.turnTotal}</p>
        <div className="mt-6 flex gap-3">
          <Button disabled={disabled || !view.canRoll} onClick={() => onAction({ type: 'roll' })}>Roll</Button>
          <Button variant="secondary" disabled={disabled || !view.canHold} onClick={() => onAction({ type: 'hold' })}>Hold</Button>
        </div>
      </div>
    </div>
  );
}
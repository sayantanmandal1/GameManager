import type { MancalaPlayerView } from '@/shared';

interface MancalaRendererProps {
  view: MancalaPlayerView;
  disabled: boolean;
  onSow: (pit: number) => void;
}

export function MancalaRenderer({ view, disabled, onSow }: MancalaRendererProps) {
  const ownSide = view.yourSide ?? 0;
  const opponentSide = ownSide === 0 ? 1 : 0;
  const legal = new Set(view.legalPits);

  return (
    <div className="w-full max-w-[52rem] overflow-x-auto pb-2">
      <div className="grid min-w-[42rem] grid-cols-[5.5rem_repeat(6,minmax(4.5rem,1fr))_5.5rem] grid-rows-2 gap-3 rounded-lg border border-[#e2b96f]/35 bg-[#5b3c25] p-4 shadow-2xl shadow-black/30">
        <div className="row-span-2 flex items-center justify-center rounded-[2rem] border-2 border-black/20 bg-[#be8150] text-3xl font-black text-[#24170f] shadow-inner">
          {view.stores[opponentSide]}
        </div>
        {[...view.pits[opponentSide]].reverse().map((stones, reversePit) => (
          <div key={reversePit} className="flex min-h-24 items-center justify-center rounded-full border-2 border-black/20 bg-[#c98e5b] text-2xl font-black text-[#28180f] shadow-inner">
            {stones}
          </div>
        ))}
        <div className="row-span-2 flex items-center justify-center rounded-[2rem] border-2 border-black/20 bg-[#d29a66] text-3xl font-black text-[#24170f] shadow-inner">
          {view.stores[ownSide]}
        </div>
        {view.pits[ownSide].map((stones, pit) => {
          const enabled = view.canAct && legal.has(pit) && !disabled;
          return (
            <button
              key={pit}
              type="button"
              disabled={!enabled}
              onClick={() => onSow(pit)}
              aria-label={`Sow pit ${pit + 1} with ${stones} stones`}
              className="flex min-h-24 items-center justify-center rounded-full border-2 border-[#f0c987]/45 bg-[#d8a46d] text-2xl font-black text-[#28180f] shadow-inner transition-transform enabled:hover:-translate-y-1 disabled:cursor-default"
            >
              {stones}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex min-w-[42rem] justify-between px-7 text-xs font-bold text-game-muted">
        <span>{view.players[opponentSide].name}</span>
        <span>{view.players[ownSide].name} (you)</span>
      </div>
    </div>
  );
}
import type { ReversiPlayerView } from '@/shared';

interface ReversiRendererProps {
  view: ReversiPlayerView;
  disabled: boolean;
  onMove: (cell: number) => void;
}

export function ReversiRenderer({ view, disabled, onMove }: ReversiRendererProps) {
  const legalMoves = new Set(view.legalMoves);

  return (
    <div className="w-full max-w-[38rem]">
      <div className="mb-3 flex items-center justify-center gap-5 text-sm font-bold text-white/80">
        <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[#101512] ring-1 ring-white/35" />{view.scores.black}</span>
        <span className="text-xs text-game-muted">DISCS</span>
        <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[#f4f1e8]" />{view.scores.white}</span>
      </div>
      <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-lg border-4 border-[#17251f] bg-[#2f8a5d] shadow-2xl shadow-black/30">
        {view.board.map((disc, cell) => {
          const legal = view.canAct && legalMoves.has(cell) && !disabled;
          return (
            <button
              key={cell}
              type="button"
              disabled={!legal}
              onClick={() => onMove(cell)}
              aria-label={legal ? `Place disc on row ${Math.floor(cell / 8) + 1}, column ${(cell % 8) + 1}` : `Row ${Math.floor(cell / 8) + 1}, column ${(cell % 8) + 1}`}
              className="relative flex aspect-square items-center justify-center border border-[#1f6845] bg-[#329365] disabled:cursor-default"
            >
              {legal && <span className="absolute h-3 w-3 rounded-full bg-white/45" />}
              {disc && (
                <span className={`h-[72%] w-[72%] rounded-full shadow-lg ${disc === 'black' ? 'bg-[#101512] ring-1 ring-white/20' : 'bg-[#f4f1e8] ring-1 ring-black/20'}`} />
              )}
            </button>
          );
        })}
      </div>
      {view.consecutivePasses > 0 && <p className="mt-3 text-center text-sm font-semibold text-game-sun">Opponent passed. Move again.</p>}
    </div>
  );
}
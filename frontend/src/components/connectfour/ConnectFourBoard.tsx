import {
  CONNECT_FOUR_COLUMNS,
  type ConnectFourCell,
} from '@/shared';

interface ConnectFourBoardProps {
  board: ConnectFourCell[];
  validColumns: number[];
  winningCells?: number[] | null;
  lastMoveIndex?: number | null;
  canAct: boolean;
  onDrop: (column: number) => void;
}

export function ConnectFourBoard({
  board,
  validColumns,
  winningCells,
  lastMoveIndex,
  canAct,
  onDrop,
}: ConnectFourBoardProps) {
  return (
    <div className="w-full max-w-[43rem]">
      <div className="mb-2 grid grid-cols-7 gap-1.5 px-2 sm:gap-2 sm:px-3">
        {Array.from({ length: CONNECT_FOUR_COLUMNS }, (_, column) => {
          const enabled = canAct && validColumns.includes(column);
          return (
            <button
              key={column}
              type="button"
              aria-label={`Drop disc in column ${column + 1}`}
              disabled={!enabled}
              onClick={() => onDrop(column)}
              className="flex aspect-square items-center justify-center rounded-md text-xl font-black text-game-sun transition-colors enabled:hover:bg-white/10 disabled:text-white/15"
            >
              ↓
            </button>
          );
        })}
      </div>
      <div
        role="grid"
        aria-label="Connect Four board"
        className="grid aspect-[7/6] grid-cols-7 gap-1.5 rounded-lg border border-[#72a6ff] bg-[#315fbd] p-2 shadow-2xl shadow-black/35 sm:gap-2 sm:p-3"
      >
        {board.map((disc, index) => {
          const winning = winningCells?.includes(index) ?? false;
          const last = lastMoveIndex === index;
          return (
            <div
              key={index}
              role="gridcell"
              aria-label={disc ? `${disc} disc` : 'empty'}
              className={`relative aspect-square rounded-full border-2 shadow-inner ${
                disc === 'red'
                  ? 'border-[#ff9b87] bg-[#f35f4a]'
                  : disc === 'yellow'
                    ? 'border-[#ffe388] bg-[#f2c94c]'
                    : 'border-[#254d9e] bg-[#13241f]'
              } ${winning ? 'ring-4 ring-white' : last ? 'ring-2 ring-white/60' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}
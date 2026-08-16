import type { TicTacToeCell, TicTacToeMark } from '@/shared';

interface TicTacToeBoardProps {
  board: TicTacToeCell[];
  winningLine?: number[] | null;
  selectedFrom?: number | null;
  disabled?: boolean;
  onCellClick: (index: number) => void;
}

const MARK_STYLES: Record<TicTacToeMark, string> = {
  X: 'text-[#ff795f]',
  O: 'text-[#63d5a4]',
};

export function TicTacToeBoard({
  board,
  winningLine,
  selectedFrom,
  disabled,
  onCellClick,
}: TicTacToeBoardProps) {
  return (
    <div
      role="grid"
      aria-label="Tic Tac Toe board"
      className="grid aspect-square w-full max-w-[34rem] grid-cols-3 gap-2 rounded-lg bg-[#0d1715] p-2 shadow-2xl shadow-black/35 sm:gap-3 sm:p-3"
    >
      {board.map((mark, index) => {
        const isWinner = winningLine?.includes(index) ?? false;
        const isSelected = selectedFrom === index;
        return (
          <button
            key={index}
            type="button"
            role="gridcell"
            aria-label={`Cell ${index + 1}${mark ? `, ${mark}` : ', empty'}`}
            disabled={disabled}
            onClick={() => onCellClick(index)}
            className={`flex aspect-square min-h-0 items-center justify-center rounded-md border text-5xl font-black transition-colors sm:text-7xl ${
              isSelected
                ? 'border-game-sun bg-game-sun/15'
                : isWinner
                  ? 'border-game-mint bg-game-mint/15'
                  : 'border-white/10 bg-[#1b2925] hover:border-white/25 hover:bg-[#22332e]'
            } ${mark ? MARK_STYLES[mark] : 'text-transparent'}`}
          >
            {mark ?? '·'}
          </button>
        );
      })}
    </div>
  );
}
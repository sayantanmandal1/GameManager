interface SudokuBoardProps {
  puzzle: string;
  solution: string;
  values: number[];
  notes: Record<number, number[]>;
  selected: number | null;
  paused: boolean;
  onSelect: (index: number) => void;
}

export function SudokuBoard({
  puzzle,
  solution,
  values,
  notes,
  selected,
  paused,
  onSelect,
}: SudokuBoardProps) {
  const selectedValue = selected === null ? 0 : values[selected];
  return (
    <div className="relative aspect-square w-full max-w-[38rem] overflow-hidden rounded-md border-2 border-[#c9d8d2] bg-[#f4f1e8] shadow-2xl shadow-black/25">
      <div role="grid" aria-label="Sudoku board" className="grid h-full w-full grid-cols-9">
        {values.map((value, index) => {
          const row = Math.floor(index / 9);
          const column = index % 9;
          const given = puzzle[index] !== '-';
          const isSelected = selected === index;
          const peer = selected !== null && isPeer(selected, index);
          const sameValue = selectedValue !== 0 && value === selectedValue;
          const incorrect = value !== 0 && value !== Number(solution[index]);
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={`Row ${row + 1}, column ${column + 1}${value ? `, ${value}` : ', empty'}`}
              onClick={() => onSelect(index)}
              className={`relative flex min-h-0 items-center justify-center border-b border-r border-[#b8c5c0] text-xl font-semibold sm:text-3xl ${
                isSelected
                  ? 'bg-[#f2c94c] text-[#17201a]'
                  : sameValue
                    ? 'bg-[#cbe9dc]'
                    : peer
                      ? 'bg-[#e4e9e4]'
                      : 'bg-[#f8f6ef]'
              } ${given ? 'font-black text-[#17201a]' : incorrect ? 'text-[#d9473f]' : 'text-[#2673bb]'}`}
              style={{
                borderRightWidth: column === 2 || column === 5 ? 3 : column === 8 ? 0 : 1,
                borderBottomWidth: row === 2 || row === 5 ? 3 : row === 8 ? 0 : 1,
              }}
            >
              {value || notes[index]?.length ? (
                value || (
                  <span className="grid h-full w-full grid-cols-3 p-0.5 text-[8px] font-semibold leading-none text-[#53665e] sm:text-xs">
                    {Array.from({ length: 9 }, (_, noteIndex) => (
                      <span key={noteIndex} className="flex items-center justify-center">
                        {notes[index]?.includes(noteIndex + 1) ? noteIndex + 1 : ''}
                      </span>
                    ))}
                  </span>
                )
              ) : null}
            </button>
          );
        })}
      </div>
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#17201a]/95">
          <p className="font-display text-xl font-bold text-white">Game paused</p>
        </div>
      )}
    </div>
  );
}

function isPeer(selected: number, candidate: number): boolean {
  const selectedRow = Math.floor(selected / 9);
  const selectedColumn = selected % 9;
  const row = Math.floor(candidate / 9);
  const column = candidate % 9;
  return (
    selectedRow === row ||
    selectedColumn === column ||
    (Math.floor(selectedRow / 3) === Math.floor(row / 3) &&
      Math.floor(selectedColumn / 3) === Math.floor(column / 3))
  );
}
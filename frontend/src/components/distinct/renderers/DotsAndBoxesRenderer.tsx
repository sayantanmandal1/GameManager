import type { DotsAndBoxesAction, DotsAndBoxesPlayerView } from '@/shared';

interface DotsAndBoxesRendererProps {
  view: DotsAndBoxesPlayerView;
  disabled: boolean;
  onDraw: (action: DotsAndBoxesAction) => void;
}

export function DotsAndBoxesRenderer({ view, disabled, onDraw }: DotsAndBoxesRendererProps) {
  const legal = new Set(
    view.legalEdges.map((edge) => `${edge.orientation}:${edge.row}:${edge.column}`),
  );
  const colors = ['#ef6a67', '#65c9d4'];

  return (
    <div data-fit-board className="grid aspect-square w-full max-w-[38rem] grid-cols-[repeat(9,minmax(0,1fr))] grid-rows-[repeat(9,minmax(0,1fr))] rounded-lg bg-[#efe9da] p-3 shadow-2xl shadow-black/30">
      {Array.from({ length: 81 }, (_, index) => {
        const gridRow = Math.floor(index / 9);
        const gridColumn = index % 9;
        if (gridRow % 2 === 0 && gridColumn % 2 === 0) {
          return <div key={index} className="z-10 m-auto h-3 w-3 rounded-full bg-[#18201c] sm:h-4 sm:w-4" />;
        }
        if (gridRow % 2 === 0) {
          const row = gridRow / 2;
          const column = (gridColumn - 1) / 2;
          const drawn = view.horizontalEdges[row][column];
          const enabled = view.canAct && legal.has(`horizontal:${row}:${column}`) && !disabled;
          return (
            <button key={index} type="button" disabled={!enabled} onClick={() => onDraw({ orientation: 'horizontal', row, column })} aria-label={`Draw horizontal edge ${row + 1}, ${column + 1}`} className="flex h-full w-full items-center disabled:cursor-default enabled:hover:[&>span]:bg-[#65c9d4]">
              <span aria-hidden="true" className={`h-2 w-full rounded-sm ${drawn ? 'bg-[#18201c]' : enabled ? 'bg-[#18201c]/20' : 'bg-black/10'}`} />
            </button>
          );
        }
        if (gridColumn % 2 === 0) {
          const row = (gridRow - 1) / 2;
          const column = gridColumn / 2;
          const drawn = view.verticalEdges[row][column];
          const enabled = view.canAct && legal.has(`vertical:${row}:${column}`) && !disabled;
          return (
            <button key={index} type="button" disabled={!enabled} onClick={() => onDraw({ orientation: 'vertical', row, column })} aria-label={`Draw vertical edge ${row + 1}, ${column + 1}`} className="flex h-full w-full justify-center disabled:cursor-default enabled:hover:[&>span]:bg-[#65c9d4]">
              <span aria-hidden="true" className={`h-full w-2 rounded-sm ${drawn ? 'bg-[#18201c]' : enabled ? 'bg-[#18201c]/20' : 'bg-black/10'}`} />
            </button>
          );
        }
        const row = (gridRow - 1) / 2;
        const column = (gridColumn - 1) / 2;
        const owner = view.boxes[row][column];
        const ownerIndex = view.players.findIndex((player) => player.id === owner);
        return (
          <div key={index} className="m-1 flex items-center justify-center rounded-sm text-sm font-black text-[#15201b]" style={{ backgroundColor: ownerIndex >= 0 ? colors[ownerIndex] : 'transparent' }}>
            {ownerIndex >= 0 ? view.players[ownerIndex].name.slice(0, 1).toUpperCase() : ''}
          </div>
        );
      })}
    </div>
  );
}
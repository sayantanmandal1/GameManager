'use client';

import type { ArcadeAction, ArcadePlayerView } from '@/shared';
import { Button } from '@/components/ui/Button';

interface ArcadeBoardProps {
  view: ArcadePlayerView;
  onAction: (action: ArcadeAction) => void;
}

const PLAYER_COLORS = ['#ff795f', '#63d5a4', '#65aaf6', '#f2c94c'];

const MEMORY_FACES: Record<string, string[]> = {
  animals: ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁'],
  shapes: ['●', '■', '▲', '◆', '★', '⬟'],
  food: ['🍎', '🍌', '🍇', '🍓', '🥕', '🍕', '🍪', '🥨'],
  space: ['🌍', '🌙', '☀️', '🪐', '🚀', '🛰️', '☄️', '👩‍🚀'],
  flags: ['🇮🇳', '🇯🇵', '🇧🇷', '🇨🇦', '🇫🇷', '🇩🇪', '🇰🇷', '🇿🇦', '🇲🇽', '🇦🇺'],
  sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🏆'],
  music: ['🎵', '🎸', '🎹', '🥁', '🎺', '🎻', '🎷', '🪕', '🎤', '🎧', '📻', '🎼'],
  travel: ['✈️', '🚆', '🚢', '🚕', '🚌', '🚲', '🏕️', '🏖️', '🗼', '🏰', '🗺️', '🧳'],
  nature: ['🌳', '🌲', '🌵', '🍀', '🌻', '🌹', '🍁', '🍄', '⛰️', '🌋', '🌈', '❄️', '🌊', '🔥'],
  tech: ['💻', '📱', '⌚', '📷', '🎮', '🕹️', '💾', '💿', '🔋', '💡', '📡', '🤖', '🖨️', '🧭'],
  ocean: ['🐳', '🐬', '🦈', '🐙', '🦀', '🦞', '🐠', '🐡', '🪼', '🦭', '🐚', '🪸', '⛵', '⚓', '🏝️', '🌊'],
  garden: ['🌷', '🌺', '🌸', '🌼', '🪻', '🌿', '☘️', '🪴', '🐝', '🦋', '🐞', '🐌', '🍓', '🥕', '🍅', '🌱'],
  symbols: ['☯', '☮', '♠', '♥', '♦', '♣', '♜', '♞', '⚛', '⚙', '✦', '✿', '∞', '§', '¶', '∆', 'Ω', '∑'],
  master: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  sprint: ['1', '2', '3', '4', '5'],
};

function memoryFace(value: string): string {
  const separator = value.lastIndexOf('-');
  const theme = value.slice(0, separator);
  const index = Number(value.slice(separator + 1)) - 1;
  return MEMORY_FACES[theme]?.[index] ?? value.slice(separator + 1);
}

function AlignmentBoard({ view, onAction }: ArcadeBoardProps) {
  const game = view.alignment!;
  const cellSize = game.size >= 11 ? 'minmax(1.35rem, 1fr)' : 'minmax(2rem, 1fr)';
  return (
    <div
      data-arcade-family="alignment"
      className="grid w-full max-w-[42rem] gap-1 rounded-lg border border-white/10 bg-black/20 p-2"
      style={{ gridTemplateColumns: `repeat(${game.size}, ${cellSize})` }}
    >
      {game.board.map((ownerId, index) => {
        const playerIndex = view.players.findIndex((player) => player.id === ownerId);
        return (
          <button
            key={index}
            type="button"
            aria-label={`Cell ${index + 1}${ownerId ? ` occupied by ${view.players[playerIndex]?.name}` : ''}`}
            disabled={!view.canAct || (!game.gravity && !!ownerId)}
            onClick={() => onAction({ type: 'place', index })}
            className="aspect-square min-w-0 rounded border border-white/10 bg-white/[0.04] transition enabled:hover:border-white/35 enabled:hover:bg-white/[0.08] disabled:cursor-default"
          >
            {ownerId && (
              <span
                className="mx-auto block h-[58%] w-[58%] rounded-full border-2 border-white/40"
                style={{ backgroundColor: PLAYER_COLORS[playerIndex] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function TakeawayBoard({ view, onAction }: ArcadeBoardProps) {
  const game = view.takeaway!;
  return (
    <div data-arcade-family="takeaway" className="w-full max-w-2xl space-y-3">
      {game.heaps.map((heap, heapIndex) => {
        const maximum = Math.min(heap, game.maxTake || heap);
        return (
          <section key={heapIndex} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold">Pile {heapIndex + 1}</h3>
              <span className="font-mono text-2xl font-black text-game-sun">{heap}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maximum }, (_, index) => index + 1).map((count) => (
                <Button
                  key={count}
                  size="sm"
                  variant="secondary"
                  disabled={!view.canAct}
                  onClick={() => onAction({ type: 'take', heap: heapIndex, count })}
                >
                  Take {count}
                </Button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RaceBoard({ view, onAction }: ArcadeBoardProps) {
  const game = view.race!;
  return (
    <div data-arcade-family="race" className="w-full max-w-3xl space-y-4">
      <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        {view.players.map((player, index) => {
          const position = game.positions[player.id] ?? 0;
          return (
            <div key={player.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{player.name}</span>
                <span className="font-mono text-game-muted">{position}/{game.boardSize}</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${(position / game.boardSize) * 100}%`, backgroundColor: PLAYER_COLORS[index] }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {game.lastRoll && (
        <p className="text-center text-sm text-game-muted">
          {view.players.find((player) => player.id === game.lastRoll!.playerId)?.name} rolled{' '}
          <strong className="text-white">{game.lastRoll.value}</strong>
        </p>
      )}
      <div className="text-center">
        <Button disabled={!view.canAct} onClick={() => onAction({ type: 'roll' })}>
          Roll d{game.dieSides}
        </Button>
      </div>
    </div>
  );
}

function MemoryBoard({ view, onAction }: ArcadeBoardProps) {
  const game = view.memory!;
  const columns = game.tiles.length <= 12 ? 4 : game.tiles.length <= 24 ? 6 : 8;
  return (
    <div data-arcade-family="memory" className="w-full max-w-3xl">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {game.tiles.map((value, index) => {
          const ownerId = game.matchedBy[index];
          const ownerIndex = view.players.findIndex((player) => player.id === ownerId);
          return (
            <button
              key={index}
              type="button"
              aria-label={value ? `Tile ${index + 1}: ${value}` : `Hidden tile ${index + 1}`}
              disabled={!view.canAct || game.pendingContinue || !!ownerId || value !== null}
              onClick={() => onAction({ type: 'flip', index })}
              className="aspect-square min-w-0 overflow-hidden rounded-lg border border-white/12 bg-[#252d28] p-1 text-[clamp(0.55rem,2vw,0.8rem)] font-bold transition enabled:hover:border-game-mint/60"
              style={ownerId ? { borderColor: PLAYER_COLORS[ownerIndex], backgroundColor: `${PLAYER_COLORS[ownerIndex]}22` } : undefined}
            >
              <span className="block text-[clamp(0.8rem,4vw,1.5rem)]">{value ? memoryFace(value) : '?'}</span>
            </button>
          );
        })}
      </div>
      {game.pendingContinue && view.canAct && (
        <div className="mt-4 text-center">
          <Button onClick={() => onAction({ type: 'continue' })}>Hide pair and continue</Button>
        </div>
      )}
    </div>
  );
}

export function ArcadeBoard(props: ArcadeBoardProps) {
  if (props.view.alignment) return <AlignmentBoard {...props} />;
  if (props.view.takeaway) return <TakeawayBoard {...props} />;
  if (props.view.race) return <RaceBoard {...props} />;
  if (props.view.memory) return <MemoryBoard {...props} />;
  return <p role="alert" className="text-red-300">Unsupported arcade state</p>;
}

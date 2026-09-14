'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useMemo } from 'react';
import type { MonopolyBoardSpaceView, MonopolyPlayer } from '@/shared';

interface MonopolyBoardProps {
  readonly board: MonopolyBoardSpaceView[];
  readonly players?: MonopolyPlayer[];
  readonly selectedSpaceIndex?: number | null;
  readonly onSelectSpace?: (space: MonopolyBoardSpaceView) => void;
  readonly isSelectable?: (space: MonopolyBoardSpaceView) => boolean;
  readonly interactive?: boolean;
  readonly mode?: 'live' | 'preview';
  readonly lastRoll?: readonly [number, number] | null;
  readonly lastCardText?: string | null;
  readonly showAttribution?: boolean;
}

const BOARD_ART_URL = '/monopoly-classic-us-board.jpg';
const PREVIEW_ROLL = [5, 3] as const;
const DIE_PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function MonopolyBoard({
  board,
  players = [],
  selectedSpaceIndex = null,
  onSelectSpace,
  isSelectable,
  interactive = false,
  mode = 'live',
  lastRoll = null,
  lastCardText = null,
  showAttribution = true,
}: MonopolyBoardProps) {
  const reduceMotion = useReducedMotion();
  const isPreview = mode === 'preview';
  const visualRoll = lastRoll ?? (isPreview ? PREVIEW_ROLL : null);
  const tokensBySpace = useMemo(() => {
    const map = new Map<number, MonopolyPlayer[]>();
    for (const player of players) {
      const list = map.get(player.position) ?? [];
      list.push(player);
      map.set(player.position, list);
    }
    return map;
  }, [players]);

  return (
    <div
      data-monopoly-board-shell
      data-monopoly-board-mode={mode}
      className={`monopoly-board-shell relative mx-auto text-[#15110e] ${isPreview ? 'w-full max-w-[42rem]' : 'w-[clamp(46rem,64vw,64rem)] min-w-[46rem]'}`}
    >
      <div
        className="relative bg-[#2c1b12] p-[clamp(5px,0.8vw,12px)]"
        style={{ boxShadow: '0 2px 0 #6e4931, 0 7px 0 #1b0f0a, 0 24px 48px rgba(0,0,0,0.55)' }}
      >
        <div
          data-monopoly-board
          data-monopoly-board-shared="true"
          className="monopoly-board relative isolate grid aspect-square overflow-hidden border border-black bg-[#cfe3cf]"
          style={{
            gridTemplateColumns: '1.6fr repeat(9, minmax(0, 1fr)) 1.6fr',
            gridTemplateRows: '1.6fr repeat(9, minmax(0, 1fr)) 1.6fr',
          }}
        >
          <Image
            data-monopoly-board-art
            src={BOARD_ART_URL}
            alt="Classic United States Monopoly board artwork"
            fill
            priority={isPreview}
            sizes={isPreview ? '(max-width: 768px) 92vw, 42rem' : '(max-width: 1280px) 64rem, 64vw'}
            draggable={false}
            className="pointer-events-none z-0 select-none object-cover"
          />

          <span className="sr-only">MONOPOLY</span>
          <span className="sr-only">GO</span>
          <span className="sr-only">JUST VISITING</span>
          <span data-deck-zone="chest" aria-hidden="true" className="pointer-events-none absolute left-[16%] top-[15%] z-10 h-[24%] w-[24%]" />
          <span data-deck-zone="chance" aria-hidden="true" className="pointer-events-none absolute bottom-[14%] right-[15%] z-10 h-[24%] w-[24%]" />

          {board.map((space) => {
            const coord = boardCoordinate(space.index);
            const side = sideForIndex(space.index);
            const boardPlayers = tokensBySpace.get(space.index) ?? [];
            const selectable = interactive && !!onSelectSpace && (isSelectable ? isSelectable(space) : true);
            const selected = selectedSpaceIndex === space.index;
            const owner = space.ownerId ? players.find((player) => player.id === space.ownerId) ?? null : null;

            return (
              <button
                key={space.index}
                type="button"
                data-space-index={space.index}
                data-space-kind={space.kind}
                data-side={side}
                data-selected={selected ? 'true' : 'false'}
                aria-label={spaceAriaLabel(space, players)}
                aria-pressed={selectable ? selected : undefined}
                onClick={() => {
                  if (!selectable || !onSelectSpace) return;
                  onSelectSpace(space);
                }}
                disabled={!selectable}
                className={`relative z-20 min-h-0 min-w-0 overflow-visible border-0 bg-transparent p-0 outline-none transition-[background-color,box-shadow] duration-150 ${selectable ? 'cursor-pointer hover:bg-[#ffe06a]/20 focus-visible:z-50 focus-visible:shadow-[inset_0_0_0_4px_#fff,inset_0_0_0_7px_#111]' : 'cursor-default'} ${selected ? 'z-40 bg-[#ffe06a]/20 shadow-[inset_0_0_0_4px_#ffd43b,inset_0_0_0_7px_#19130d]' : ''}`}
                style={{
                  gridRowStart: coord.row + 1,
                  gridColumnStart: coord.col + 1,
                }}
              >
                <span className="sr-only">{space.name}</span>
                <span className="sr-only">{spaceSecondaryLabel(space)}</span>

                {owner && <OwnerMarker side={side} color={owner.originalColor} name={owner.name} />}

                {space.buildingCount > 0 && (
                  <BuildingPieces count={space.buildingCount} side={side} />
                )}

                {!isPreview && space.mortgaged && (
                  <span
                    data-space-mortgaged
                    className="absolute inset-[12%] z-30 flex -rotate-6 items-center justify-center border-2 border-[#981d19] bg-[#fff6df]/95 px-1 text-[8px] font-black uppercase leading-none text-[#981d19] shadow-md"
                  >
                    Mortgaged
                  </span>
                )}

                {boardPlayers.length > 0 && (
                  <div data-token-track className="absolute inset-[8%] z-40 flex flex-wrap content-center items-center justify-center gap-1">
                    {boardPlayers.map((player) => (
                      <PlayerToken key={player.id} player={player} reduceMotion={!!reduceMotion} compact={isPreview} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}

          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-black/10" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-black/10" />

          {visualRoll && (
            <DiceTray
              roll={visualRoll}
              rollKey={lastRoll ? `${lastRoll[0]}-${lastRoll[1]}` : 'preview'}
              reduceMotion={!!reduceMotion}
              compact={isPreview}
              decorative={!lastRoll}
            />
          )}

          <AnimatePresence initial={false}>
            {lastCardText && (
              <motion.div
                key={lastCardText}
                data-last-card
                initial={reduceMotion ? false : { opacity: 0, y: 18, rotate: -10, scale: 0.88 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0, rotate: -6, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -12, rotate: 4, scale: 0.9 }}
                transition={{ duration: 0.36, ease: 'easeOut' }}
                className={`pointer-events-none absolute bottom-[17%] left-[17%] z-50 w-[27%] border-2 border-black px-[3%] py-[2.2%] text-center shadow-[5px_7px_0_rgba(0,0,0,0.24)] ${lastCardText.toLowerCase().includes('chance') ? 'bg-[#f3a044]' : 'bg-[#86bce3]'}`}
              >
                <p className="text-[clamp(7px,0.75vw,11px)] font-black uppercase">Last draw</p>
                <p className="mt-1 text-[clamp(6px,0.65vw,10px)] font-bold leading-tight">{lastCardText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.22),inset_0_0_28px_rgba(20,35,24,0.14)]" />
        </div>
      </div>

      {showAttribution && (
        <p className="mt-3 text-center text-[10px] font-medium leading-relaxed text-[#cbc0ad]" data-monopoly-attribution>
          MONOPOLY names, board artwork, trade dress, and Mr. Monopoly character are owned by Hasbro and reproduced under permission represented by the project owner.
        </p>
      )}
    </div>
  );
}

function OwnerMarker({ side, color, name }: Readonly<{ side: BoardSide; color: string; name: string }>) {
  return (
    <span
      data-space-owner={name}
      aria-hidden="true"
      className={`pointer-events-none absolute z-20 ${ownerMarkerPlacement(side)}`}
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.72), 0 0 8px ${color}`,
      }}
    />
  );
}

function BuildingPieces({ count, side }: Readonly<{ count: number; side: BoardSide }>) {
  const hotel = count === 5;
  const pieces = hotel ? 1 : Math.min(4, count);

  return (
    <span data-building-count={count} aria-label={hotel ? 'Hotel' : `${pieces} houses`} className={`pointer-events-none absolute z-30 flex ${buildingPlacement(side)}`}>
      {Array.from({ length: pieces }, (_, index) => (
        hotel ? (
          <span key="hotel" className="relative block h-[11px] w-[17px] border border-[#641410] bg-[#c52e28] shadow-[1px_2px_2px_rgba(0,0,0,0.45)]">
            <span className="absolute -top-[4px] left-[2px] h-[5px] w-[13px] bg-[#e04b40] [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
          </span>
        ) : (
          <span key={`house-${index}`} className="relative block h-[8px] w-[10px] border border-[#0c5524] bg-[#119b48] shadow-[1px_2px_2px_rgba(0,0,0,0.4)]">
            <span className="absolute -top-[4px] -left-px h-[5px] w-[10px] bg-[#24b85c] [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
          </span>
        )
      ))}
    </span>
  );
}

function PlayerToken({ player, reduceMotion, compact }: Readonly<{ player: MonopolyPlayer; reduceMotion: boolean; compact: boolean }>) {
  return (
    <motion.span
      layoutId={`monopoly-token-${player.id}`}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 28, mass: 0.72 }}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border-[3px] bg-[#bdc3c4] font-black text-black shadow-[0_2px_0_#555,0_5px_8px_rgba(0,0,0,0.65)] ${compact ? 'h-5 w-5 text-[10px]' : 'h-8 w-8 text-base'}`}
      style={{
        borderColor: player.originalColor,
        backgroundImage: 'linear-gradient(145deg, #ffffff 0%, #9da6a8 42%, #eef1f0 67%, #62696b 100%)',
      }}
      title={`${player.name} · ${tokenIdentity(player.originalToken)}`}
      aria-label={`${player.name} token ${tokenIdentity(player.originalToken)}`}
    >
      <span aria-hidden="true" className="select-none grayscale drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">{tokenSymbol(player.originalToken)}</span>
      <span
        aria-hidden="true"
        className="absolute -bottom-1.5 left-1/2 h-1 w-3/4 -translate-x-1/2 rounded-full opacity-75 blur-[2px]"
        style={{ backgroundColor: player.originalColor }}
      />
    </motion.span>
  );
}

function DiceTray({ roll, rollKey, reduceMotion, compact, decorative }: Readonly<{
  roll: readonly [number, number];
  rollKey: string;
  reduceMotion: boolean;
  compact: boolean;
  decorative: boolean;
}>) {
  return (
    <motion.div
      key={rollKey}
      data-last-roll
      aria-label={decorative ? `Decorative dice showing ${roll[0]} and ${roll[1]}` : `Last roll ${roll[0]} and ${roll[1]}`}
      initial={reduceMotion ? false : { scale: 0.72, rotate: -14, y: -12 }}
      animate={reduceMotion ? undefined : { scale: [0.92, 1.12, 1], rotate: [-12, 9, -3], y: [0, -7, 0] }}
      transition={{ duration: 0.52, ease: 'easeOut' }}
      className="pointer-events-none absolute bottom-[18%] left-[45%] z-50 flex -rotate-3 gap-1.5"
    >
      <DieFace value={roll[0]} compact={compact} />
      <DieFace value={roll[1]} compact={compact} />
    </motion.div>
  );
}

function DieFace({ value, compact }: Readonly<{ value: number; compact: boolean }>) {
  const pips = new Set(DIE_PIPS[value] ?? []);
  return (
    <span
      aria-hidden="true"
      className={`grid grid-cols-3 grid-rows-3 place-items-center rounded-md border-2 border-[#24211d] bg-[#fffdf5] p-[12%] shadow-[2px_3px_0_rgba(0,0,0,0.42)] ${compact ? 'h-7 w-7' : 'h-10 w-10'}`}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`aspect-square w-[56%] rounded-full bg-[#171411] ${pips.has(index) ? 'opacity-100' : 'opacity-0'}`} />
      ))}
    </span>
  );
}

function ownerMarkerPlacement(side: BoardSide): string {
  if (side === 'bottom') return 'inset-x-[8%] bottom-0 h-[5%]';
  if (side === 'top') return 'inset-x-[8%] top-0 h-[5%]';
  if (side === 'left') return 'inset-y-[8%] left-0 w-[5%]';
  if (side === 'right') return 'inset-y-[8%] right-0 w-[5%]';
  return 'hidden';
}

function buildingPlacement(side: BoardSide): string {
  if (side === 'bottom') return 'left-1/2 top-[2%] -translate-x-1/2 items-end gap-[2px]';
  if (side === 'top') return 'bottom-[2%] left-1/2 -translate-x-1/2 items-end gap-[2px]';
  if (side === 'left') return 'right-[2%] top-1/2 -translate-y-1/2 flex-col items-end gap-[2px]';
  if (side === 'right') return 'left-[2%] top-1/2 -translate-y-1/2 flex-col items-start gap-[2px]';
  return 'hidden';
}

function spaceSecondaryLabel(space: MonopolyBoardSpaceView): string {
  if (space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility') {
    return space.price === undefined ? '' : `$${space.price}`;
  }
  if (space.kind === 'tax') return `Pay $${space.amount ?? 0}`;
  if (space.kind === 'go') return 'Collect $200';
  if (space.kind === 'jail') return 'Visit';
  if (space.kind === 'free_parking') return 'Rest';
  if (space.kind === 'go_to_jail') return 'Move to jail';
  return '';
}

function isCorner(index: number): boolean {
  return index === 0 || index === 10 || index === 20 || index === 30;
}

function sideForIndex(index: number): BoardSide {
  if (isCorner(index)) return 'corner';
  if (index >= 1 && index <= 9) return 'bottom';
  if (index >= 11 && index <= 19) return 'left';
  if (index >= 21 && index <= 29) return 'top';
  return 'right';
}

type BoardSide = 'bottom' | 'left' | 'top' | 'right' | 'corner';

function boardCoordinate(index: number): { row: number; col: number } {
  if (index === 0) return { row: 10, col: 10 };
  if (index >= 1 && index <= 9) return { row: 10, col: 10 - index };
  if (index === 10) return { row: 10, col: 0 };
  if (index >= 11 && index <= 19) return { row: 10 - (index - 10), col: 0 };
  if (index === 20) return { row: 0, col: 0 };
  if (index >= 21 && index <= 29) return { row: 0, col: index - 20 };
  if (index === 30) return { row: 0, col: 10 };
  return { row: index - 30, col: 10 };
}

function spaceAriaLabel(space: MonopolyBoardSpaceView, players: MonopolyPlayer[]): string {
  const owner = space.ownerId ? `, owned by ${playerName(players, space.ownerId)}` : '';
  const detail = spaceSecondaryLabel(space);
  const detailSuffix = detail ? `, ${detail}` : '';
  return `Space ${space.index}: ${space.name}${detailSuffix}${owner}`;
}

function tokenIdentity(token: string): string {
  return token.replaceAll('_', ' ');
}

function tokenAbbrev(token: string): string {
  return token
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

function tokenSymbol(token: string): string {
  const symbols: Record<string, string> = {
    top_hat: '🎩',
    racecar: '🏎',
    battleship: '🚢',
    dog: '🐕',
  };
  return symbols[token] ?? tokenAbbrev(token);
}

function playerName(players: MonopolyPlayer[], playerId: string | null): string {
  if (!playerId) return 'Bank';
  return players.find((player) => player.id === playerId)?.name ?? 'Unknown';
}
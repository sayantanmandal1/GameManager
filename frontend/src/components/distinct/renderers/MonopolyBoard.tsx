'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MonopolyBoardSpaceView, MonopolyMovement, MonopolyPlayer } from '@/shared';
import { MonopolyDiceScene } from './MonopolyDiceScene';

interface MonopolyBoardProps {
  readonly board: MonopolyBoardSpaceView[];
  readonly players?: MonopolyPlayer[];
  readonly selectedSpaceIndex?: number | null;
  readonly onSelectSpace?: (space: MonopolyBoardSpaceView) => void;
  readonly isSelectable?: (space: MonopolyBoardSpaceView) => boolean;
  readonly interactive?: boolean;
  readonly mode?: 'live' | 'preview';
  readonly lastRoll?: readonly [number, number] | null;
  readonly rollSequence?: number;
  readonly diceRolling?: boolean;
  readonly lastMovement?: MonopolyMovement | null;
  readonly onMovementAnimationChange?: (moving: boolean) => void;
  readonly lastCardText?: string | null;
  readonly showAttribution?: boolean;
}

const BOARD_ART_URL = '/monopoly-classic-us-board.jpg';
const PREVIEW_ROLL = [5, 3] as const;
export function MonopolyBoard({
  board,
  players = [],
  selectedSpaceIndex = null,
  onSelectSpace,
  isSelectable,
  interactive = false,
  mode = 'live',
  lastRoll = null,
  rollSequence = 0,
  diceRolling = false,
  lastMovement = null,
  onMovementAnimationChange,
  lastCardText = null,
  showAttribution = true,
}: MonopolyBoardProps) {
  const reduceMotion = useReducedMotion();
  const isPreview = mode === 'preview';
  const visualRoll = lastRoll ?? (isPreview ? PREVIEW_ROLL : null);
  const [displayedPositions, setDisplayedPositions] = useState<Record<string, number>>(
    () => Object.fromEntries(players.map((player) => [player.id, player.position])),
  );
  const [movementAnnouncement, setMovementAnnouncement] = useState('');
  const processedMovementRef = useRef(lastMovement?.sequence ?? 0);
  const animatingPlayerRef = useRef<string | null>(null);
  const movementRef = useRef(lastMovement);
  const playersRef = useRef(players);
  const boardRef = useRef(board);
  const movementCallbackRef = useRef(onMovementAnimationChange);

  useEffect(() => {
    movementRef.current = lastMovement;
    playersRef.current = players;
    boardRef.current = board;
    movementCallbackRef.current = onMovementAnimationChange;
  }, [board, lastMovement, onMovementAnimationChange, players]);

  useEffect(() => {
    setDisplayedPositions((current) => {
      const next = { ...current };
      for (const player of players) {
        if (animatingPlayerRef.current !== player.id) next[player.id] = player.position;
      }
      return next;
    });
  }, [players]);

  useEffect(() => {
    const movement = movementRef.current;
    if (
      isPreview
      || !movement
      || movement.sequence <= processedMovementRef.current
    ) {
      return;
    }
    processedMovementRef.current = movement.sequence;
    const mover = playersRef.current.find((player) => player.id === movement.playerId);
    const route = movement.segments.flatMap((segment) => segment.path);
    if (!mover || route.length === 0 || reduceMotion) {
      setDisplayedPositions((current) => ({ ...current, [movement.playerId]: mover?.position ?? route.at(-1) ?? 0 }));
      movementCallbackRef.current?.(false);
      return;
    }

    let cancelled = false;
    const timers: Array<ReturnType<typeof globalThis.setTimeout>> = [];
    const start = movement.segments[0].from;
    const stepMs = Math.max(48, Math.min(135, Math.floor(1_350 / route.length)));
    const startDelayMs = movement.segments[0].kind === 'roll' ? 900 : 180;
    animatingPlayerRef.current = movement.playerId;
    setDisplayedPositions((current) => ({ ...current, [movement.playerId]: start }));
    movementCallbackRef.current?.(true);

    route.forEach((position, index) => {
      const timer = globalThis.setTimeout(() => {
        if (cancelled) return;
        setDisplayedPositions((current) => ({ ...current, [movement.playerId]: position }));
        if (index === route.length - 1) {
          animatingPlayerRef.current = null;
          setMovementAnnouncement(`${mover.name} moved to ${boardRef.current[position]?.name ?? `space ${position}`}`);
          movementCallbackRef.current?.(false);
        }
      }, startDelayMs + stepMs * (index + 1));
      timers.push(timer);
    });

    return () => {
      cancelled = true;
      for (const timer of timers) globalThis.clearTimeout(timer);
      const finalPosition = route.at(-1);
      if (finalPosition !== undefined) {
        setDisplayedPositions((current) => ({ ...current, [movement.playerId]: finalPosition }));
      }
      animatingPlayerRef.current = null;
      movementCallbackRef.current?.(false);
    };
  }, [isPreview, lastMovement?.sequence, reduceMotion]);

  const tokensBySpace = useMemo(() => {
    const map = new Map<number, MonopolyPlayer[]>();
    for (const player of players) {
      const displayedPosition = displayedPositions[player.id] ?? player.position;
      const list = map.get(displayedPosition) ?? [];
      list.push(player);
      map.set(displayedPosition, list);
    }
    return map;
  }, [displayedPositions, players]);

  return (
    <div
      data-monopoly-board-shell
      data-monopoly-board-mode={mode}
      className={`monopoly-board-shell relative mx-auto text-[#15110e] ${isPreview
        ? 'w-full max-w-[42rem]'
        : 'w-full min-w-0 sm:w-[min(34rem,100%)] lg:min-w-[34rem] lg:w-[clamp(34rem,min(60vw,calc(100dvh-20.5rem)),58rem)]'}`}
    >
      <div
        className="relative bg-[#2c1b12] p-1 sm:p-[clamp(5px,0.8vw,12px)]"
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
          <span className="sr-only" role="status" aria-live="polite">{movementAnnouncement}</span>
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
                    className="absolute inset-[12%] z-30 flex -rotate-6 items-center justify-center border border-[#981d19] bg-[#fff6df]/95 px-0.5 text-[5px] font-black uppercase leading-none text-[#981d19] shadow-md sm:border-2 sm:px-1 sm:text-[8px]"
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

          <div data-last-roll className="pointer-events-none absolute bottom-[15%] left-1/2 z-50 -translate-x-1/2">
            <MonopolyDiceScene
              roll={visualRoll}
              rollSequence={rollSequence}
              rolling={diceRolling}
              compact={isPreview}
              reduceMotion={!!reduceMotion}
            />
          </div>

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
          <span key="hotel" className="relative block h-[7px] w-[10px] border border-[#641410] bg-[#c52e28] shadow-[1px_2px_2px_rgba(0,0,0,0.45)] sm:h-[11px] sm:w-[17px]">
            <span className="absolute -top-[3px] left-px h-[4px] w-[7px] bg-[#e04b40] [clip-path:polygon(50%_0,100%_100%,0_100%)] sm:-top-[4px] sm:left-[2px] sm:h-[5px] sm:w-[13px]" />
          </span>
        ) : (
          <span key={`house-${index}`} className="relative block h-[5px] w-[6px] border border-[#0c5524] bg-[#119b48] shadow-[1px_2px_2px_rgba(0,0,0,0.4)] sm:h-[8px] sm:w-[10px]">
            <span className="absolute -top-[3px] -left-px h-[4px] w-[6px] bg-[#24b85c] [clip-path:polygon(50%_0,100%_100%,0_100%)] sm:-top-[4px] sm:h-[5px] sm:w-[10px]" />
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
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-[#bdc3c4] font-black text-black shadow-[0_2px_0_#555,0_5px_8px_rgba(0,0,0,0.65)] ${compact ? 'h-5 w-5 border-2 text-[10px]' : 'h-[18px] w-[18px] border-2 text-[8px] sm:h-8 sm:w-8 sm:border-[3px] sm:text-base'}`}
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
'use client';

import { Button } from '@/components/ui/Button';
import type {
  BridgeAction,
  BridgeCall,
  BridgePlayerView,
  BridgeStrain,
  StandardCard,
} from '@/shared';
import { BRIDGE_STRAINS } from '@/shared';
import { CardTable } from './CardTable';
import { CardFace } from './CardFace';

interface Props {
  readonly view: BridgePlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: BridgeAction) => void;
}

const STRAIN_LABELS: Record<BridgeStrain, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
  notrump: 'NT',
};

const MODE_LABELS = {
  rubber: { name: 'Rubber', detail: 'Two games secure the rubber' },
  duplicate: { name: 'Duplicate', detail: 'Board vulnerability and raw score' },
  home: { name: 'Home', detail: 'Custom 50 / 100 / 250 scoring' },
} as const;

export function BridgeRenderer({ view, disabled, onAction }: Props) {
  const playerName = (playerId: string | null) =>
    view.players.find((player) => player.id === playerId)?.name ?? '—';
  const canPlayOwn = view.canAct && view.actingHand === 'own';
  const canPlayDummy = view.canAct && view.actingHand === 'dummy';

  if (view.phase === 'setup') {
    return (
      <div className="w-full max-w-[64rem] border-y border-white/12 py-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase text-[#e5c66d]">Bridge session</p>
          <h2 className="mt-2 text-2xl font-black">Choose the scoring table</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {view.legalModes.map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => onAction({ type: 'select_bridge_mode', mode })}
                className="min-h-28 border border-white/15 bg-black/15 px-4 py-5 text-left hover:border-[#e5c66d]/70 disabled:opacity-40"
              >
                <span className="block text-lg font-black">{MODE_LABELS[mode].name}</span>
                <span className="mt-2 block text-sm text-white/50">{MODE_LABELS[mode].detail}</span>
              </button>
            ))}
          </div>
          {view.legalModes.length === 0 && <p className="mt-6 text-white/55">Waiting for the host to choose a mode.</p>}
        </div>
      </div>
    );
  }

  const tablePlayers = view.players.map((player) => ({
    id: player.id,
    name: player.name,
    handCount: player.handCount,
    detail: `${player.seat} · ${player.tricksWon} tricks`,
  }));
  const revealedHands = view.contract && view.dummyRevealed && view.contract.dummyId !== view.youId
    ? { [view.contract.dummyId]: view.dummyHand }
    : {};
  const activeSeatId = view.currentTurnId;

  return (
    <div className="w-full max-w-[72rem]">
      <CardTable
        players={tablePlayers}
        youId={view.youId}
        currentTurnId={activeSeatId}
        revealedHands={revealedHands}
        topRail={(
          <div className="flex items-center gap-2" aria-label="Partnership session scores">
            <TeamScore label="N / S" score={view.sessionScores[0]} tricks={view.tricksWon[0]} vulnerable={view.vulnerability[0]} rubber={view.mode === 'rubber' ? view.rubber : null} team={0} />
            <TeamScore label="E / W" score={view.sessionScores[1]} tricks={view.tricksWon[1]} vulnerable={view.vulnerability[1]} rubber={view.mode === 'rubber' ? view.rubber : null} team={1} />
          </div>
        )}
        center={(
          <BridgeTableCenter
            view={view}
            disabled={disabled}
            canPlayDummy={canPlayDummy}
            onAction={onAction}
            playerName={playerName}
          />
        )}
        hand={(
          <CardRow
            cards={view.yourHand}
            legalCardIds={view.legalCardIds}
            active={canPlayOwn}
            disabled={disabled}
            onPlay={(cardId) => onAction({ type: 'play_bridge_card', cardId })}
            emptyLabel="Your hand is empty"
          />
        )}
        bottomRail={(
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold uppercase text-white/55">
            <span>{MODE_LABELS[view.mode!].name}</span>
            <span>Deal {view.dealNumber}</span>
            <span>Dealer {playerName(view.dealerId)}</span>
            <span className="text-[#f1d174]">Table channels locked</span>
          </div>
        )}
      />

      {view.dealHistory.length > 0 && (
        <details className="mt-4 border-y border-white/10 py-3">
          <summary className="cursor-pointer text-sm font-bold text-white/65">Session scorecard · {view.dealHistory.length} deal{view.dealHistory.length === 1 ? '' : 's'}</summary>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="text-xs uppercase text-white/40">
              <tr><th className="p-2">Deal</th><th className="p-2">Contract</th><th className="p-2">Declarer</th><th className="p-2">Tricks N/S</th><th className="p-2">Score N/S</th></tr>
            </thead>
            <tbody>
              {view.dealHistory.map((deal) => (
                <tr key={deal.dealNumber} className="border-t border-white/8">
                  <td className="p-2">{deal.dealNumber}</td>
                  <td className="p-2">{deal.passedOut ? 'Passed out' : formatContract(deal.contract!)}</td>
                  <td className="p-2">{deal.contract ? playerName(deal.contract.declarerId) : '—'}</td>
                  <td className="p-2">{deal.tricksWon[0]}</td>
                  <td className="p-2">{signed(deal.score[0])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </details>
      )}
    </div>
  );
}

function BridgeTableCenter({ view, disabled, canPlayDummy, onAction, playerName }: Readonly<{
  view: BridgePlayerView;
  disabled: boolean;
  canPlayDummy: boolean;
  onAction: (action: BridgeAction) => void;
  playerName: (playerId: string | null) => string;
}>) {
  const lastDeal = view.dealHistory.at(-1);
  if (view.phase === 'auction') {
    return <Auction view={view} disabled={disabled} onAction={onAction} playerName={playerName} />;
  }
  if (view.phase === 'deal_complete' && lastDeal) {
    return (
      <div className="rounded-lg border border-[#e7cf85]/35 bg-[#0d2c24]/90 px-5 py-4 text-center shadow-xl">
        <p className="text-xs font-bold uppercase text-[#e7cf85]">Deal complete</p>
        <p className="mt-1 font-black">{lastDeal.passedOut ? 'Passed out' : `${formatContract(lastDeal.contract!)} · ${lastDeal.tricksWon[0]}–${lastDeal.tricksWon[1]} tricks`}</p>
        <p className="mt-1 text-sm text-white/60">Score {signed(lastDeal.score[0])} / {signed(lastDeal.score[1])}</p>
        {view.canAct && <Button className="mt-3" disabled={disabled} onClick={() => onAction({ type: 'next_bridge_deal' })}>Next deal</Button>}
      </div>
    );
  }
  if (!view.contract) return <p className="text-sm text-white/45">Waiting for the auction</p>;
  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center justify-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase">
        <span className="rounded-full bg-[#f0d37a] px-3 py-1 text-[#17231f]">{formatContract(view.contract)}</span>
        <span className="rounded-full bg-black/25 px-3 py-1 text-white/65">Declarer {playerName(view.contract.declarerId)}</span>
      </div>
      {!view.dummyRevealed && <p className="text-xs text-white/45">Dummy remains face down</p>}
      {view.dummyRevealed && view.dummyHand.length > 0 && (
        <div className="w-full overflow-x-auto py-1 [scrollbar-width:thin]" aria-label="Dummy hand">
          <p className="mb-1 text-center text-[10px] font-bold uppercase text-white/45">Dummy · {playerName(view.contract.dummyId)}</p>
          <CardRow
            cards={view.dummyHand}
            legalCardIds={view.legalCardIds}
            active={canPlayDummy}
            disabled={disabled}
            compact
            onPlay={(cardId) => onAction({ type: 'play_bridge_card', cardId })}
            emptyLabel="Dummy is empty"
          />
        </div>
      )}
      <BridgeTrick view={view} playerName={playerName} />
    </div>
  );
}

function BridgeTrick({ view, playerName }: Readonly<{
  view: BridgePlayerView;
  playerName: (playerId: string | null) => string;
}>) {
  if (view.trick.length === 0) return <p className="text-xs text-white/40">Awaiting lead</p>;
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Current trick">
      {view.trick.map((entry) => (
        <div key={`${entry.playerId}-${entry.card.id}`} className="flex items-center gap-1 rounded-lg bg-black/20 p-1">
          <CardFace card={entry.card} size="mini" />
          <span className="max-w-14 truncate text-[10px] text-white/55">{playerName(entry.playerId)}</span>
        </div>
      ))}
    </div>
  );
}

function Auction({ view, disabled, onAction, playerName }: Readonly<{
  view: BridgePlayerView;
  disabled: boolean;
  onAction: (action: BridgeAction) => void;
  playerName: (playerId: string | null) => string;
}>) {
  const isLegalBid = (level: number, strain: BridgeStrain) =>
    view.legalBids.some((bid) => bid.level === level && bid.strain === strain);
  return (
    <section className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0d2c24]/90 p-2 shadow-xl" aria-label="Bridge auction">
      <div className="flex max-h-12 min-h-7 flex-wrap justify-center gap-1 overflow-y-auto">
        {view.auction.map((entry, index) => (
          <span key={`${entry.playerId}-${index}`} className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[10px]">
            <strong>{playerName(entry.playerId)}</strong> {formatCall(entry.call)}
          </span>
        ))}
        {view.auction.length === 0 && <span className="self-center text-xs text-white/45">Auction unopened</span>}
      </div>

      {view.phase === 'auction' && view.canAct && (
        <div className="mt-2">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1" aria-label="Contract bids">
            {Array.from({ length: 7 }, (_, index) => index + 1).flatMap((level) =>
              BRIDGE_STRAINS.map((strain) => (
                <button
                  key={`${level}-${strain}`}
                  type="button"
                  disabled={disabled || !isLegalBid(level, strain)}
                  onClick={() => onAction({ type: 'bridge_call', call: { type: 'bid', level, strain } })}
                  className={`min-h-7 rounded border px-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-15 ${strain === 'hearts' || strain === 'diamonds' ? 'border-red-300/25 text-red-200' : 'border-white/15 text-white'}`}
                >
                  {level}{STRAIN_LABELS[strain]}
                </button>
              )),
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            <Button variant="secondary" disabled={disabled || !view.canPass} onClick={() => onAction({ type: 'bridge_call', call: { type: 'pass' } })}>Pass</Button>
            <Button variant="secondary" disabled={disabled || !view.canDouble} onClick={() => onAction({ type: 'bridge_call', call: { type: 'double' } })}>Double</Button>
            <Button variant="secondary" disabled={disabled || !view.canRedouble} onClick={() => onAction({ type: 'bridge_call', call: { type: 'redouble' } })}>Redouble</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CardRow({ cards, legalCardIds, active, disabled, onPlay, emptyLabel, compact = false }: Readonly<{
  cards: StandardCard[];
  legalCardIds: string[];
  active: boolean;
  disabled: boolean;
  onPlay: (cardId: string) => void;
  emptyLabel: string;
  compact?: boolean;
}>) {
  const sorted = [...cards].sort(compareCards);
  if (sorted.length === 0) return <div className="flex min-h-24 items-center justify-center text-sm text-white/35">{emptyLabel}</div>;
  return (
    <div className="flex min-h-20 w-max min-w-full items-end justify-center px-6 pt-2">
      {sorted.map((entry, index) => {
        const playable = active && legalCardIds.includes(entry.id);
        let overlapClass = '';
        if (index > 0) overlapClass = compact ? '-ml-7' : '-ml-8 max-sm:-ml-6';
        return (
          <span key={entry.id} className={overlapClass} style={{ transform: `rotate(${(index - (sorted.length - 1) / 2) * (compact ? 0.8 : 1.1)}deg)`, transformOrigin: 'bottom center' }}>
            <CardFace card={entry} size={compact ? 'mini' : 'regular'} disabled={disabled || !playable} onClick={active ? () => onPlay(entry.id) : undefined} />
          </span>
        );
      })}
    </div>
  );
}

function TeamScore({ label, score, tricks, vulnerable, rubber, team }: Readonly<{
  label: string;
  score: number;
  tricks: number;
  vulnerable: boolean;
  rubber: BridgePlayerView['rubber'] | null;
  team: 0 | 1;
}>) {
  return (
    <div className="min-w-24 rounded-full border border-white/15 bg-[#0d2c24]/95 px-3 py-1 text-center shadow-lg">
      <p className="text-[9px] font-bold uppercase text-white/50">{label}{vulnerable ? ' · Vul' : ''}</p>
      <p className="text-sm font-black">{score} <span className="text-[9px] font-semibold text-white/45">· {tricks} tricks</span></p>
      {rubber && <p className="text-[8px] text-white/40">{rubber.belowLine[team]} below · {rubber.gamesWon[team]} games</p>}
    </div>
  );
}

function formatCall(call: BridgeCall): string {
  if (call.type === 'bid') return `${call.level}${STRAIN_LABELS[call.strain]}`;
  if (call.type === 'double') return 'X';
  if (call.type === 'redouble') return 'XX';
  return 'Pass';
}

function formatContract(contract: NonNullable<BridgePlayerView['contract']>): string {
  let doubling = '';
  if (contract.doubling === 'doubled') doubling = ' X';
  else if (contract.doubling === 'redoubled') doubling = ' XX';
  return `${contract.level}${STRAIN_LABELS[contract.strain]}${doubling}`;
}

function compareCards(left: StandardCard, right: StandardCard): number {
  const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
  const rankOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  return suitOrder.indexOf(left.suit) - suitOrder.indexOf(right.suit)
    || rankOrder.indexOf(left.rank) - rankOrder.indexOf(right.rank);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
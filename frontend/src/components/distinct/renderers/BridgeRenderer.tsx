'use client';

import { useEffect, useState } from 'react';
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

const STRAIN_NAMES: Record<BridgeStrain, string> = {
  clubs: 'Clubs',
  diamonds: 'Diamonds',
  hearts: 'Hearts',
  spades: 'Spades',
  notrump: 'No Trump',
};

const MODE_LABELS = {
  rubber: { name: 'Rubber', detail: 'Two games secure the rubber' },
  duplicate: { name: 'Duplicate', detail: 'Board vulnerability and raw score' },
  home: { name: 'Home', detail: 'Custom 50 / 100 / 250 scoring' },
} as const;

export function BridgeRenderer({ view, disabled, onAction }: Props) {
  const [clock, setClock] = useState(() => Date.now());
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const playerName = (playerId: string | null) =>
    view.players.find((player) => player.id === playerId)?.name ?? '—';

  useEffect(() => {
    setClock(Date.now());
    if (!view.trickDisplayUntil) return;
    const delay = Math.max(0, view.trickDisplayUntil - Date.now() + 25);
    const timer = setTimeout(() => setClock(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [view.lastTrick?.completedAt, view.trickDisplayUntil]);

  const trickRevealActive = !!view.trickDisplayUntil && clock < view.trickDisplayUntil;
  const canPlayOwn = view.canAct && view.actingHand === 'own' && !trickRevealActive;
  const canPlayDummy = view.canAct && view.actingHand === 'dummy' && !trickRevealActive;
  const yourTeam = view.players.find((player) => player.id === view.youId)?.team ?? 0;
  const yourVotes = view.surrenderVotes[yourTeam];
  const hasVotedToSurrender = yourVotes.includes(view.youId);
  const partner = view.players.find(
    (player) => player.team === yourTeam && player.id !== view.youId,
  );
  const partnerHasVoted = !!partner && yourVotes.includes(partner.id);

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
        revealedHandAction={view.contract && view.dummyRevealed ? {
          playerId: view.contract.dummyId,
          legalCardIds: view.legalCardIds,
          active: canPlayDummy,
          disabled,
          onPlay: (cardId) => onAction({ type: 'play_bridge_card', cardId }),
        } : undefined}
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
            clock={clock}
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
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold uppercase text-white/55">
              <span>{MODE_LABELS[view.mode!].name}</span>
              <span>Deal {view.dealNumber}</span>
              <span>Dealer {playerName(view.dealerId)}</span>
              <span className="text-[#f1d174]">Table channels locked</span>
            </div>
            {view.canVoteSurrender && (
              <div className="flex items-center justify-center gap-2 text-[10px] text-white/55">
                <span>{yourVotes.length}/2 team confirmations{partnerHasVoted ? ` · ${partner?.name} confirmed` : ''}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (hasVotedToSurrender) {
                      onAction({ type: 'bridge_surrender_vote', confirmed: false });
                    } else {
                      setConfirmSurrender(true);
                    }
                  }}
                  className="rounded-md border border-red-300/25 px-2 py-1 font-bold text-red-200 disabled:opacity-40"
                >
                  {hasVotedToSurrender ? 'Withdraw surrender' : 'Surrender deal'}
                </button>
              </div>
            )}
          </div>
        )}
      />

      {confirmSurrender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/12 bg-[#1c1f1b] p-6 text-center shadow-2xl">
            <h2 className="text-xl font-bold">Confirm deal surrender?</h2>
            <p className="mt-2 text-sm text-white/55">
              Both teammates must confirm. Every unplayed trick will be awarded to the other team, then this deal will be scored normally.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmSurrender(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  onAction({ type: 'bridge_surrender_vote', confirmed: true });
                  setConfirmSurrender(false);
                }}
              >
                Confirm surrender
              </Button>
            </div>
          </div>
        </div>
      )}

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

function BridgeTableCenter({ view, disabled, clock, onAction, playerName }: Readonly<{
  view: BridgePlayerView;
  disabled: boolean;
  clock: number;
  onAction: (action: BridgeAction) => void;
  playerName: (playerId: string | null) => string;
}>) {
  const [showLastTrick, setShowLastTrick] = useState(false);
  const lastDeal = view.dealHistory.at(-1);
  const revealActive = !!view.lastTrick
    && !!view.trickDisplayUntil
    && clock < view.trickDisplayUntil;

  useEffect(() => {
    setShowLastTrick(false);
  }, [view.lastTrick?.completedAt]);

  if (view.phase === 'auction') {
    return <Auction view={view} disabled={disabled} onAction={onAction} playerName={playerName} />;
  }
  if (view.phase === 'deal_complete' && lastDeal && !revealActive) {
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
  const reviewingLastTrick = !!view.lastTrick && (revealActive || showLastTrick);
  const displayedCards = reviewingLastTrick ? view.lastTrick!.cards : view.trick;
  return (
    <div className="flex h-full w-full max-w-xl flex-col items-center justify-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase">
        <span className="rounded-full bg-[#f0d37a] px-3 py-1 text-[#17231f]">{formatContract(view.contract)}</span>
        <span className="rounded-full bg-black/25 px-3 py-1 text-white/65">Declarer {playerName(view.contract.declarerId)}</span>
      </div>
      {!view.dummyRevealed && <p className="text-xs text-white/45">Dummy remains face down</p>}
      {view.lastTrick && !revealActive && (
        <button
          type="button"
          onClick={() => setShowLastTrick((current) => !current)}
          className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] font-bold text-white/65"
        >
          {showLastTrick ? 'Return to current trick' : 'Last trick'}
        </button>
      )}
      {reviewingLastTrick && (
        <p className="text-[10px] font-bold uppercase text-[#f0d37a]">
          {revealActive ? 'Completed trick' : 'Previous trick'} · {playerName(view.lastTrick!.winnerId)} won
        </p>
      )}
      <BridgeTrick cards={displayedCards} playerName={playerName} />
    </div>
  );
}

function BridgeTrick({ cards, playerName }: Readonly<{
  cards: BridgePlayerView['trick'];
  playerName: (playerId: string | null) => string;
}>) {
  if (cards.length === 0) return <p className="text-xs text-white/40">Awaiting lead</p>;
  return (
    <div className="grid grid-cols-2 gap-1.5" aria-label="Current trick">
      {cards.map((entry) => (
        <div key={`${entry.playerId}-${entry.card.id}`} className="flex flex-col items-center rounded-lg bg-black/20 p-1">
          <CardFace card={entry.card} size="mini" />
          <span className="mt-0.5 max-w-12 truncate text-[9px] text-white/55">{playerName(entry.playerId)}</span>
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
  const [selectedStrain, setSelectedStrain] = useState<BridgeStrain | null>(null);
  const isLegalBid = (level: number, strain: BridgeStrain) =>
    view.legalBids.some((bid) => bid.level === level && bid.strain === strain);

  useEffect(() => {
    setSelectedStrain(null);
  }, [view.auction.length, view.currentTurnId]);

  const legalStrains = BRIDGE_STRAINS.filter((strain) =>
    view.legalBids.some((bid) => bid.strain === strain));
  const legalLevels = selectedStrain
    ? view.legalBids.filter((bid) => bid.strain === selectedStrain).map((bid) => bid.level)
    : [];
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
          {!selectedStrain && (
            <div>
              <p className="mb-2 text-center text-[10px] font-bold uppercase text-white/50">Choose a strain</p>
              <div className="mx-auto grid max-w-md grid-cols-1 gap-1 sm:grid-cols-5" aria-label="Contract strains">
                {BRIDGE_STRAINS.map((strain) => (
                  <button
                    key={strain}
                    type="button"
                    disabled={disabled || !legalStrains.includes(strain)}
                    onClick={() => setSelectedStrain(strain)}
                    className={`min-h-10 rounded border px-1 text-sm font-black disabled:cursor-not-allowed disabled:opacity-15 ${strain === 'hearts' || strain === 'diamonds' ? 'border-red-300/25 text-red-200' : 'border-white/15 text-white'}`}
                    aria-label={`Choose ${STRAIN_NAMES[strain]}`}
                  >
                    {STRAIN_LABELS[strain]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedStrain && (
            <div>
              <div className="mb-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStrain(null)}
                  className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold text-white/60"
                >
                  Back
                </button>
                <p className="text-xs font-bold">{STRAIN_LABELS[selectedStrain]} {STRAIN_NAMES[selectedStrain]} · choose level</p>
              </div>
              <div className="mx-auto grid max-w-sm grid-cols-2 gap-1 sm:grid-cols-7" aria-label="Contract levels">
                {Array.from({ length: 7 }, (_, index) => index + 1).map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={disabled || !isLegalBid(level, selectedStrain)}
                    onClick={() => onAction({ type: 'bridge_call', call: { type: 'bid', level, strain: selectedStrain } })}
                    className={`min-h-9 rounded border px-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-15 ${selectedStrain === 'hearts' || selectedStrain === 'diamonds' ? 'border-red-300/25 text-red-200' : 'border-white/15 text-white'}`}
                    aria-label={`${level}${STRAIN_LABELS[selectedStrain]}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-center text-[9px] text-white/35">Allowed levels: {legalLevels.join(', ')}</p>
            </div>
          )}
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

function CardRow({ cards, legalCardIds, active, disabled, onPlay, emptyLabel }: Readonly<{
  cards: StandardCard[];
  legalCardIds: string[];
  active: boolean;
  disabled: boolean;
  onPlay: (cardId: string) => void;
  emptyLabel: string;
}>) {
  const sorted = [...cards].sort(compareCards);
  if (sorted.length === 0) return <div className="flex min-h-24 items-center justify-center text-sm text-white/35">{emptyLabel}</div>;
  return (
    <div className="flex min-h-20 w-max min-w-full items-end justify-center px-6 pt-2">
      {sorted.map((entry, index) => {
        const playable = active && legalCardIds.includes(entry.id);
        let overlapClass = '';
        if (index > 0) overlapClass = '-ml-8 max-sm:-ml-12';
        return (
          <span key={entry.id} className={overlapClass} style={{ transform: `rotate(${(index - (sorted.length - 1) / 2) * 1.1}deg)`, transformOrigin: 'bottom center' }}>
            <CardFace card={entry} disabled={disabled || !playable} onClick={active ? () => onPlay(entry.id) : undefined} />
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
  const suitOrder = ['spades', 'hearts', 'clubs', 'diamonds'];
  const rankOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  return suitOrder.indexOf(left.suit) - suitOrder.indexOf(right.suit)
    || rankOrder.indexOf(left.rank) - rankOrder.indexOf(right.rank);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
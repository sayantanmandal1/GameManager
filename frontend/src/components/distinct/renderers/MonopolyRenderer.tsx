'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Banknote,
  Bot,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Gavel,
  Handshake,
  History,
  Hotel,
  Landmark,
  LockKeyhole,
  MapPinned,
  Scale,
  Sparkles,
  TicketCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  MonopolyAction,
  MonopolyBoardSpaceView,
  MonopolyPlayer,
  MonopolyPlayerView,
} from '@/shared';
import { MonopolyBoard } from './MonopolyBoard';

interface MonopolyRendererProps {
  readonly view: MonopolyPlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: MonopolyAction) => void;
}

type TableTab = 'deed' | 'portfolio' | 'trade';
type DecisionKind = 'purchase' | 'auction' | 'trade' | null;

const MAX_TRADE_CASH = 20_000;
const MAX_AUCTION_BID = 10_000;
const GROUP_COLORS: Record<string, string> = {
  brown: '#8f583c',
  light_blue: '#8bd3df',
  pink: '#d45da3',
  orange: '#e88a35',
  red: '#d6423e',
  yellow: '#e8c441',
  green: '#249054',
  dark_blue: '#244ea0',
};

export function MonopolyRenderer({ view, disabled, onAction }: MonopolyRendererProps) {
  const reduceMotion = useReducedMotion();
  const legal = useMemo(() => new Set(view.legalActions), [view.legalActions]);
  const you = view.players.find((player) => player.id === view.youId) ?? view.players[0];
  const current = view.players.find((player) => player.id === view.currentTurnId) ?? null;
  const [selectedSpaceIndex, setSelectedSpaceIndex] = useState<number | null>(null);
  const [tableTab, setTableTab] = useState<TableTab>('deed');
  const [auctionAmount, setAuctionAmount] = useState(1);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [offeredCash, setOfferedCash] = useState(0);
  const [requestedCash, setRequestedCash] = useState(0);
  const [offeredJailCards, setOfferedJailCards] = useState(0);
  const [requestedJailCards, setRequestedJailCards] = useState(0);
  const [offeredProperties, setOfferedProperties] = useState<number[]>([]);
  const [requestedProperties, setRequestedProperties] = useState<number[]>([]);
  const [diceRolling, setDiceRolling] = useState(false);
  const [pawnMoving, setPawnMoving] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [eventFeed, setEventFeed] = useState<string[]>(() => [view.lastEvent]);

  useEffect(() => {
    setDiceRolling(false);
  }, [view.rollSequence]);

  useEffect(() => {
    if (!diceRolling) return;
    const timeout = globalThis.setTimeout(() => setDiceRolling(false), 5_000);
    return () => globalThis.clearTimeout(timeout);
  }, [diceRolling]);

  useEffect(() => {
    setEventFeed((events) => {
      if (!view.lastEvent || events[0] === view.lastEvent) return events;
      return [view.lastEvent, ...events].slice(0, 6);
    });
  }, [view.lastEvent]);

  useEffect(() => {
    if (!view.pendingAuction) return;
    const currentBidder = view.players.find((player) => player.id === view.pendingAuction?.currentBidderId);
    const minBid = view.pendingAuction.highestBid + 1;
    const maxBid = Math.min(MAX_AUCTION_BID, currentBidder?.cash ?? MAX_AUCTION_BID);
    setAuctionAmount(clampInt(minBid, minBid, Math.max(minBid, maxBid)));
  }, [view.pendingAuction, view.players]);

  useEffect(() => {
    if (!targetPlayerId || targetPlayerId === view.youId) {
      setRequestedProperties([]);
      setRequestedJailCards(0);
      return;
    }
    const target = view.players.find((player) => player.id === targetPlayerId);
    if (!target || target.bankrupt) {
      setTargetPlayerId('');
      setRequestedProperties([]);
      setRequestedJailCards(0);
    }
  }, [targetPlayerId, view.players, view.youId]);

  useEffect(() => {
    if (selectedSpaceIndex === null) return;
    if (!view.board.some((space) => space.index === selectedSpaceIndex && isDeedSpace(space))) {
      setSelectedSpaceIndex(null);
    }
  }, [selectedSpaceIndex, view.board]);

  const selectedSpace = selectedSpaceIndex === null
    ? null
    : view.board.find((space) => space.index === selectedSpaceIndex) ?? null;
  const landingSpace = view.board.find((space) => space.index === current?.position) ?? null;
  const targetPlayer = view.players.find((player) => player.id === targetPlayerId) ?? null;
  const ownProperties = sortedOwnedProperties(view, view.youId);
  const targetProperties = targetPlayer ? sortedOwnedProperties(view, targetPlayer.id) : [];
  const pendingTrade = view.pendingTrade;
  const pendingTradeTarget = pendingTrade ? view.players.find((player) => player.id === pendingTrade.targetPlayerId) ?? null : null;
  const pendingTradeProposer = pendingTrade ? view.players.find((player) => player.id === pendingTrade.proposerId) ?? null : null;
  const decision = activeDecision(view);
  const actionLocked = disabled || pawnMoving || diceRolling;
  const canSubmitTrade = legal.has('monopoly_propose_trade')
    && view.canAct
    && !!targetPlayerId
    && targetPlayerId !== view.youId
    && hasTradeValue({
      offeredCash,
      requestedCash,
      offeredJailCards,
      requestedJailCards,
      offeredProperties,
      requestedProperties,
    });

  const sendAction = (action: MonopolyAction) => {
    if (action.type === 'monopoly_roll' || action.type === 'monopoly_attempt_doubles') {
      setDiceRolling(true);
    }
    onAction(action);
  };

  const selectSpace = (space: MonopolyBoardSpaceView) => {
    if (!isDeedSpace(space)) return;
    startTransition(() => {
      setSelectedSpaceIndex(space.index);
      setTableTab('deed');
      setToolsOpen(true);
    });
  };

  return (
    <div
      data-monopoly-live-table
      className="relative w-full max-w-[112rem] overflow-hidden border-y border-[#4a3827] bg-[#17130f] text-[#f8f0df] shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:border"
    >
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_18%_16%,rgba(218,181,102,0.16),transparent_30%),radial-gradient(circle_at_88%_78%,rgba(77,143,105,0.12),transparent_30%),repeating-linear-gradient(90deg,rgba(255,255,255,0.018)_0,rgba(255,255,255,0.018)_1px,transparent_1px,transparent_76px)]" />

      <section aria-label="Monopoly player wallets" className={`relative z-10 grid border-b border-white/10 ${walletGridClass(view.players.length)}`}>
        {view.players.map((player) => (
          <PlayerWallet
            key={player.id}
            player={player}
            isYou={player.id === view.youId}
            isCurrent={player.id === view.currentTurnId && view.phase !== 'finished'}
            selected={targetPlayerId === player.id}
            onSelect={() => {
              if (player.id !== view.youId && !player.bankrupt) {
                setTargetPlayerId(player.id);
                setTableTab('trade');
                setToolsOpen(true);
              }
            }}
          />
        ))}
      </section>

      <div data-monopoly-content className="relative z-10 grid min-w-0 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section data-monopoly-board-stage className="relative min-w-0 bg-[#201a14] p-1 sm:p-4">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,rgba(255,255,255,0.035)_25%,transparent_25%),linear-gradient(315deg,rgba(255,255,255,0.02)_25%,transparent_25%)] [background-position:0_0,24px_24px] [background-size:48px_48px]" />

          <div data-monopoly-board-column className="relative mx-auto max-w-[75rem]">
            <div data-monopoly-turn-status className="mb-1 flex min-h-9 items-center justify-between gap-2 border-y border-white/10 bg-black/20 px-2 py-1.5 sm:mb-3 sm:min-h-11 sm:gap-3 sm:px-3 sm:py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase text-[#c9a968]">{phaseLabel(view.phase)}</p>
                <p className="truncate text-sm font-semibold sm:text-base">
                  {current ? `${current.name}${current.id === view.youId ? ', your move' : ' is playing'}` : 'Table settling'}
                </p>
              </div>
              <div className="hidden min-w-0 items-center gap-2 text-right text-xs text-[#c8bda9] sm:flex">
                <History className="h-4 w-4 shrink-0 text-[#d9b763]" />
                <span className="max-w-[32rem] truncate">{view.lastEvent}</span>
              </div>
            </div>

            <div
              data-monopoly-board-viewport
              className="monopoly-board-viewport relative w-full touch-pan-y overflow-hidden pb-0 sm:overflow-x-auto sm:overflow-y-hidden sm:pb-3"
            >
              <MonopolyBoard
                board={view.board}
                players={view.players}
                selectedSpaceIndex={selectedSpaceIndex}
                onSelectSpace={selectSpace}
                isSelectable={isDeedSpace}
                interactive
                mode="live"
                lastRoll={view.lastDiceRoll}
                rollSequence={view.rollSequence}
                diceRolling={diceRolling}
                lastMovement={view.lastMovement}
                onMovementAnimationChange={setPawnMoving}
                lastCardText={view.lastCard ? `Last ${view.lastCard.deck}: ${view.lastCard.text}` : null}
                showAttribution={false}
              />
            </div>

            <ActionDock
              view={view}
              legal={legal}
              current={current}
              landingSpace={landingSpace}
              disabled={actionLocked}
              diceRolling={diceRolling}
              onAction={sendAction}
              onOpenTrade={() => {
                setTableTab('trade');
                setToolsOpen(true);
              }}
              onOpenPortfolio={() => {
                setTableTab('portfolio');
                setToolsOpen(true);
              }}
            />
          </div>
        </section>

        <aside data-monopoly-tools data-mobile-open={toolsOpen ? 'true' : 'false'} className="relative border-t border-white/10 bg-[#14110e] xl:border-l xl:border-t-0" aria-label="Monopoly table tools">
          <div data-monopoly-mobile-tools-header className="hidden items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-[#c9a968]">Table tools</p>
            <button type="button" onClick={() => setToolsOpen(false)} aria-label="Close table tools" className="flex h-11 w-11 items-center justify-center border border-white/15 bg-white/[0.06] text-[#eee5d6]">
              <X className="h-5 w-5" />
            </button>
          </div>
          {view.pendingDebt && (
            <section aria-label="Debt panel" className="border-b border-[#b4664d]/50 bg-[#2a1712] p-4">
              <DebtDecision view={view} legal={legal} disabled={actionLocked} onAction={sendAction} />
            </section>
          )}
          <TableTabs active={tableTab} onChange={setTableTab} />
          <div className="min-h-[14rem] p-3 sm:min-h-[20rem] sm:p-4 xl:max-h-[64rem] xl:overflow-y-auto">
            {tableTab === 'deed' && (
              <DeedPanel
                space={selectedSpace}
                players={view.players}
                youId={view.youId}
                legal={legal}
                disabled={actionLocked || !view.canAct}
                onAction={sendAction}
              />
            )}
            {tableTab === 'portfolio' && (
              <PortfolioPanel
                view={view}
                properties={ownProperties}
                onSelect={(space) => {
                  setSelectedSpaceIndex(space.index);
                  setTableTab('deed');
                }}
              />
            )}
            {tableTab === 'trade' && (
              <TradeWorkspace
                view={view}
                legal={legal}
                you={you}
                targetPlayer={targetPlayer}
                targetPlayerId={targetPlayerId}
                setTargetPlayerId={setTargetPlayerId}
                offeredCash={offeredCash}
                setOfferedCash={setOfferedCash}
                requestedCash={requestedCash}
                setRequestedCash={setRequestedCash}
                offeredJailCards={offeredJailCards}
                setOfferedJailCards={setOfferedJailCards}
                requestedJailCards={requestedJailCards}
                setRequestedJailCards={setRequestedJailCards}
                offeredProperties={offeredProperties}
                setOfferedProperties={setOfferedProperties}
                requestedProperties={requestedProperties}
                setRequestedProperties={setRequestedProperties}
                ownProperties={ownProperties}
                targetProperties={targetProperties}
                canSubmit={canSubmitTrade}
                disabled={actionLocked}
                onAction={sendAction}
              />
            )}
          </div>

          <EventFeed events={eventFeed} />
          <p className="border-t border-white/10 px-4 py-3 text-[9px] leading-relaxed text-[#827665]" data-monopoly-attribution data-monopoly-attribution-detail>
            MONOPOLY names, board artwork, trade dress, and Mr. Monopoly character belong to Hasbro and are reproduced under permission represented by the project owner.
          </p>
        </aside>
      </div>

      <AnimatePresence>
        {decision && !pawnMoving && !diceRolling && (
          <DecisionOverlay
            kind={decision}
            view={view}
            legal={legal}
            auctionAmount={auctionAmount}
            setAuctionAmount={setAuctionAmount}
            pendingTradeProposer={pendingTradeProposer}
            pendingTradeTarget={pendingTradeTarget}
            disabled={actionLocked}
            reduceMotion={!!reduceMotion}
            onAction={sendAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerWallet({ player, isYou, isCurrent, selected, onSelect }: Readonly<{
  player: MonopolyPlayer;
  isYou: boolean;
  isCurrent: boolean;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      data-monopoly-wallet
      onClick={onSelect}
      disabled={isYou || player.bankrupt}
      aria-label={`${player.name} wallet, $${player.cash}, ${player.properties.length} properties`}
      className={`relative min-h-11 min-w-0 border-r border-white/10 px-1.5 py-1.5 text-left transition-colors last:border-r-0 sm:px-4 sm:py-3 ${isCurrent ? 'bg-white/[0.09]' : 'bg-black/25'} ${selected ? 'ring-2 ring-inset ring-[#d8b55d]' : ''} ${player.bankrupt ? 'opacity-45 grayscale' : ''}`}
    >
      {isCurrent && <motion.span layoutId="monopoly-current-turn" className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: player.originalColor }} />}
      <span className="flex items-center gap-1 sm:gap-2">
        <span data-monopoly-wallet-token className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-[#d9dedb] text-sm shadow-[0_2px_0_#555] sm:h-9 sm:w-9 sm:text-lg" style={{ borderColor: player.originalColor }} aria-hidden="true">
          {tokenSymbol(player.originalToken)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-0.5 sm:gap-1.5">
            <span className="truncate text-[10px] font-bold sm:text-sm">{player.name}</span>
            {isYou && <span className="text-[7px] font-black uppercase text-[#d7b966] sm:text-[9px]">You</span>}
            {player.isBot && <Bot className="h-3 w-3 shrink-0 text-[#8cc9b0] sm:h-3.5 sm:w-3.5" aria-label="Bot" />}
            {player.inJail && <LockKeyhole className="h-3 w-3 shrink-0 text-[#e8a17f] sm:hidden" aria-label={`Jail turn ${player.jailTurns}`} />}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[9px] text-[#c2b8a7] sm:gap-3 sm:text-[11px]">
            <span className="font-black text-[#f3d27c]">${player.cash.toLocaleString()}</span>
            <span className="hidden sm:inline">{player.properties.length} deeds</span>
          </span>
        </span>
      </span>
      <span data-monopoly-wallet-status className="mt-1 hidden min-h-3 items-center gap-1 truncate text-[7px] font-bold uppercase text-[#897e6e] sm:mt-2 sm:flex sm:gap-2 sm:text-[9px]">
        {player.bankrupt ? 'Bankrupt' : player.inJail ? `Jail · turn ${player.jailTurns}` : <span className="hidden sm:inline">On the board</span>}
        {player.jailCards > 0 && <><TicketCheck className="h-3 w-3" />{player.jailCards}</>}
      </span>
    </button>
  );
}

function ActionDock({ view, legal, current, landingSpace, disabled, diceRolling, onAction, onOpenTrade, onOpenPortfolio }: Readonly<{
  view: MonopolyPlayerView;
  legal: Set<string>;
  current: MonopolyPlayer | null;
  landingSpace: MonopolyBoardSpaceView | null;
  disabled: boolean;
  diceRolling: boolean;
  onAction: (action: MonopolyAction) => void;
  onOpenTrade: () => void;
  onOpenPortfolio: () => void;
}>) {
  const canRoll = legal.has('monopoly_roll');
  const canAttemptDoubles = legal.has('monopoly_attempt_doubles');
  const isYourTurn = current?.id === view.youId;
  return (
    <section data-monopoly-action-dock aria-label="Turn actions" className="relative z-[70] mx-auto mt-1 flex w-full max-w-[58rem] flex-col items-center justify-between gap-2 border border-[#6a5638] bg-[#11100d]/95 px-2 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.45)] sm:flex-row sm:gap-3 sm:px-5 sm:py-3">
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-[10px] font-black uppercase text-[#c8a85a]">{isYourTurn ? 'Your turn' : `${current?.name ?? 'Table'} is playing`}</p>
        <p className="truncate text-sm font-semibold">{dockPrompt(view, landingSpace)}</p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
        {canRoll && (
          <CommandButton
            label={diceRolling ? 'Rolling…' : 'Roll dice'}
            icon={<Sparkles className="h-4 w-4" />}
            primary
            disabled={disabled || !view.canAct || diceRolling}
            onClick={() => onAction({ type: 'monopoly_roll' })}
          />
        )}
        {canAttemptDoubles && (
          <CommandButton label="Try doubles" icon={<Sparkles className="h-4 w-4" />} primary disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'monopoly_attempt_doubles' })} />
        )}
        {legal.has('monopoly_pay_jail') && <CommandButton label="Pay $50" icon={<LockKeyhole className="h-4 w-4" />} disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'monopoly_pay_jail' })} />}
        {legal.has('monopoly_use_jail_card') && <CommandButton label="Use jail card" icon={<TicketCheck className="h-4 w-4" />} disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'monopoly_use_jail_card' })} />}
        {legal.has('monopoly_end_turn') && <CommandButton label="End turn" icon={<ChevronRight className="h-4 w-4" />} primary disabled={disabled || !view.canAct} onClick={() => onAction({ type: 'monopoly_end_turn' })} />}
        <CommandButton label="My deeds" icon={<WalletCards className="h-4 w-4" />} disabled={false} onClick={onOpenPortfolio} />
        {legal.has('monopoly_propose_trade') && <CommandButton label="Trade" icon={<Handshake className="h-4 w-4" />} disabled={disabled || !view.canAct} onClick={onOpenTrade} />}
      </div>
    </section>
  );
}

function CommandButton({ label, icon, primary = false, disabled, onClick }: Readonly<{
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1 border px-2 text-[10px] font-black uppercase shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:gap-2 sm:px-3 sm:text-xs ${primary ? 'border-[#f0ce70] bg-[#d4ae50] text-[#17120b] hover:bg-[#edca6b]' : 'border-white/15 bg-white/[0.06] text-[#eee5d6] hover:bg-white/[0.11]'}`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function TableTabs({ active, onChange }: Readonly<{ active: TableTab; onChange: (tab: TableTab) => void }>) {
  return (
    <div className="sticky top-0 z-20 grid grid-cols-3 border-b border-white/10" role="tablist" aria-label="Table tools">
      {([
        ['deed', 'Deed', MapPinned],
        ['portfolio', 'Assets', Landmark],
        ['trade', 'Trade', Handshake],
      ] as const).map(([tab, label, Icon]) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={`flex min-h-12 items-center justify-center gap-1.5 border-r border-white/10 text-[10px] font-black uppercase last:border-r-0 ${active === tab ? 'bg-[#d6b45f] text-[#18130c]' : 'bg-black/20 text-[#a99d8b] hover:bg-white/[0.05]'}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function DeedPanel({ space, players, youId, legal, disabled, onAction }: Readonly<{
  space: MonopolyBoardSpaceView | null;
  players: MonopolyPlayer[];
  youId: string;
  legal: Set<string>;
  disabled: boolean;
  onAction: (action: MonopolyAction) => void;
}>) {
  if (!space) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center text-center text-[#8f8474]">
        <MapPinned className="h-10 w-10 text-[#c4a55c]" />
        <h3 className="mt-4 text-sm font-black uppercase text-[#ded4c3]">Inspect the board</h3>
        <p className="mt-2 max-w-[15rem] text-xs leading-relaxed">Select any street, railroad, or utility to open its title deed.</p>
      </div>
    );
  }
  const owner = playerName(players, space.ownerId);
  const accent = GROUP_COLORS[space.group ?? ''] ?? '#d6b45f';
  return (
    <motion.div key={space.index} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} data-deed-card className="overflow-hidden border-2 border-[#d5c8ad] bg-[#f5edda] text-[#211a12] shadow-[6px_8px_0_rgba(0,0,0,0.25)]">
      <div className="h-9 border-b-2 border-[#29231c]" style={{ backgroundColor: accent }} />
      <div className="p-4">
        <p className="text-center text-[10px] font-black uppercase">Title Deed</p>
        <h3 className="mt-1 text-center text-base font-black uppercase leading-tight">{space.name}</h3>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-y border-[#6f6351]/35 py-2 text-xs">
          <span>Owner</span><strong className="text-right">{owner}</strong>
          {space.price !== undefined && <><span>Price</span><strong className="text-right">${space.price}</strong></>}
          {space.mortgage !== undefined && <><span>Mortgage value</span><strong aria-label={`Mortgage value: $${space.mortgage}`} className="text-right">${space.mortgage}</strong></>}
          <span>Status</span><strong className="text-right">{space.mortgaged ? 'Mortgaged' : 'Active'}</strong>
        </div>
        {space.rents && (
          <ul className="mt-3 space-y-1 text-[11px]" data-rent-schedule>
            <RentRow label="Rent" value={space.rents[0]} />
            <RentRow label="With 1 House" value={space.rents[1]} />
            <RentRow label="With 2 Houses" value={space.rents[2]} />
            <RentRow label="With 3 Houses" value={space.rents[3]} />
            <RentRow label="With 4 Houses" value={space.rents[4]} />
            <RentRow label="With Hotel" value={space.rents[5]} />
          </ul>
        )}
        {space.houseCost !== undefined && <p className="mt-3 border-t border-[#6f6351]/35 pt-2 text-[10px]">Houses cost: ${space.houseCost} each · Hotel cost: ${space.houseCost} plus 4 houses</p>}
        <p className="mt-1 text-[10px]">Buildings: {space.buildingCount === 5 ? 'Hotel' : space.buildingCount}</p>
        {space.ownerId === youId && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {legal.has('monopoly_build') && <DeedAction label="Build" disabled={disabled} onClick={() => onAction({ type: 'monopoly_build', spaceIndex: space.index })} />}
            {legal.has('monopoly_sell_building') && <DeedAction label="Sell" disabled={disabled} onClick={() => onAction({ type: 'monopoly_sell_building', spaceIndex: space.index })} />}
            {legal.has('monopoly_mortgage') && <DeedAction label="Mortgage" disabled={disabled} onClick={() => onAction({ type: 'monopoly_mortgage', spaceIndex: space.index })} />}
            {legal.has('monopoly_unmortgage') && <DeedAction label="Unmortgage" disabled={disabled} onClick={() => onAction({ type: 'monopoly_unmortgage', spaceIndex: space.index })} />}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PortfolioPanel({ view, properties, onSelect }: Readonly<{
  view: MonopolyPlayerView;
  properties: MonopolyBoardSpaceView[];
  onSelect: (space: MonopolyBoardSpaceView) => void;
}>) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={<Building2 className="h-4 w-4" />} label="Houses" value={view.housesRemaining} />
        <StatTile icon={<Hotel className="h-4 w-4" />} label="Hotels" value={view.hotelsRemaining} />
        <StatTile icon={<Sparkles className="h-4 w-4" />} label="Chance" value={view.chanceRemaining} />
        <StatTile icon={<WalletCards className="h-4 w-4" />} label="Chest" value={view.chestRemaining} />
      </div>
      <h3 className="mt-5 text-[10px] font-black uppercase text-[#bba86f]">My portfolio</h3>
      {properties.length === 0 ? (
        <p className="mt-3 text-xs text-[#8f8474]">Your first deed will appear here.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {properties.map((space) => (
            <button key={space.index} type="button" onClick={() => onSelect(space)} className="flex w-full items-center gap-3 border border-white/10 bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]">
              <span className="h-9 w-2 shrink-0" style={{ backgroundColor: GROUP_COLORS[space.group ?? ''] ?? '#d6b45f' }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{space.name}</span><span className="text-[10px] text-[#978c7a]">{space.mortgaged ? 'Mortgaged' : space.buildingCount === 5 ? 'Hotel' : `${space.buildingCount} buildings`}</span></span>
              <ChevronRight className="h-4 w-4 text-[#857a6a]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TradeWorkspaceProps {
  readonly view: MonopolyPlayerView;
  readonly legal: Set<string>;
  readonly you: MonopolyPlayer | undefined;
  readonly targetPlayer: MonopolyPlayer | null;
  readonly targetPlayerId: string;
  readonly setTargetPlayerId: (value: string) => void;
  readonly offeredCash: number;
  readonly setOfferedCash: (value: number) => void;
  readonly requestedCash: number;
  readonly setRequestedCash: (value: number) => void;
  readonly offeredJailCards: number;
  readonly setOfferedJailCards: (value: number) => void;
  readonly requestedJailCards: number;
  readonly setRequestedJailCards: (value: number) => void;
  readonly offeredProperties: number[];
  readonly setOfferedProperties: (values: number[]) => void;
  readonly requestedProperties: number[];
  readonly setRequestedProperties: (values: number[]) => void;
  readonly ownProperties: MonopolyBoardSpaceView[];
  readonly targetProperties: MonopolyBoardSpaceView[];
  readonly canSubmit: boolean;
  readonly disabled: boolean;
  readonly onAction: (action: MonopolyAction) => void;
}

function TradeWorkspace(props: TradeWorkspaceProps) {
  return (
    <section aria-label="Trade composer">
      <div className="flex items-center gap-2"><Handshake className="h-5 w-5 text-[#d3b45e]" /><h3 className="text-sm font-black uppercase">Make a deal</h3></div>
      <label htmlFor="monopoly-trade-target" className="mt-4 block text-[10px] font-black uppercase text-[#9f927f]">Target player</label>
      <select id="monopoly-trade-target" value={props.targetPlayerId} onChange={(event) => props.setTargetPlayerId(event.target.value)} className="mt-1 h-11 w-full border border-white/15 bg-[#211c16] px-3 text-sm text-white">
        <option value="">Choose player</option>
        {props.view.players.filter((player) => player.id !== props.view.youId && !player.bankrupt).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TradeColumn
          title="You offer"
          cashId="monopoly-offered-cash"
          cash={props.offeredCash}
          setCash={(value) => props.setOfferedCash(clampInt(value, 0, Math.min(MAX_TRADE_CASH, props.you?.cash ?? 0)))}
          jailId="monopoly-offered-jail-cards"
          jailCards={props.offeredJailCards}
          setJailCards={(value) => props.setOfferedJailCards(clampInt(value, 0, Math.min(4, props.you?.jailCards ?? 0)))}
          properties={props.ownProperties}
          selected={props.offeredProperties}
          setSelected={props.setOfferedProperties}
        />
        <TradeColumn
          title="You request"
          cashId="monopoly-requested-cash"
          cash={props.requestedCash}
          setCash={(value) => props.setRequestedCash(clampInt(value, 0, Math.min(MAX_TRADE_CASH, props.targetPlayer?.cash ?? 0)))}
          jailId="monopoly-requested-jail-cards"
          jailCards={props.requestedJailCards}
          setJailCards={(value) => props.setRequestedJailCards(clampInt(value, 0, Math.min(4, props.targetPlayer?.jailCards ?? 0)))}
          properties={props.targetProperties}
          selected={props.requestedProperties}
          setSelected={props.setRequestedProperties}
        />
      </div>
      <div className="mt-4">
        <CommandButton
          label="Propose trade"
          icon={<Handshake className="h-4 w-4" />}
          primary
          disabled={props.disabled || !props.canSubmit}
          onClick={() => props.onAction({
            type: 'monopoly_propose_trade',
            targetPlayerId: props.targetPlayerId,
            offeredCash: props.offeredCash,
            requestedCash: props.requestedCash,
            offeredPropertyIndices: normalizeIndices(props.offeredProperties),
            requestedPropertyIndices: normalizeIndices(props.requestedProperties),
            offeredJailCards: props.offeredJailCards,
            requestedJailCards: props.requestedJailCards,
          })}
        />
      </div>
      {!props.legal.has('monopoly_propose_trade') && <p className="mt-3 text-[10px] text-[#847967]">Trading is unavailable during this decision.</p>}
    </section>
  );
}

function TradeColumn({ title, cashId, cash, setCash, jailId, jailCards, setJailCards, properties, selected, setSelected }: Readonly<{
  title: string;
  cashId: string;
  cash: number;
  setCash: (value: number | string) => void;
  jailId: string;
  jailCards: number;
  setJailCards: (value: number | string) => void;
  properties: MonopolyBoardSpaceView[];
  selected: number[];
  setSelected: (values: number[]) => void;
}>) {
  return (
    <fieldset className="min-w-0 border border-white/10 bg-white/[0.03] p-2">
      <legend className="px-1 text-[10px] font-black uppercase text-[#c9ad65]">{title}</legend>
      <label htmlFor={cashId} className="mt-1 block text-[9px] uppercase text-[#8d8170]">Cash</label>
      <input id={cashId} aria-label={cashId.includes('offered') ? 'Offered cash' : 'Requested cash'} type="number" min={0} max={MAX_TRADE_CASH} value={cash} onChange={(event) => setCash(event.target.value)} className="mt-1 h-11 w-full border border-white/10 bg-black/30 px-2 text-xs lg:h-8" />
      <label htmlFor={jailId} className="mt-2 block text-[9px] uppercase text-[#8d8170]">Jail cards</label>
      <input id={jailId} aria-label={jailId.includes('offered') ? 'Offered jail cards' : 'Requested jail cards'} type="number" min={0} max={4} value={jailCards} onChange={(event) => setJailCards(event.target.value)} className="mt-1 h-11 w-full border border-white/10 bg-black/30 px-2 text-xs lg:h-8" />
      <div className="mt-3 max-h-44 overflow-y-auto">
        {properties.length === 0 && <p className="text-[10px] text-[#786f62]">No deeds</p>}
        {properties.map((space) => (
          <label key={space.index} className="mb-1.5 flex min-h-11 cursor-pointer items-center gap-2 text-[10px] lg:min-h-0">
            <input type="checkbox" aria-label={`${space.index} ${space.name}`} checked={selected.includes(space.index)} onChange={() => setSelected(toggleValue(selected, space.index))} />
            <span className="min-w-0 truncate">{space.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DecisionOverlay({ kind, view, legal, auctionAmount, setAuctionAmount, pendingTradeProposer, pendingTradeTarget, disabled, reduceMotion, onAction }: Readonly<{
  kind: Exclude<DecisionKind, null>;
  view: MonopolyPlayerView;
  legal: Set<string>;
  auctionAmount: number;
  setAuctionAmount: (value: number) => void;
  pendingTradeProposer: MonopolyPlayer | null;
  pendingTradeTarget: MonopolyPlayer | null;
  disabled: boolean;
  reduceMotion: boolean;
  onAction: (action: MonopolyAction) => void;
}>) {
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-[3px] lg:absolute lg:p-4" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        aria-label={decisionAriaLabel(kind)}
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto border border-[#d4b667] bg-[#17130f] p-3 text-[#f8efdf] shadow-[0_26px_80px_rgba(0,0,0,0.65)] lg:max-h-none lg:p-5"
      >
        {kind === 'purchase' && view.pendingPurchase && (
          <PurchaseDecision view={view} legal={legal} disabled={disabled} onAction={onAction} />
        )}
        {kind === 'auction' && view.pendingAuction && (
          <AuctionDecision view={view} legal={legal} amount={auctionAmount} setAmount={setAuctionAmount} disabled={disabled} onAction={onAction} />
        )}
        {kind === 'trade' && view.pendingTrade && (
          <TradeDecision view={view} legal={legal} proposer={pendingTradeProposer} target={pendingTradeTarget} disabled={disabled} onAction={onAction} />
        )}
      </motion.section>
    </motion.div>
  );
}

function PurchaseDecision({ view, legal, disabled, onAction }: Readonly<{ view: MonopolyPlayerView; legal: Set<string>; disabled: boolean; onAction: (action: MonopolyAction) => void }>) {
  const pending = view.pendingPurchase!;
  const space = view.board[pending.spaceIndex];
  return (
    <div className="text-center">
      <CircleDollarSign className="mx-auto h-9 w-9 text-[#dfbc60]" />
      <p className="mt-3 text-[10px] font-black uppercase text-[#bba86d]">Unowned property</p>
      <h3 className="mt-1 text-2xl font-black uppercase">{space.name}</h3>
      <p className="mt-3 text-3xl font-black text-[#f0cc6e]">${pending.price}</p>
      <p className="mt-2 text-xs text-[#a99d8c]">Add this deed to your portfolio or send it to open auction.</p>
      <div className="mt-5 flex justify-center gap-3">
        <CommandButton label="Buy" icon={<Banknote className="h-4 w-4" />} primary disabled={disabled || !legal.has('monopoly_buy')} onClick={() => onAction({ type: 'monopoly_buy' })} />
        <CommandButton label="Auction" icon={<Gavel className="h-4 w-4" />} disabled={disabled || !legal.has('monopoly_decline')} onClick={() => onAction({ type: 'monopoly_decline' })} />
      </div>
    </div>
  );
}

function AuctionDecision({ view, legal, amount, setAmount, disabled, onAction }: Readonly<{ view: MonopolyPlayerView; legal: Set<string>; amount: number; setAmount: (value: number) => void; disabled: boolean; onAction: (action: MonopolyAction) => void }>) {
  const auction = view.pendingAuction!;
  const currentBidder = view.players.find((player) => player.id === auction.currentBidderId);
  const min = auction.highestBid + 1;
  const max = Math.min(MAX_AUCTION_BID, currentBidder?.cash ?? MAX_AUCTION_BID);
  const quickBids = [min, min + 10, min + 50].filter((value, index, values) => value <= max && values.indexOf(value) === index);
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase text-[#bba86d]">Live auction</p><h3 className="mt-1 text-xl font-black uppercase">{spaceName(view.board, auction.spaceIndex)}</h3></div>
        <Gavel className="h-9 w-9 text-[#e0bc60]" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-white/10 py-2 lg:mt-5 lg:py-4">
        <div><p className="text-[9px] uppercase text-[#8e8271]">High bid</p><p className="text-3xl font-black text-[#f0cc6e]">${auction.highestBid}</p></div>
        <div className="text-right"><p className="text-[9px] uppercase text-[#8e8271]">Winning bidder</p><p className="mt-1 text-sm font-bold">{playerName(view.players, auction.highestBidderId)}</p></div>
      </div>
      <p className="mt-3 text-xs lg:mt-4"><strong>{playerName(view.players, auction.currentBidderId)}</strong> is on the clock · {auction.activeBidderIds.length} bidders remain</p>
      <label htmlFor="monopoly-auction-amount" className="mt-3 block text-[10px] font-black uppercase text-[#a99d8a] lg:mt-4">Bid amount</label>
      <input id="monopoly-auction-amount" type="number" min={min} max={max} value={amount} onChange={(event) => setAmount(clampInt(event.target.value, min, Math.max(min, max)))} className="mt-1 h-11 w-full border border-[#d2b45f]/50 bg-black/30 px-4 text-center text-xl font-black text-[#f0cc6e] lg:h-12" />
      <div className="mt-2 flex gap-2">{quickBids.map((bid) => <button key={bid} type="button" onClick={() => setAmount(bid)} className="min-h-11 flex-1 border border-white/10 bg-white/[0.05] py-2 text-xs font-bold hover:bg-white/[0.1]">${bid}</button>)}</div>
      <div className="mt-3 flex justify-end gap-3 lg:mt-5">
        <CommandButton label="Pass" icon={<X className="h-4 w-4" />} disabled={disabled || !legal.has('monopoly_pass_auction')} onClick={() => onAction({ type: 'monopoly_pass_auction' })} />
        <CommandButton label="Bid" icon={<Gavel className="h-4 w-4" />} primary disabled={disabled || !legal.has('monopoly_bid')} onClick={() => onAction({ type: 'monopoly_bid', amount })} />
      </div>
    </div>
  );
}

function DebtDecision({ view, legal, disabled, onAction }: Readonly<{ view: MonopolyPlayerView; legal: Set<string>; disabled: boolean; onAction: (action: MonopolyAction) => void }>) {
  const debt = view.pendingDebt!;
  return (
    <div>
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase text-[#dc8b72]">Payment due</p><h3 className="mt-1 text-xl font-black">Settle your balance</h3></div><Scale className="h-9 w-9 text-[#e69578]" /></div>
      <p className="mt-5 text-4xl font-black text-[#ff9d7e]">${debt.amount}</p>
      <p className="mt-2 text-xs text-[#a99d8b]">Creditor: {playerName(view.players, debt.creditorId)} · {debt.reason.replaceAll('_', ' ')}</p>
      <p className="mt-4 border-l-2 border-[#d8b45c] pl-3 text-xs leading-relaxed text-[#c6baa8]">Use your deed panel to sell buildings or mortgage assets, then pay the balance. Trading remains server-controlled where legal.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {legal.has('monopoly_pay_debt') && <CommandButton label="Pay debt" icon={<Banknote className="h-4 w-4" />} primary disabled={disabled} onClick={() => onAction({ type: 'monopoly_pay_debt' })} />}
        {legal.has('monopoly_declare_bankruptcy') && <CommandButton label="Declare bankruptcy" icon={<Scale className="h-4 w-4" />} disabled={disabled} onClick={() => onAction({ type: 'monopoly_declare_bankruptcy' })} />}
      </div>
    </div>
  );
}

function TradeDecision({ view, legal, proposer, target, disabled, onAction }: Readonly<{ view: MonopolyPlayerView; legal: Set<string>; proposer: MonopolyPlayer | null; target: MonopolyPlayer | null; disabled: boolean; onAction: (action: MonopolyAction) => void }>) {
  const trade = view.pendingTrade!;
  return (
    <div>
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase text-[#8fd2b4]">Deal proposed</p><h3 className="mt-1 text-xl font-black">{proposer?.name ?? 'Player'} → {target?.name ?? 'Player'}</h3></div><Handshake className="h-9 w-9 text-[#8fd2b4]" /></div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <TradeSummary title="Offers" cash={trade.offeredCash} deeds={trade.offeredPropertyIndices.length} cards={trade.offeredJailCards} />
        <TradeSummary title="Requests" cash={trade.requestedCash} deeds={trade.requestedPropertyIndices.length} cards={trade.requestedJailCards} />
      </div>
      <div className="mt-5 flex justify-end gap-3">
        {legal.has('monopoly_respond_trade') && <><CommandButton label="Reject" icon={<X className="h-4 w-4" />} disabled={disabled} onClick={() => onAction({ type: 'monopoly_respond_trade', approved: false })} /><CommandButton label="Accept" icon={<Handshake className="h-4 w-4" />} primary disabled={disabled} onClick={() => onAction({ type: 'monopoly_respond_trade', approved: true })} /></>}
        {legal.has('monopoly_cancel_trade') && <CommandButton label="Cancel" icon={<X className="h-4 w-4" />} disabled={disabled} onClick={() => onAction({ type: 'monopoly_cancel_trade' })} />}
      </div>
    </div>
  );
}

function EventFeed({ events }: Readonly<{ events: string[] }>) {
  return (
    <section className="border-t border-white/10 p-4" aria-label="Table activity">
      <div className="flex items-center gap-2"><History className="h-4 w-4 text-[#c5a758]" /><h3 className="text-[10px] font-black uppercase text-[#b7aa98]">Table activity</h3></div>
      <ol className="mt-3 space-y-2">
        {events.map((event, index) => <li key={`${event}-${index}`} className={`border-l pl-2 text-[10px] leading-relaxed ${index === 0 ? 'border-[#d2af56] text-[#e8ddcc]' : 'border-white/10 text-[#756c60]'}`}>{event}</li>)}
      </ol>
    </section>
  );
}

function StatTile({ icon, label, value }: Readonly<{ icon: React.ReactNode; label: string; value: number }>) {
  return <div aria-label={`${label}: ${value}`} className="border border-white/10 bg-white/[0.04] p-2"><span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-[#8e8271]">{icon}{label}</span><strong className="mt-1 block text-lg text-[#ead078]">{value}</strong></div>;
}

function RentRow({ label, value }: Readonly<{ label: string; value: number }>) {
  return <li aria-label={`${label}: $${value}`} className="flex justify-between gap-3"><span>{label}</span><strong>${value}</strong></li>;
}

function DeedAction({ label, disabled, onClick }: Readonly<{ label: string; disabled: boolean; onClick: () => void }>) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-11 border border-[#4c4133] bg-[#e1d3b7] px-2 py-2 text-[10px] font-black uppercase hover:bg-[#d4c29f] disabled:opacity-40">{label}</button>;
}

function TradeSummary({ title, cash, deeds, cards }: Readonly<{ title: string; cash: number; deeds: number; cards: number }>) {
  return <div className="border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] font-black uppercase text-[#b7a66f]">{title}</p><p className="mt-2 text-sm font-bold">${cash}</p><p className="mt-1 text-[10px] text-[#968b7a]">{deeds} deeds · {cards} jail cards</p></div>;
}

function activeDecision(view: MonopolyPlayerView): DecisionKind {
  if (view.pendingTrade) return 'trade';
  if (view.pendingAuction) return 'auction';
  if (view.pendingPurchase) return 'purchase';
  return null;
}

function decisionAriaLabel(kind: Exclude<DecisionKind, null>): string {
  if (kind === 'purchase') return 'Pending purchase';
  if (kind === 'auction') return 'Auction panel';
  return 'Pending trade';
}

function dockPrompt(view: MonopolyPlayerView, landingSpace: MonopolyBoardSpaceView | null): string {
  if (view.phase === 'finished') return `${playerName(view.players, view.winnerId)} wins the table`;
  if (!view.canAct) return view.lastEvent;
  if (view.phase === 'jail') return 'Choose how to leave jail';
  if (view.phase === 'rolling') return 'Roll the dice to move';
  if (view.phase === 'post_roll') return landingSpace ? `Landed on ${landingSpace.name}` : 'Manage assets or end your turn';
  return view.lastEvent;
}

function phaseLabel(phase: MonopolyPlayerView['phase']): string {
  return phase.replaceAll('_', ' ');
}

function walletGridClass(playerCount: number): string {
  if (playerCount <= 2) return 'grid-cols-2';
  if (playerCount === 3) return 'grid-cols-3';
  return 'grid-cols-4';
}

function sortedOwnedProperties(view: MonopolyPlayerView, ownerId: string): MonopolyBoardSpaceView[] {
  return view.board.filter((space) => space.ownerId === ownerId).sort((left, right) => left.index - right.index);
}

function hasTradeValue(values: { offeredCash: number; requestedCash: number; offeredJailCards: number; requestedJailCards: number; offeredProperties: number[]; requestedProperties: number[] }): boolean {
  return values.offeredCash > 0
    || values.requestedCash > 0
    || values.offeredJailCards > 0
    || values.requestedJailCards > 0
    || values.offeredProperties.length > 0
    || values.requestedProperties.length > 0;
}

function playerName(players: MonopolyPlayer[], playerId: string | null): string {
  if (!playerId) return 'Bank';
  return players.find((player) => player.id === playerId)?.name ?? 'Unknown';
}

function clampInt(value: number | string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeIndices(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 39))].sort((left, right) => left - right);
}

function toggleValue(values: number[], target: number): number[] {
  if (values.includes(target)) return values.filter((value) => value !== target);
  return [...values, target];
}

function spaceName(board: MonopolyBoardSpaceView[], index: number): string {
  return board.find((space) => space.index === index)?.name ?? `Space ${index}`;
}

function isDeedSpace(space: MonopolyBoardSpaceView): boolean {
  return space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility';
}

function tokenSymbol(token: string): string {
  const symbols: Record<string, string> = {
    top_hat: '🎩',
    racecar: '🏎',
    battleship: '🚢',
    dog: '🐕',
  };
  return symbols[token] ?? token.slice(0, 2).toUpperCase();
}
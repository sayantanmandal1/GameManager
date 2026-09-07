'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type {
  MonopolyAction,
  MonopolyBoardSpaceView,
  MonopolyPlayer,
  MonopolyPlayerView,
} from '@/shared';

interface MonopolyRendererProps {
  readonly view: MonopolyPlayerView;
  readonly disabled: boolean;
  readonly onAction: (action: MonopolyAction) => void;
}

const MAX_TRADE_CASH = 20000;
const MAX_AUCTION_BID = 10000;

const GROUP_COLORS: Record<string, string> = {
  brown: '#8a5a3b',
  light_blue: '#85c9d4',
  pink: '#d985b0',
  orange: '#d98b4f',
  red: '#c85a54',
  yellow: '#d9c36a',
  green: '#5f9a68',
  dark_blue: '#3f5d9d',
};

export function MonopolyRenderer({ view, disabled, onAction }: MonopolyRendererProps) {
  const legal = useMemo(() => new Set(view.legalActions), [view.legalActions]);
  const you = view.players.find((player) => player.id === view.youId) ?? view.players[0];
  const current = view.players.find((player) => player.id === view.currentTurnId) ?? null;

  const [selectedSpaceIndex, setSelectedSpaceIndex] = useState<number | null>(null);
  const [auctionAmount, setAuctionAmount] = useState<number>(1);
  const [targetPlayerId, setTargetPlayerId] = useState<string>('');
  const [offeredCash, setOfferedCash] = useState<number>(0);
  const [requestedCash, setRequestedCash] = useState<number>(0);
  const [offeredJailCards, setOfferedJailCards] = useState<number>(0);
  const [requestedJailCards, setRequestedJailCards] = useState<number>(0);
  const [offeredProperties, setOfferedProperties] = useState<number[]>([]);
  const [requestedProperties, setRequestedProperties] = useState<number[]>([]);

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
    if (!view.board.some((space) => space.index === selectedSpaceIndex && space.ownerId)) {
      setSelectedSpaceIndex(null);
    }
  }, [selectedSpaceIndex, view.board]);

  const selectedSpace = selectedSpaceIndex === null
    ? null
    : view.board.find((space) => space.index === selectedSpaceIndex) ?? null;

  const targetPlayer = view.players.find((player) => player.id === targetPlayerId) ?? null;

  const ownProperties = view.board
    .filter((space) => space.ownerId === view.youId)
    .sort((left, right) => left.index - right.index);

  const targetProperties = targetPlayer
    ? view.board
      .filter((space) => space.ownerId === targetPlayer.id)
      .sort((left, right) => left.index - right.index)
    : [];

  const playersBySpace = useMemo(() => {
    const tokenMap = new Map<number, MonopolyPlayer[]>();
    for (const player of view.players) {
      const list = tokenMap.get(player.position) ?? [];
      list.push(player);
      tokenMap.set(player.position, list);
    }
    return tokenMap;
  }, [view.players]);

  const canSubmitTrade =
    legal.has('monopoly_propose_trade')
    && view.canAct
    && !!targetPlayerId
    && targetPlayerId !== view.youId
    && (
      offeredCash > 0
      || requestedCash > 0
      || offeredJailCards > 0
      || requestedJailCards > 0
      || offeredProperties.length > 0
      || requestedProperties.length > 0
    );

  const pendingTrade = view.pendingTrade;
  const pendingTradeTarget = pendingTrade
    ? view.players.find((player) => player.id === pendingTrade.targetPlayerId) ?? null
    : null;
  const pendingTradeProposer = pendingTrade
    ? view.players.find((player) => player.id === pendingTrade.proposerId) ?? null
    : null;
  const currentPlayerSuffix = current?.id === view.youId ? ' (you)' : '';
  const currentTurnLabel = current ? `${current.name}${currentPlayerSuffix}` : 'Unknown';

  return (
    <div className="w-full max-w-[100rem]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <div
            data-monopoly-board-viewport
            className="monopoly-board-viewport w-full overflow-x-auto overflow-y-hidden border border-[#6f614e] bg-[#ede4d4] p-2"
          >
            <div
              data-monopoly-board
              className="monopoly-board relative mx-auto grid aspect-square w-[42rem] min-w-[42rem] grid-cols-11 grid-rows-11 border-2 border-[#31261b] bg-[#f5efe2]"
            >
              {view.board.map((space) => {
                const coord = boardCoordinate(space.index);
                const boardPlayers = playersBySpace.get(space.index) ?? [];
                return (
                  <button
                    key={space.index}
                    type="button"
                    data-space-index={space.index}
                    data-board-row={coord.row}
                    data-board-col={coord.col}
                    data-space-kind={space.kind}
                    aria-label={spaceAriaLabel(space, view.players)}
                    aria-pressed={selectedSpaceIndex === space.index}
                    onClick={() => setSelectedSpaceIndex(space.ownerId ? space.index : null)}
                    className={`relative flex min-h-0 min-w-0 flex-col justify-between border border-[#3d3022] px-1 py-1 text-left ${
                      selectedSpaceIndex === space.index ? 'bg-[#efe3c8]' : 'bg-[#f8f3e9]'
                    }`}
                    style={{
                      gridRowStart: coord.row + 1,
                      gridColumnStart: coord.col + 1,
                    }}
                  >
                    {space.kind === 'street' && (
                      <span
                        className={`absolute ${colorBandPlacement(space.index)} bg-black/20`}
                        style={{ backgroundColor: GROUP_COLORS[space.group ?? ''] ?? '#c9c1b2' }}
                      />
                    )}
                    <span className="relative z-10 text-[9px] font-bold leading-tight text-[#20170f]">{space.name}</span>
                    <span className="relative z-10 text-[9px] text-[#473a2d]">{spaceDescriptor(space)}</span>
                    {space.ownerId && (
                      <span className="relative z-10 text-[9px] font-semibold text-[#2b2118]">
                        Owner: {playerName(view.players, space.ownerId)}
                      </span>
                    )}
                    <div className="relative z-10 mt-1 flex flex-wrap items-center gap-1">
                      {space.buildingCount > 0 && (
                        <span className="rounded border border-[#5f4d33] px-1 text-[9px] font-semibold text-[#2d2419]">
                          {space.buildingCount === 5 ? 'Hotel' : `${space.buildingCount}H`}
                        </span>
                      )}
                      {space.mortgaged && (
                        <span className="rounded border border-[#7b3c31] px-1 text-[9px] font-semibold text-[#7b3c31]">Mortgaged</span>
                      )}
                    </div>
                    <div className="relative z-10 mt-1 grid grid-cols-2 gap-1">
                      {boardPlayers.map((player) => (
                        <span
                          key={player.id}
                          className="flex h-4 items-center justify-center rounded border border-black/20 text-[8px] font-black uppercase text-black"
                          style={{ backgroundColor: player.originalColor }}
                          title={`${player.name} (${tokenLabel(player.originalToken)})`}
                          aria-label={`${player.name} token`}
                        >
                          {tokenLabel(player.originalToken).charAt(0)}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}

              <div className="absolute inset-[13%] border border-[#4a3b2a] bg-[#f1e8d8] p-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-[#2a2017]">Monopoly Dashboard</h3>
                <p className="mt-1 text-xs text-[#4f4132]">Turn: {currentTurnLabel}</p>
                <p className="text-xs text-[#4f4132]">Phase: {view.phase.replace('_', ' ')}</p>
                <p className="text-xs text-[#4f4132]">Dice: {view.turn.lastRoll ? `${view.turn.lastRoll[0]} + ${view.turn.lastRoll[1]}` : 'Not rolled yet'}</p>
                <p className="mt-2 text-xs font-semibold text-[#2b2218]">{view.lastEvent}</p>
                {view.lastCard && (
                  <p className="mt-1 text-xs text-[#4f4132]">
                    Last {view.lastCard.deck} card: {view.lastCard.text}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#3d3024]">
                  <span>Houses: {view.housesRemaining}</span>
                  <span>Hotels: {view.hotelsRemaining}</span>
                  <span>Chance deck: {view.chanceRemaining}</span>
                  <span>Chance discard: {view.chanceDiscardCount}</span>
                  <span>Chest deck: {view.chestRemaining}</span>
                  <span>Chest discard: {view.chestDiscardCount}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryAction
                    enabled={legal.has('monopoly_roll')}
                    disabled={disabled || !view.canAct}
                    label="Roll"
                    onClick={() => onAction({ type: 'monopoly_roll' })}
                  />
                  <PrimaryAction
                    enabled={legal.has('monopoly_end_turn')}
                    disabled={disabled || !view.canAct}
                    label="End turn"
                    onClick={() => onAction({ type: 'monopoly_end_turn' })}
                  />
                  <PrimaryAction
                    enabled={legal.has('monopoly_pay_jail')}
                    disabled={disabled || !view.canAct}
                    label="Pay $50"
                    onClick={() => onAction({ type: 'monopoly_pay_jail' })}
                  />
                  <PrimaryAction
                    enabled={legal.has('monopoly_use_jail_card')}
                    disabled={disabled || !view.canAct}
                    label="Use jail card"
                    onClick={() => onAction({ type: 'monopoly_use_jail_card' })}
                  />
                  <PrimaryAction
                    enabled={legal.has('monopoly_attempt_doubles')}
                    disabled={disabled || !view.canAct}
                    label="Try doubles"
                    onClick={() => onAction({ type: 'monopoly_attempt_doubles' })}
                  />
                  <PrimaryAction
                    enabled={legal.has('monopoly_pay_debt')}
                    disabled={disabled || !view.canAct}
                    label="Pay debt"
                    onClick={() => onAction({ type: 'monopoly_pay_debt' })}
                  />
                  <PrimaryAction
                    enabled={legal.has('monopoly_declare_bankruptcy')}
                    disabled={disabled || !view.canAct}
                    label="Declare bankruptcy"
                    onClick={() => onAction({ type: 'monopoly_declare_bankruptcy' })}
                  />
                </div>
              </div>
            </div>
          </div>

          {view.pendingPurchase && (
            <section className="mt-3 border border-[#5e503e] bg-[#eee4d3] p-3" aria-label="Pending purchase">
              <h4 className="text-sm font-bold text-[#2b2117]">Purchase decision</h4>
              <p className="mt-1 text-sm text-[#3d3023]">
                {spaceName(view.board, view.pendingPurchase.spaceIndex)} for ${view.pendingPurchase.price}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={disabled || !view.canAct || !legal.has('monopoly_buy')}
                  onClick={() => onAction({ type: 'monopoly_buy' })}
                >
                  Buy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || !view.canAct || !legal.has('monopoly_decline')}
                  onClick={() => onAction({ type: 'monopoly_decline' })}
                >
                  Auction
                </Button>
              </div>
            </section>
          )}

          {view.pendingAuction && (
            <section className="mt-3 border border-[#5e503e] bg-[#eee4d3] p-3" aria-label="Auction panel">
              <h4 className="text-sm font-bold text-[#2b2117]">Auction</h4>
              <p className="text-sm text-[#3d3023]">Property: {spaceName(view.board, view.pendingAuction.spaceIndex)}</p>
              <p className="text-sm text-[#3d3023]">Current high bid: ${view.pendingAuction.highestBid}</p>
              <p className="text-sm text-[#3d3023]">High bidder: {playerName(view.players, view.pendingAuction.highestBidderId)}</p>
              <p className="text-sm text-[#3d3023]">Current bidder: {playerName(view.players, view.pendingAuction.currentBidderId)}</p>
              <p className="text-sm text-[#3d3023]">Remaining bidders: {view.pendingAuction.activeBidderIds.map((id) => playerName(view.players, id)).join(', ') || 'None'}</p>
              <label htmlFor="monopoly-auction-amount" className="mt-2 block text-xs font-semibold text-[#3d3023]">Bid amount</label>
              <input
                id="monopoly-auction-amount"
                type="number"
                min={view.pendingAuction.highestBid + 1}
                max={MAX_AUCTION_BID}
                value={auctionAmount}
                onChange={(event) => {
                  const bidder = view.players.find((player) => player.id === view.pendingAuction?.currentBidderId);
                  const min = view.pendingAuction ? view.pendingAuction.highestBid + 1 : 1;
                  const max = Math.min(MAX_AUCTION_BID, bidder?.cash ?? MAX_AUCTION_BID);
                  setAuctionAmount(clampInt(event.target.value, min, Math.max(min, max)));
                }}
                className="mt-1 w-36 border border-[#786956] bg-[#f6efe1] px-2 py-1 text-sm text-[#241c14]"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={disabled || !view.canAct || !legal.has('monopoly_bid')}
                  onClick={() => onAction({ type: 'monopoly_bid', amount: auctionAmount })}
                >
                  Bid
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || !view.canAct || !legal.has('monopoly_pass_auction')}
                  onClick={() => onAction({ type: 'monopoly_pass_auction' })}
                >
                  Pass
                </Button>
              </div>
            </section>
          )}

          {view.pendingDebt && (
            <section className="mt-3 border border-[#5e503e] bg-[#eee4d3] p-3" aria-label="Debt panel">
              <h4 className="text-sm font-bold text-[#2b2117]">Debt resolution</h4>
              <p className="text-sm text-[#3d3023]">Amount: ${view.pendingDebt.amount}</p>
              <p className="text-sm text-[#3d3023]">Creditor: {playerName(view.players, view.pendingDebt.creditorId) || 'Bank'}</p>
              <p className="text-sm text-[#3d3023]">Reason: {view.pendingDebt.reason.replace('_', ' ')}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={disabled || !view.canAct || !legal.has('monopoly_pay_debt')}
                  onClick={() => onAction({ type: 'monopoly_pay_debt' })}
                >
                  Pay debt
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={disabled || !view.canAct || !legal.has('monopoly_declare_bankruptcy')}
                  onClick={() => onAction({ type: 'monopoly_declare_bankruptcy' })}
                >
                  Declare bankruptcy
                </Button>
              </div>
            </section>
          )}
        </section>

        <aside className="space-y-3">
          <section className="border border-[#5e503e] bg-[#eee4d3] p-3" aria-label="Player overview">
            <h4 className="text-sm font-bold text-[#2b2117]">Players</h4>
            <ul className="mt-2 space-y-2 text-sm text-[#2f251b]">
              {view.players.map((player) => (
                <li key={player.id} className="border border-[#ccbea8] bg-[#f4ecdd] px-2 py-1">
                  <p className="font-semibold">
                    {player.name}{player.id === view.youId ? ' (you)' : ''}
                  </p>
                  <p>Cash: ${player.cash}</p>
                  <p>Position: {player.position} · Properties: {player.properties.length}</p>
                  <p>
                    {player.inJail ? `In jail (${player.jailTurns})` : 'Free'} · Jail cards: {player.jailCards}
                  </p>
                  <p>{player.bankrupt ? 'Bankrupt' : 'Active'}</p>
                </li>
              ))}
            </ul>
            {view.phase === 'finished' && (
              <p className="mt-2 text-sm font-semibold text-[#3b2f22]">
                Winner: {playerName(view.players, view.winnerId)}
              </p>
            )}
          </section>

          <section className="border border-[#5e503e] bg-[#eee4d3] p-3" aria-label="Property detail">
            <h4 className="text-sm font-bold text-[#2b2117]">Property management</h4>
            {!selectedSpace && <p className="mt-2 text-sm text-[#3d3023]">Select any owned board space to inspect details.</p>}
            {selectedSpace && (
              <div className="mt-2 text-sm text-[#3d3023]">
                <p className="font-semibold text-[#2a2017]">{selectedSpace.name}</p>
                <p>Owner: {playerName(view.players, selectedSpace.ownerId)}</p>
                {selectedSpace.price !== undefined && <p>Price: ${selectedSpace.price}</p>}
                {selectedSpace.mortgage !== undefined && <p>Mortgage: ${selectedSpace.mortgage}</p>}
                <p>Buildings: {selectedSpace.buildingCount === 5 ? 'Hotel' : selectedSpace.buildingCount}</p>
                <p>{selectedSpace.mortgaged ? 'Mortgaged' : 'Not mortgaged'}</p>
                {selectedSpace.rents && (
                  <p>
                    Rent schedule: {selectedSpace.rents.map((rent, index) => (index === 0 ? `${rent}` : `/${rent}`)).join('')}
                  </p>
                )}
                {selectedSpace.ownerId === view.youId && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {legal.has('monopoly_build') && (
                      <Button
                        size="sm"
                        disabled={disabled || !view.canAct}
                        onClick={() => onAction({ type: 'monopoly_build', spaceIndex: selectedSpace.index })}
                      >
                        Build
                      </Button>
                    )}
                    {legal.has('monopoly_sell_building') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={disabled || !view.canAct}
                        onClick={() => onAction({ type: 'monopoly_sell_building', spaceIndex: selectedSpace.index })}
                      >
                        Sell
                      </Button>
                    )}
                    {legal.has('monopoly_mortgage') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={disabled || !view.canAct}
                        onClick={() => onAction({ type: 'monopoly_mortgage', spaceIndex: selectedSpace.index })}
                      >
                        Mortgage
                      </Button>
                    )}
                    {legal.has('monopoly_unmortgage') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={disabled || !view.canAct}
                        onClick={() => onAction({ type: 'monopoly_unmortgage', spaceIndex: selectedSpace.index })}
                      >
                        Unmortgage
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="border border-[#5e503e] bg-[#eee4d3] p-3" aria-label="Trade composer">
            <h4 className="text-sm font-bold text-[#2b2117]">Trade</h4>
            <label htmlFor="monopoly-trade-target" className="mt-2 block text-xs font-semibold text-[#3d3023]">Target player</label>
            <select
              id="monopoly-trade-target"
              value={targetPlayerId}
              onChange={(event) => setTargetPlayerId(event.target.value)}
              className="mt-1 w-full border border-[#786956] bg-[#f6efe1] px-2 py-1 text-sm text-[#241c14]"
            >
              <option value="">Select player</option>
              {view.players
                .filter((player) => player.id !== view.youId && !player.bankrupt)
                .map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
            </select>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-[#3d3023]" htmlFor="monopoly-offered-cash">
                Offered cash
              </label>
              <input
                id="monopoly-offered-cash"
                type="number"
                min={0}
                max={MAX_TRADE_CASH}
                value={offeredCash}
                onChange={(event) => setOfferedCash(clampInt(event.target.value, 0, Math.min(MAX_TRADE_CASH, you?.cash ?? MAX_TRADE_CASH)))}
                className="border border-[#786956] bg-[#f6efe1] px-2 py-1 text-sm text-[#241c14]"
              />

              <label className="text-xs font-semibold text-[#3d3023]" htmlFor="monopoly-requested-cash">
                Requested cash
              </label>
              <input
                id="monopoly-requested-cash"
                type="number"
                min={0}
                max={MAX_TRADE_CASH}
                value={requestedCash}
                onChange={(event) => setRequestedCash(clampInt(event.target.value, 0, Math.min(MAX_TRADE_CASH, targetPlayer?.cash ?? MAX_TRADE_CASH)))}
                className="border border-[#786956] bg-[#f6efe1] px-2 py-1 text-sm text-[#241c14]"
              />

              <label className="text-xs font-semibold text-[#3d3023]" htmlFor="monopoly-offered-jail-cards">
                Offered jail cards
              </label>
              <input
                id="monopoly-offered-jail-cards"
                type="number"
                min={0}
                max={4}
                value={offeredJailCards}
                onChange={(event) => setOfferedJailCards(clampInt(event.target.value, 0, Math.min(4, you?.jailCards ?? 0)))}
                className="border border-[#786956] bg-[#f6efe1] px-2 py-1 text-sm text-[#241c14]"
              />

              <label className="text-xs font-semibold text-[#3d3023]" htmlFor="monopoly-requested-jail-cards">
                Requested jail cards
              </label>
              <input
                id="monopoly-requested-jail-cards"
                type="number"
                min={0}
                max={4}
                value={requestedJailCards}
                onChange={(event) => setRequestedJailCards(clampInt(event.target.value, 0, Math.min(4, targetPlayer?.jailCards ?? 0)))}
                className="border border-[#786956] bg-[#f6efe1] px-2 py-1 text-sm text-[#241c14]"
              />
            </div>

            <div className="mt-3 grid gap-2 text-xs text-[#2f2419] sm:grid-cols-2">
              <fieldset>
                <legend className="font-semibold">Offer properties</legend>
                <div className="mt-1 max-h-28 overflow-y-auto border border-[#ccbea8] bg-[#f4ecdd] p-2">
                  {ownProperties.length === 0 && <p className="text-[#655748]">None</p>}
                  {ownProperties.map((space) => (
                    <label key={space.index} className="mb-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={offeredProperties.includes(space.index)}
                        onChange={() => {
                          setOfferedProperties(toggleValue(offeredProperties, space.index));
                        }}
                      />
                      <span>{space.index} {space.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="font-semibold">Request properties</legend>
                <div className="mt-1 max-h-28 overflow-y-auto border border-[#ccbea8] bg-[#f4ecdd] p-2">
                  {targetProperties.length === 0 && <p className="text-[#655748]">None</p>}
                  {targetProperties.map((space) => (
                    <label key={space.index} className="mb-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={requestedProperties.includes(space.index)}
                        onChange={() => {
                          setRequestedProperties(toggleValue(requestedProperties, space.index));
                        }}
                      />
                      <span>{space.index} {space.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-3">
              <Button
                size="sm"
                disabled={disabled || !canSubmitTrade}
                onClick={() => {
                  onAction({
                    type: 'monopoly_propose_trade',
                    targetPlayerId,
                    offeredCash: clampInt(offeredCash, 0, Math.min(MAX_TRADE_CASH, you?.cash ?? MAX_TRADE_CASH)),
                    requestedCash: clampInt(requestedCash, 0, Math.min(MAX_TRADE_CASH, targetPlayer?.cash ?? MAX_TRADE_CASH)),
                    offeredPropertyIndices: normalizeIndices(offeredProperties),
                    requestedPropertyIndices: normalizeIndices(requestedProperties),
                    offeredJailCards: clampInt(offeredJailCards, 0, Math.min(4, you?.jailCards ?? 0)),
                    requestedJailCards: clampInt(requestedJailCards, 0, Math.min(4, targetPlayer?.jailCards ?? 0)),
                  });
                }}
              >
                Propose trade
              </Button>
            </div>

            {pendingTrade && (
              <div className="mt-3 border border-[#cdbda7] bg-[#f5ede0] p-2 text-xs text-[#33281e]">
                <p className="font-semibold">Pending trade</p>
                <p>{pendingTradeProposer?.name ?? 'Unknown'} to {pendingTradeTarget?.name ?? 'Unknown'}</p>
                <p>Offer: ${pendingTrade.offeredCash}, {pendingTrade.offeredPropertyIndices.length} properties, {pendingTrade.offeredJailCards} jail cards</p>
                <p>Request: ${pendingTrade.requestedCash}, {pendingTrade.requestedPropertyIndices.length} properties, {pendingTrade.requestedJailCards} jail cards</p>
                <div className="mt-2 flex gap-2">
                  {legal.has('monopoly_respond_trade') && (
                    <>
                      <Button
                        size="sm"
                        disabled={disabled || !view.canAct}
                        onClick={() => onAction({ type: 'monopoly_respond_trade', approved: true })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={disabled || !view.canAct}
                        onClick={() => onAction({ type: 'monopoly_respond_trade', approved: false })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {legal.has('monopoly_cancel_trade') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={disabled || !view.canAct}
                      onClick={() => onAction({ type: 'monopoly_cancel_trade' })}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function PrimaryAction({
  enabled,
  disabled,
  label,
  onClick,
}: Readonly<{
  enabled: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}>) {
  if (!enabled) return null;
  return (
    <Button size="sm" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

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

function colorBandPlacement(index: number): string {
  if (index >= 1 && index <= 9) return 'inset-x-0 top-0 h-1';
  if (index >= 11 && index <= 19) return 'inset-y-0 right-0 w-1';
  if (index >= 21 && index <= 29) return 'inset-x-0 bottom-0 h-1';
  if (index >= 31 && index <= 39) return 'inset-y-0 left-0 w-1';
  return 'hidden';
}

function spaceDescriptor(space: MonopolyBoardSpaceView): string {
  if (space.kind === 'street' || space.kind === 'railroad' || space.kind === 'utility') {
    return space.price !== undefined ? `$${space.price}` : '';
  }
  if (space.kind === 'tax') return `Tax $${space.amount ?? 0}`;
  if (space.kind === 'chance') return 'Chance';
  if (space.kind === 'chest') return 'Chest';
  if (space.kind === 'go') return 'Collect $200';
  if (space.kind === 'jail') return 'Visiting';
  if (space.kind === 'free_parking') return 'Rest';
  if (space.kind === 'go_to_jail') return 'Go to Jail';
  return '';
}

function tokenLabel(token: string): string {
  return token.replaceAll('_', ' ');
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
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 39))]
    .sort((left, right) => left - right);
}

function toggleValue(values: number[], target: number): number[] {
  if (values.includes(target)) return values.filter((value) => value !== target);
  return [...values, target];
}

function spaceName(board: MonopolyBoardSpaceView[], index: number): string {
  return board.find((space) => space.index === index)?.name ?? `Space ${index}`;
}

function spaceAriaLabel(space: MonopolyBoardSpaceView, players: MonopolyPlayer[]): string {
  const owner = space.ownerId ? `, owned by ${playerName(players, space.ownerId)}` : '';
  const descriptor = spaceDescriptor(space);
  const detail = descriptor ? `, ${descriptor}` : '';
  return `Space ${space.index}: ${space.name}${detail}${owner}`;
}

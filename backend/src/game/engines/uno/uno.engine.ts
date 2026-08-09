import {
  UnoCard,
  UnoCardFace,
  UnoColor,
  UnoGameState,
  UnoPlayerState,
  UnoPlayerView,
  UnoPhase,
  UnoEvent,
  UnoRoundResult,
  UnoRules,
  UnoSide,
  UnoDrawKind,
  UNO_LIGHT_COLORS,
  UNO_DARK_COLORS,
  UNO_CONSTANTS,
  UNO_SPECTATOR_CAP,
} from '../../../shared';
import {
  buildDeckForMode,
  shuffle,
  faceOf,
  isWildKind,
  isDrawKind,
  drawAmount,
  cardMatches,
  handPoints,
} from './uno.utils';

export interface UnoActionResult {
  ok: boolean;
  error?: string;
  roundResult?: UnoRoundResult;
}

const WILD_DRAW_KINDS = new Set([
  'wild4',
  'reverseDraw4',
  'wildDraw2',
  'wildDrawColor',
]);

/**
 * Pure, authoritative UNO rules engine covering four modes (Classic, Custom,
 * No Mercy, Flip). Mutates the passed state and returns {ok,error}. All secrecy
 * is enforced at projection time (getPlayerView).
 */
export class UnoEngine {
  // ─── Setup ─────────────────────────────────────────────────────────

  initRound(
    gameId: string,
    lobbyCode: string,
    playerIds: string[],
    playerNames: Record<string, string>,
    rules: UnoRules,
    prevScores: Record<string, number> = {},
    connected: Record<string, boolean> = {},
    firstIndex = 0,
  ): UnoGameState {
    const players: UnoPlayerState[] = playerIds.map((id) => ({
      id,
      name: playerNames[id] ?? 'Player',
      hand: [],
      handCount: 0,
      isConnected: connected[id] ?? true,
      calledUno: false,
      unoVulnerable: false,
      score: prevScores[id] ?? 0,
      eliminated: false,
    }));

    const noMercy = rules.mode === 'noMercy';
    const deck = shuffle(buildDeckForMode(rules.mode));
    for (let r = 0; r < UNO_CONSTANTS.INITIAL_HAND_SIZE; r += 1) {
      for (const p of players) p.hand.push(deck.pop()!);
    }
    for (const p of players) p.handCount = p.hand.length;

    // First discard must be a number on the starting (light) side.
    let first = deck.pop()!;
    while (faceOf(first, 'light').kind !== 'number') {
      const at = Math.floor(Math.random() * (deck.length + 1));
      deck.splice(at, 0, first);
      first = deck.pop()!;
    }

    const now = Date.now();
    return {
      gameId,
      lobbyCode,
      mode: rules.mode,
      phase: UnoPhase.PLAYING,
      side: 'light',
      players,
      spectators: [],
      direction: 1,
      currentIndex: firstIndex % players.length,
      drawPile: deck,
      discardPile: [first],
      activeColor: faceOf(first, 'light').color as UnoColor,
      pendingDraw: null,
      pendingSevenBy: null,
      drawnCardId: null,
      unoWindowFor: null,
      turnStartedAt: now,
      turnEndsAt: now + UNO_CONSTANTS.TURN_MS,
      targetScore: noMercy ? null : rules.targetScore,
      stacking: noMercy ? true : rules.stacking,
      drawToMatch: rules.drawToMatch,
      jumpIn: rules.jumpIn,
      sevenZero: rules.sevenZero,
      forcePlay: rules.forcePlay,
      noBluffing: rules.noBluffing,
      mercyLimit: noMercy ? UNO_CONSTANTS.MERCY_LIMIT : null,
      roundNumber: 1,
      roundWinnerId: null,
      matchWinnerId: null,
      events: [],
      eventSeq: 0,
      startedAt: now,
      finishedAt: null,
    };
  }

  startNextRound(state: UnoGameState): void {
    const ids = state.players.map((p) => p.id);
    const names: Record<string, string> = {};
    const scores: Record<string, number> = {};
    const connected: Record<string, boolean> = {};
    for (const p of state.players) {
      names[p.id] = p.name;
      scores[p.id] = p.score;
      connected[p.id] = p.isConnected;
    }
    const prevWinner = state.roundWinnerId ? ids.indexOf(state.roundWinnerId) : 0;
    const rules: UnoRules = {
      mode: state.mode,
      targetScore: state.targetScore,
      stacking: state.stacking,
      drawToMatch: state.drawToMatch,
      jumpIn: state.jumpIn,
      sevenZero: state.sevenZero,
      forcePlay: state.forcePlay,
      noBluffing: state.noBluffing,
    };
    const fresh = this.initRound(
      state.gameId,
      state.lobbyCode,
      ids,
      names,
      rules,
      scores,
      connected,
      (prevWinner + 1) % ids.length,
    );
    fresh.roundNumber = state.roundNumber + 1;
    fresh.spectators = state.spectators;
    Object.assign(state, fresh);
  }

  // ─── Actions ───────────────────────────────────────────────────────

  play(
    state: UnoGameState,
    playerId: string,
    cardId: string,
    chosenColor?: UnoColor,
  ): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING)
      return { ok: false, error: 'Round is not in progress' };
    if (state.pendingSevenBy)
      return { ok: false, error: 'Choose a player to swap with first' };
    const idx = this.indexOf(state, playerId);
    if (idx < 0) return { ok: false, error: 'You are not in this game' };
    if (idx !== state.currentIndex) return { ok: false, error: 'It is not your turn' };

    const player = state.players[idx];
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) return { ok: false, error: 'You do not have that card' };
    const f = faceOf(card, state.side);

    const pd = state.pendingDraw;
    if (pd) {
      if (!this.canStack(state, f.kind, pd))
        return { ok: false, error: 'You must take the cards' };
    } else if (state.drawnCardId) {
      if (cardId !== state.drawnCardId)
        return { ok: false, error: 'You can only play the card you drew' };
    } else if (!cardMatches(card, state.activeColor, this.top(state), state.side)) {
      return { ok: false, error: 'That card does not match' };
    }

    // Wild Draw Four legality when No Bluffing is enabled.
    if (
      !pd &&
      state.noBluffing &&
      (f.kind === 'wild4' || f.kind === 'reverseDraw4') &&
      this.hasActiveColor(state, player)
    ) {
      return { ok: false, error: 'You still hold a matching colour' };
    }

    if (this.isWildFace(f)) {
      if (!chosenColor || !this.paletteFor(state.side).includes(chosenColor))
        return { ok: false, error: 'Choose a colour' };
    }

    this.closeStaleUnoWindow(state, playerId);

    player.hand = player.hand.filter((c) => c.id !== cardId);
    player.handCount = player.hand.length;
    state.discardPile.push(card);
    state.drawnCardId = null;

    const prevColor = state.activeColor;
    this.pushEvent(state, { type: 'play', by: playerId, card, side: state.side });

    // Handle Flip: toggle side, then colour follows the flipped top face.
    if (f.kind === 'flip') {
      state.side = state.side === 'light' ? 'dark' : 'light';
      this.pushEvent(state, { type: 'flip', by: playerId, side: state.side });
      state.activeColor = faceOf(card, state.side).color as UnoColor;
    } else if (this.isWildFace(f)) {
      state.activeColor = chosenColor as UnoColor;
      this.pushEvent(state, { type: 'color', by: playerId, color: state.activeColor, side: state.side });
    } else {
      state.activeColor = f.color as UnoColor;
    }

    // Discard All (No Mercy): shed every card of the played colour.
    if (f.kind === 'discardAll' && f.color) {
      player.hand = player.hand.filter((c) => faceOf(c, state.side).color !== f.color);
      player.handCount = player.hand.length;
      this.pushEvent(state, { type: 'discardAll', by: playerId, color: f.color });
    }

    // Going out?
    if (player.hand.length === 0) {
      if (isDrawKind(f.kind)) {
        const victim = state.players[this.step(state, state.currentIndex, 1)];
        if (f.kind === 'wildDrawColor') this.drawUntilColor(state, victim, state.activeColor);
        else this.giveCards(state, victim, drawAmount(f.kind));
      }
      return this.endRound(state, player);
    }

    this.refreshUno(state, player, true);

    // Seven-0: number 7 → swap (needs a target), number 0 → rotate all hands.
    if (state.sevenZero && f.kind === 'number' && f.value === 7) {
      state.pendingSevenBy = playerId;
      this.resetTimer(state);
      return { ok: true };
    }
    if (state.sevenZero && f.kind === 'number' && f.value === 0) {
      this.rotateHands(state);
    }

    this.applyEffect(state, f, prevColor, playerId);

    return this.settleOrEnd(state, { ok: true });
  }

  draw(state: UnoGameState, playerId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING)
      return { ok: false, error: 'Round is not in progress' };
    if (state.pendingSevenBy) return { ok: false, error: 'Choose a player to swap with first' };
    const idx = this.indexOf(state, playerId);
    if (idx !== state.currentIndex) return { ok: false, error: 'It is not your turn' };
    if (state.pendingDraw) return { ok: false, error: 'Resolve the draw cards first' };
    if (state.drawnCardId) return { ok: false, error: 'You already drew this turn' };

    this.closeStaleUnoWindow(state, playerId);
    const player = state.players[idx];

    // Draw to Match keeps drawing until a playable card appears.
    let drawn: UnoCard | undefined;
    do {
      drawn = this.giveCards(state, player, 1)[0];
    } while (
      state.drawToMatch &&
      drawn &&
      !cardMatches(drawn, state.activeColor, this.top(state), state.side) &&
      state.drawPile.length + state.discardPile.length > 1
    );
    this.pushEvent(state, { type: 'draw', by: playerId, amount: 1 });

    if (player.eliminated) return this.settleOrEnd(state, { ok: true });

    if (drawn && cardMatches(drawn, state.activeColor, this.top(state), state.side)) {
      state.drawnCardId = drawn.id;
    } else {
      state.drawnCardId = null;
      this.advanceTurn(state, 1);
    }
    return this.settleOrEnd(state, { ok: true });
  }

  pass(state: UnoGameState, playerId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING)
      return { ok: false, error: 'Round is not in progress' };
    const idx = this.indexOf(state, playerId);
    if (idx !== state.currentIndex) return { ok: false, error: 'It is not your turn' };
    if (!state.drawnCardId) return { ok: false, error: 'You can only pass after drawing' };
    // Force Play: a drawn playable card must be played.
    if (state.forcePlay) return { ok: false, error: 'You must play the drawn card' };

    this.closeStaleUnoWindow(state, playerId);
    state.drawnCardId = null;
    this.advanceTurn(state, 1);
    return { ok: true };
  }

  take(state: UnoGameState, playerId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING)
      return { ok: false, error: 'Round is not in progress' };
    const idx = this.indexOf(state, playerId);
    if (idx !== state.currentIndex) return { ok: false, error: 'It is not your turn' };
    if (!state.pendingDraw) return { ok: false, error: 'Nothing to take' };

    this.closeStaleUnoWindow(state, playerId);
    this.resolveTake(state, playerId);
    return this.settleOrEnd(state, { ok: true });
  }

  challenge(state: UnoGameState, playerId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING)
      return { ok: false, error: 'Round is not in progress' };
    const idx = this.indexOf(state, playerId);
    if (idx !== state.currentIndex) return { ok: false, error: 'It is not your turn' };
    const pd = state.pendingDraw;
    if (!pd || !pd.challengeable || state.noBluffing)
      return { ok: false, error: 'Nothing to challenge' };

    this.closeStaleUnoWindow(state, playerId);
    const accused = pd.wild4By ? this.player(state, pd.wild4By) : null;
    const bluffed =
      !!accused &&
      accused.hand.some((c) => faceOf(c, state.side).color === pd.wild4PrevColor);

    if (bluffed && accused) {
      if (pd.type === 'wildDrawColor' && pd.untilColor)
        this.drawUntilColor(state, accused, pd.untilColor);
      else this.giveCards(state, accused, pd.count);
      state.pendingDraw = null;
      this.pushEvent(state, { type: 'challengeWin', by: playerId, target: accused.id, amount: pd.count });
      this.resetTimer(state);
    } else {
      const challenger = state.players[idx];
      if (pd.type === 'wildDrawColor' && pd.untilColor) {
        this.drawUntilColor(state, challenger, pd.untilColor);
        this.giveCards(state, challenger, 2);
      } else {
        this.giveCards(state, challenger, pd.count + 2);
      }
      state.pendingDraw = null;
      this.pushEvent(state, { type: 'challengeLoss', by: playerId, amount: pd.count + 2 });
      this.advanceTurn(state, 1);
    }
    return this.settleOrEnd(state, { ok: true });
  }

  /** Seven-0: the player who played a 7 chooses whose hand to swap with. */
  chooseSeven(state: UnoGameState, playerId: string, targetId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING || state.pendingSevenBy !== playerId)
      return { ok: false, error: 'No swap to make' };
    const me = this.player(state, playerId);
    const target = this.player(state, targetId);
    if (!me || !target || target.eliminated || targetId === playerId)
      return { ok: false, error: 'Invalid swap target' };

    const tmp = me.hand;
    me.hand = target.hand;
    target.hand = tmp;
    me.handCount = me.hand.length;
    target.handCount = target.hand.length;
    this.refreshUno(state, me, false);
    this.refreshUno(state, target, false);
    state.pendingSevenBy = null;
    this.pushEvent(state, { type: 'swap', by: playerId, target: targetId });
    this.advanceTurn(state, 1);
    return this.settleOrEnd(state, { ok: true });
  }

  /** Out-of-turn Jump-In on an identical card (Custom). */
  jumpIn(
    state: UnoGameState,
    playerId: string,
    cardId: string,
    chosenColor?: UnoColor,
  ): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING || !state.jumpIn)
      return { ok: false, error: 'Jump-in not allowed' };
    if (state.pendingDraw || state.pendingSevenBy || state.drawnCardId)
      return { ok: false, error: 'Cannot jump in right now' };
    const idx = this.indexOf(state, playerId);
    if (idx < 0 || state.players[idx].eliminated)
      return { ok: false, error: 'You are not in this game' };
    const card = state.players[idx].hand.find((c) => c.id === cardId);
    if (!card || !this.isExactMatch(state, card))
      return { ok: false, error: 'Not an identical card' };

    state.currentIndex = idx;
    state.drawnCardId = null;
    return this.play(state, playerId, cardId, chosenColor);
  }

  callUno(state: UnoGameState, playerId: string): UnoActionResult {
    const player = this.player(state, playerId);
    if (!player) return { ok: false, error: 'You are not in this game' };
    if (player.handCount !== 1) return { ok: false, error: 'You can only call UNO on your last card' };
    player.calledUno = true;
    player.unoVulnerable = false;
    if (state.unoWindowFor === playerId) state.unoWindowFor = null;
    this.pushEvent(state, { type: 'uno', by: playerId });
    return { ok: true };
  }

  catchPlayer(state: UnoGameState, catcherId: string, targetId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING) return { ok: false, error: 'Round is not in progress' };
    if (catcherId === targetId) return { ok: false, error: 'You cannot catch yourself' };
    if (this.indexOf(state, catcherId) < 0) return { ok: false, error: 'Only players can catch' };
    const target = this.player(state, targetId);
    if (!target || !target.unoVulnerable || state.unoWindowFor !== targetId)
      return { ok: false, error: 'Nothing to catch' };
    this.giveCards(state, target, 2);
    target.unoVulnerable = false;
    state.unoWindowFor = null;
    this.pushEvent(state, { type: 'caught', by: catcherId, target: targetId, amount: 2 });
    return this.settleOrEnd(state, { ok: true });
  }

  surrender(state: UnoGameState, playerId: string): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING) return { ok: false, error: 'Round is not in progress' };
    const idx = this.indexOf(state, playerId);
    if (idx < 0) return { ok: false, error: 'You are not in this game' };
    const player = state.players[idx];
    if (player.eliminated) return { ok: false, error: 'You are already out' };

    const wasCurrent = idx === state.currentIndex;
    this.eliminate(state, player);
    this.pushEvent(state, { type: 'surrender', by: playerId });

    if (state.pendingSevenBy === playerId) state.pendingSevenBy = null;
    if (wasCurrent) {
      state.pendingDraw = null;
      state.drawnCardId = null;
      this.advanceTurn(state, 1);
    }
    const end = this.checkLastStanding(state);
    return end ? { ok: true, roundResult: end } : { ok: true };
  }

  timeout(state: UnoGameState): UnoActionResult {
    if (state.phase !== UnoPhase.PLAYING) return { ok: false };
    const current = state.players[state.currentIndex];
    if (!current) return { ok: false };
    this.closeStaleUnoWindow(state, current.id);

    if (state.pendingSevenBy === current.id) {
      const target = state.players.find((p) => p.id !== current.id && !p.eliminated);
      if (target) return this.chooseSeven(state, current.id, target.id);
      state.pendingSevenBy = null;
      this.advanceTurn(state, 1);
      return this.settleOrEnd(state, { ok: true });
    }
    if (state.pendingDraw) {
      this.resolveTake(state, current.id);
      return this.settleOrEnd(state, { ok: true });
    }
    if (state.drawnCardId) {
      state.drawnCardId = null;
      this.advanceTurn(state, 1);
      return { ok: true };
    }
    this.giveCards(state, current, 1);
    this.pushEvent(state, { type: 'draw', by: current.id, amount: 1 });
    this.advanceTurn(state, 1);
    return this.settleOrEnd(state, { ok: true });
  }

  setConnected(state: UnoGameState, playerId: string, connected: boolean): void {
    const p = this.player(state, playerId);
    if (p) p.isConnected = connected;
  }

  addSpectator(state: UnoGameState, id: string): boolean {
    if (this.indexOf(state, id) >= 0) return false;
    if (state.spectators.includes(id)) return true;
    if (state.spectators.length >= UNO_SPECTATOR_CAP) return false;
    state.spectators.push(id);
    return true;
  }

  removeSpectator(state: UnoGameState, id: string): void {
    state.spectators = state.spectators.filter((s) => s !== id);
  }

  // ─── Redacted projection ───────────────────────────────────────────

  getPlayerView(state: UnoGameState, recipientId: string): UnoPlayerView {
    const meIdx = this.indexOf(state, recipientId);
    const isPlayer = meIdx >= 0;
    const me = isPlayer ? state.players[meIdx] : null;

    const players = state.players.map((p) => ({
      id: p.id,
      name: p.name,
      handCount: p.handCount,
      isConnected: p.isConnected,
      calledUno: p.calledUno,
      unoVulnerable: p.unoVulnerable,
      score: p.score,
      eliminated: p.eliminated,
    }));
    const scores: Record<string, number> = {};
    for (const p of state.players) scores[p.id] = p.score;

    const active = !!me && !me.eliminated;
    const isMyTurn =
      active && meIdx === state.currentIndex && state.phase === UnoPhase.PLAYING;

    return {
      gameId: state.gameId,
      lobbyCode: state.lobbyCode,
      mode: state.mode,
      role: isPlayer ? 'player' : 'spectator',
      phase: state.phase,
      side: state.side,
      youId: me ? me.id : null,
      yourHand: me ? me.hand.slice() : [],
      players,
      direction: state.direction,
      currentPlayerId: state.players[state.currentIndex]?.id ?? null,
      activeColor: state.activeColor,
      topCard: this.top(state),
      drawPileCount: state.drawPile.length,
      discardCount: state.discardPile.length,
      pendingDraw: state.pendingDraw
        ? {
            count: state.pendingDraw.count,
            type: state.pendingDraw.type,
            untilColor: state.pendingDraw.untilColor,
            challengeable: state.pendingDraw.challengeable,
          }
        : null,
      awaitingSevenTarget: active && state.pendingSevenBy === recipientId,
      playableDrawnCardId: isMyTurn ? state.drawnCardId : null,
      turnStartedAt: state.turnStartedAt,
      turnEndsAt: state.turnEndsAt,
      targetScore: state.targetScore,
      mercyLimit: state.mercyLimit,
      stacking: state.stacking,
      roundNumber: state.roundNumber,
      roundWinnerId: state.roundWinnerId,
      matchWinnerId: state.matchWinnerId,
      scores,
      events: state.events.slice(-UNO_CONSTANTS.EVENT_LOG_LIMIT),
      legalCardIds: isMyTurn ? this.legalCardIds(state, recipientId) : [],
      canDraw: isMyTurn && !state.pendingDraw && !state.drawnCardId && !state.pendingSevenBy,
      canPass: isMyTurn && !!state.drawnCardId && !state.forcePlay,
      canCallUno: active && !!me && me.handCount === 1 && !me.calledUno,
      canChallenge:
        isMyTurn && !!state.pendingDraw?.challengeable && !state.noBluffing,
      canTake: isMyTurn && !!state.pendingDraw,
      canSurrender: active && state.phase === UnoPhase.PLAYING && this.activeCount(state) >= 2,
      jumpInIds:
        active && state.jumpIn && !isMyTurn && !state.pendingDraw && !state.pendingSevenBy
          ? me!.hand.filter((c) => this.isExactMatch(state, c)).map((c) => c.id)
          : [],
      catchableIds:
        isPlayer && state.unoWindowFor && state.unoWindowFor !== recipientId
          ? [state.unoWindowFor]
          : [],
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private applyEffect(
    state: UnoGameState,
    f: UnoCardFace,
    prevColor: UnoColor,
    playerId: string,
  ): void {
    if (isDrawKind(f.kind)) {
      this.applyDrawCard(state, f, prevColor, playerId);
      return;
    }
    let steps = 1;
    if (f.kind === 'skip') {
      steps = 2;
      this.pushEvent(state, { type: 'skip', by: playerId });
    } else if (f.kind === 'skipAll') {
      steps = 0; // everyone else skipped → play again
      this.pushEvent(state, { type: 'skip', by: playerId });
    } else if (f.kind === 'reverse') {
      state.direction = (state.direction * -1) as 1 | -1;
      this.pushEvent(state, { type: 'reverse', by: playerId });
      if (this.activeCount(state) === 2) steps = 2;
    }
    this.advanceTurn(state, steps);
  }

  private applyDrawCard(
    state: UnoGameState,
    f: UnoCardFace,
    prevColor: UnoColor,
    playerId: string,
  ): void {
    if (f.kind === 'reverseDraw4') {
      state.direction = (state.direction * -1) as 1 | -1;
      this.pushEvent(state, { type: 'reverse', by: playerId });
    }
    const type = f.kind as UnoDrawKind;
    const isUntil = type === 'wildDrawColor';
    const amount = drawAmount(type);
    const challengeable = WILD_DRAW_KINDS.has(type);

    if (state.pendingDraw) {
      const pd = state.pendingDraw;
      pd.count += amount;
      pd.type = type;
      pd.untilColor = isUntil ? state.activeColor : pd.untilColor;
      pd.challengeable = challengeable;
      if (challengeable) {
        pd.wild4By = playerId;
        pd.wild4PrevColor = prevColor;
      }
    } else {
      state.pendingDraw = {
        count: amount,
        type,
        untilColor: isUntil ? state.activeColor : null,
        challengeable,
        wild4By: challengeable ? playerId : null,
        wild4PrevColor: challengeable ? prevColor : null,
        reverseOnResolve: false,
      };
    }
    this.advanceTurn(state, 1);
    this.settlePendingForCurrent(state);
  }

  /** Whether a played card may stack onto the pending draw (mode-dependent). */
  private canStack(state: UnoGameState, kind: string, pd: UnoGameState['pendingDraw']): boolean {
    if (!pd || !isDrawKind(kind)) return false;
    if (state.mode === 'noMercy') return pd.type !== 'wildDrawColor';
    if (state.mode === 'flip') return false;
    if (!state.stacking) return false;
    // Custom stacking: only +2 on +2 and +4 on +4.
    if (pd.type === 'draw2') return kind === 'draw2';
    if (pd.type === 'wild4') return kind === 'wild4';
    return false;
  }

  private settlePendingForCurrent(state: UnoGameState): void {
    const pd = state.pendingDraw;
    if (!pd) return;
    const current = state.players[state.currentIndex];
    const canStack = current.hand.some((c) => this.canStack(state, faceOf(c, state.side).kind, pd));
    const canChallenge = pd.challengeable && !state.noBluffing;
    if (!canStack && !canChallenge) this.resolveTake(state, current.id);
  }

  private resolveTake(state: UnoGameState, playerId: string): void {
    const pd = state.pendingDraw;
    if (!pd) return;
    const player = this.player(state, playerId);
    if (!player) return;
    if (pd.type === 'wildDrawColor' && pd.untilColor) {
      this.drawUntilColor(state, player, pd.untilColor);
    } else {
      this.giveCards(state, player, pd.count);
    }
    this.pushEvent(state, { type: 'take', by: playerId, amount: pd.count });
    state.pendingDraw = null;
    this.advanceTurn(state, 1);
  }

  private drawUntilColor(state: UnoGameState, player: UnoPlayerState, color: UnoColor): void {
    let guard = 0;
    while (guard < 60) {
      guard += 1;
      const drawn = this.giveCards(state, player, 1)[0];
      if (!drawn || player.eliminated) break;
      if (faceOf(drawn, state.side).color === color) break;
      if (state.drawPile.length + state.discardPile.length <= 1) break;
    }
  }

  private rotateHands(state: UnoGameState): void {
    const active = state.players.filter((p) => !p.eliminated);
    if (active.length < 2) return;
    const hands = active.map((p) => p.hand);
    // Pass each hand to the next active player in the direction of play.
    for (let i = 0; i < active.length; i += 1) {
      const src = state.direction === 1
        ? (i - 1 + active.length) % active.length
        : (i + 1) % active.length;
      active[i].hand = hands[src];
      active[i].handCount = active[i].hand.length;
    }
    for (const p of active) this.refreshUno(state, p, false);
    this.pushEvent(state, { type: 'rotate', by: null });
  }

  private giveCards(state: UnoGameState, player: UnoPlayerState, n: number): UnoCard[] {
    const drawn: UnoCard[] = [];
    for (let i = 0; i < n; i += 1) {
      if (state.drawPile.length === 0) this.reshuffle(state);
      const card = state.drawPile.pop();
      if (!card) break;
      player.hand.push(card);
      drawn.push(card);
    }
    player.handCount = player.hand.length;
    if (player.handCount !== 1) {
      player.unoVulnerable = false;
      player.calledUno = false;
      if (state.unoWindowFor === player.id) state.unoWindowFor = null;
    }
    // No Mercy knockout.
    if (state.mercyLimit && player.handCount >= state.mercyLimit && !player.eliminated) {
      this.eliminate(state, player);
      this.pushEvent(state, { type: 'eliminated', by: player.id });
    }
    return drawn;
  }

  private eliminate(state: UnoGameState, player: UnoPlayerState): void {
    player.eliminated = true;
    player.unoVulnerable = false;
    player.calledUno = false;
    if (state.unoWindowFor === player.id) state.unoWindowFor = null;
    if (player.hand.length) {
      state.drawPile.push(...player.hand);
      state.drawPile = shuffle(state.drawPile);
      player.hand = [];
      player.handCount = 0;
    }
  }

  private reshuffle(state: UnoGameState): void {
    // Preferred: recycle the discard pile (all but the top) — no new cards, so
    // the exact deck composition is preserved.
    if (state.discardPile.length > 1) {
      const top = state.discardPile.pop()!;
      state.drawPile = shuffle([...state.drawPile, ...state.discardPile]);
      state.discardPile = [top];
      this.pushEvent(state, { type: 'reshuffle', by: null });
      return;
    }
    // Exhausted (almost every card is held in hands): mint one fresh, shuffled
    // deck for the current mode. Supply is effectively infinite, and because a
    // whole deck is injected the colour/number/action/wild ratios stay balanced.
    state.drawPile = shuffle([...state.drawPile, ...buildDeckForMode(state.mode)]);
    this.pushEvent(state, { type: 'reshuffle', by: null });
  }

  private refreshUno(state: UnoGameState, player: UnoPlayerState, openWindow: boolean): void {
    if (player.hand.length === 1) {
      player.unoVulnerable = openWindow;
      player.calledUno = false;
      if (openWindow) state.unoWindowFor = player.id;
    } else {
      player.unoVulnerable = false;
      player.calledUno = false;
      if (state.unoWindowFor === player.id) state.unoWindowFor = null;
    }
  }

  private advanceTurn(state: UnoGameState, steps: number): void {
    state.currentIndex = this.step(state, state.currentIndex, steps);
    state.drawnCardId = null;
    this.resetTimer(state);
  }

  /** Move `steps` active players from `from` in the current direction. */
  private step(state: UnoGameState, from: number, steps: number): number {
    const n = state.players.length;
    if (steps <= 0) return from;
    let idx = from;
    let moved = 0;
    let guard = 0;
    while (moved < steps && guard < n * (steps + 2) + 4) {
      idx = (idx + state.direction + n) % n;
      if (!state.players[idx].eliminated) moved += 1;
      guard += 1;
    }
    return idx;
  }

  private closeStaleUnoWindow(state: UnoGameState, actingPlayerId: string): void {
    if (state.unoWindowFor && state.unoWindowFor !== actingPlayerId) {
      const p = this.player(state, state.unoWindowFor);
      if (p) p.unoVulnerable = false;
      state.unoWindowFor = null;
    }
  }

  /** If the action left a single active player, end the match for them. */
  private settleOrEnd(state: UnoGameState, res: UnoActionResult): UnoActionResult {
    if (res.roundResult) return res;
    const end = this.checkLastStanding(state);
    return end ? { ...res, roundResult: end } : res;
  }

  private checkLastStanding(state: UnoGameState): UnoRoundResult | null {
    if (state.phase !== UnoPhase.PLAYING) return null;
    const activePlayers = state.players.filter((p) => !p.eliminated);
    if (activePlayers.length > 1) return null;
    const winner = activePlayers[0] ?? state.players[0];
    state.phase = UnoPhase.FINISHED;
    state.matchWinnerId = winner.id;
    state.roundWinnerId = winner.id;
    state.finishedAt = Date.now();
    state.pendingDraw = null;
    state.pendingSevenBy = null;
    state.unoWindowFor = null;
    this.pushEvent(state, { type: 'gameOver', by: winner.id });
    const scores: Record<string, number> = {};
    for (const p of state.players) scores[p.id] = p.score;
    return {
      roundWinnerId: winner.id,
      roundWinnerName: winner.name,
      points: 0,
      scores,
      matchOver: true,
      matchWinnerId: winner.id,
      reason: 'lastStanding',
    };
  }

  private endRound(state: UnoGameState, winner: UnoPlayerState): UnoActionResult {
    state.roundWinnerId = winner.id;
    state.unoWindowFor = null;
    state.pendingDraw = null;
    state.pendingSevenBy = null;
    state.drawnCardId = null;

    // No Mercy: going out ends the whole game immediately (no scoring).
    if (state.mode === 'noMercy') {
      state.phase = UnoPhase.FINISHED;
      state.matchWinnerId = winner.id;
      state.finishedAt = Date.now();
      this.pushEvent(state, { type: 'gameOver', by: winner.id });
      return {
        ok: true,
        roundResult: this.result(state, winner, 0, true, 'single'),
      };
    }

    const points = state.players
      .filter((p) => p.id !== winner.id && !p.eliminated)
      .reduce((sum, p) => sum + handPoints(p.hand, state.side, state.mode), 0);
    winner.score += points;

    const target = state.targetScore;
    const matchOver = target === null || winner.score >= target;
    if (matchOver) {
      state.phase = UnoPhase.FINISHED;
      state.matchWinnerId = winner.id;
      state.finishedAt = Date.now();
      this.pushEvent(state, { type: 'gameOver', by: winner.id, amount: winner.score });
      return {
        ok: true,
        roundResult: this.result(state, winner, points, true, target === null ? 'single' : 'target'),
      };
    }
    state.phase = UnoPhase.ROUND_OVER;
    this.pushEvent(state, { type: 'roundOver', by: winner.id, amount: points });
    return { ok: true, roundResult: this.result(state, winner, points, false) };
  }

  private result(
    state: UnoGameState,
    winner: UnoPlayerState,
    points: number,
    matchOver: boolean,
    reason?: UnoRoundResult['reason'],
  ): UnoRoundResult {
    const scores: Record<string, number> = {};
    for (const p of state.players) scores[p.id] = p.score;
    return {
      roundWinnerId: winner.id,
      roundWinnerName: winner.name,
      points,
      scores,
      matchOver,
      matchWinnerId: matchOver ? winner.id : null,
      reason,
    };
  }

  private legalCardIds(state: UnoGameState, playerId: string): string[] {
    const player = this.player(state, playerId);
    if (!player || state.pendingSevenBy) return [];
    const pd = state.pendingDraw;
    if (pd) {
      return player.hand
        .filter((c) => this.canStack(state, faceOf(c, state.side).kind, pd))
        .map((c) => c.id);
    }
    if (state.drawnCardId) return [state.drawnCardId];
    return player.hand
      .filter((c) => {
        if (!cardMatches(c, state.activeColor, this.top(state), state.side)) return false;
        const kind = faceOf(c, state.side).kind;
        if (
          state.noBluffing &&
          (kind === 'wild4' || kind === 'reverseDraw4') &&
          this.hasActiveColor(state, player)
        )
          return false;
        return true;
      })
      .map((c) => c.id);
  }

  private isExactMatch(state: UnoGameState, card: UnoCard): boolean {
    const top = this.top(state);
    if (!top) return false;
    const a = faceOf(card, state.side);
    const b = faceOf(top, state.side);
    if (isWildKind(a.kind) || isWildKind(b.kind)) return false;
    if (a.kind !== b.kind || a.color !== b.color) return false;
    if (a.kind === 'number') return a.value === b.value;
    return true;
  }

  private hasActiveColor(state: UnoGameState, player: UnoPlayerState): boolean {
    return player.hand.some((c) => {
      const face = faceOf(c, state.side);
      return !isWildKind(face.kind) && face.color === state.activeColor;
    });
  }

  private isWildFace(f: UnoCardFace): boolean {
    return isWildKind(f.kind) && f.kind !== 'flip';
  }

  private paletteFor(side: UnoSide): readonly UnoColor[] {
    return side === 'dark' ? UNO_DARK_COLORS : UNO_LIGHT_COLORS;
  }

  private activeCount(state: UnoGameState): number {
    return state.players.filter((p) => !p.eliminated).length;
  }

  private pushEvent(state: UnoGameState, ev: Omit<UnoEvent, 'id'>): void {
    state.eventSeq += 1;
    state.events.push({ id: state.eventSeq, ...ev });
    if (state.events.length > UNO_CONSTANTS.EVENT_LOG_LIMIT * 2)
      state.events = state.events.slice(-UNO_CONSTANTS.EVENT_LOG_LIMIT);
  }

  private resetTimer(state: UnoGameState): void {
    state.turnStartedAt = Date.now();
    state.turnEndsAt = state.turnStartedAt + UNO_CONSTANTS.TURN_MS;
  }

  private top(state: UnoGameState): UnoCard | null {
    return state.discardPile[state.discardPile.length - 1] ?? null;
  }

  private indexOf(state: UnoGameState, playerId: string): number {
    return state.players.findIndex((p) => p.id === playerId);
  }

  private player(state: UnoGameState, playerId: string): UnoPlayerState | null {
    return state.players.find((p) => p.id === playerId) ?? null;
  }
}

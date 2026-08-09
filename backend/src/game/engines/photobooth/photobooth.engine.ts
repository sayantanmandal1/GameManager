import {
  PhotoboothGameState,
  PhotoboothPlayerView,
  PhotoboothPhase,
  PhotoboothLayout,
  PhotoboothThemeId,
  PhotoboothFilter,
  PhotoboothSlot,
  PHOTOBOOTH_SLOTS,
  PHOTOBOOTH_LAYOUTS,
  PHOTOBOOTH_THEMES,
  PHOTOBOOTH_FILTERS,
  PHOTOBOOTH_MAX_DATAURL_LENGTH,
  PHOTOBOOTH_MAX_DECODED_BYTES,
  PHOTOBOOTH_MAX_EDGE_PX,
  PHOTOBOOTH_MAX_PIXELS,
  PHOTOBOOTH_MIN_DATAURL_LENGTH,
  PHOTOBOOTH_DATAURL_PATTERN,
} from '../../../shared';
import sharp from 'sharp';

export interface PhotoboothResult {
  valid: boolean;
  reason?: string;
  /** A row was committed to the strip this action. */
  committed?: boolean;
  /** The strip is now complete (moved to REVIEW). */
  finished?: boolean;
}

/**
 * Pure, in-memory state machine for the 2-player Photobooth game. Mirrors the
 * engine style used by Bingo/Ludo: mutates the passed state and returns a
 * {valid,reason} result. No I/O, no timers — the gateway/service own those.
 *
 * SECURITY_NOTE: every mutator re-validates the actor's identity and the
 * current phase, and all client-supplied strings (layout/theme/filter/image)
 * are checked against allow-lists before being stored.
 */
export class PhotoboothEngine {
  initGame(
    gameId: string,
    lobbyCode: string,
    hostId: string,
    guestId: string,
    hostName: string,
    guestName: string,
  ): PhotoboothGameState {
    return {
      gameId,
      lobbyCode,
      hostId,
      guestId,
      hostName,
      guestName,
      phase: PhotoboothPhase.SETUP,
      layout: 'strip-1x4',
      theme: 'blush',
      filter: 'none',
      currentRound: 0,
      totalRounds: PHOTOBOOTH_SLOTS,
      slots: Array.from({ length: PHOTOBOOTH_SLOTS }, () => ({
        left: null,
        right: null,
      })) as PhotoboothSlot[],
      pending: {},
      disconnected: [],
      createdAt: Date.now(),
      finishedAt: null,
    };
  }

  /** Host tweaks the layout/theme during SETUP (live-previewed by the guest). */
  configure(
    state: PhotoboothGameState,
    playerId: string,
    layout: PhotoboothLayout,
    theme: PhotoboothThemeId,
  ): PhotoboothResult {
    if (state.phase !== PhotoboothPhase.SETUP)
      return { valid: false, reason: 'Not in setup phase' };
    if (playerId !== state.hostId)
      return { valid: false, reason: 'Only the host can choose the frame' };
    if (!PHOTOBOOTH_LAYOUTS.includes(layout))
      return { valid: false, reason: 'Invalid layout' };
    if (!PHOTOBOOTH_THEMES.includes(theme))
      return { valid: false, reason: 'Invalid theme' };

    state.layout = layout;
    state.theme = theme;
    return { valid: true };
  }

  /** Host locks in the frame and starts the capture sequence. */
  startCapture(state: PhotoboothGameState, playerId: string): PhotoboothResult {
    if (state.phase !== PhotoboothPhase.SETUP)
      return { valid: false, reason: 'Already started' };
    if (playerId !== state.hostId)
      return { valid: false, reason: 'Only the host can start' };
    if (!state.guestId)
      return { valid: false, reason: 'Waiting for your partner to join' };

    state.phase = PhotoboothPhase.CAPTURE;
    state.currentRound = 0;
    state.pending = {};
    return { valid: true };
  }

  /**
   * A partner captures (or retakes) their half for the current round. Storing
   * a new capture always resets the confirmed flag so a retake un-commits.
   */
  async capture(
    state: PhotoboothGameState,
    playerId: string,
    dataUrl: string,
  ): Promise<PhotoboothResult> {
    if (state.phase !== PhotoboothPhase.CAPTURE)
      return { valid: false, reason: 'Not capturing right now' };
    if (!this.isSeat(state, playerId))
      return { valid: false, reason: 'You are not a player in this game' };
    if (!(await PhotoboothEngine.isValidImage(dataUrl)))
      return { valid: false, reason: 'Invalid image' };

    const existing = state.pending[playerId];
    if (existing?.confirmed)
      return { valid: false, reason: 'Already locked in for this photo' };

    state.pending[playerId] = { dataUrl, confirmed: false };
    return { valid: true };
  }

  /** Discard my in-flight capture for this round (before I confirm it). */
  retake(state: PhotoboothGameState, playerId: string): PhotoboothResult {
    if (state.phase !== PhotoboothPhase.CAPTURE)
      return { valid: false, reason: 'Not capturing right now' };
    if (!this.isSeat(state, playerId))
      return { valid: false, reason: 'You are not a player in this game' };

    const existing = state.pending[playerId];
    if (!existing) return { valid: false, reason: 'Nothing to retake' };
    if (existing.confirmed)
      return { valid: false, reason: 'Already locked in for this photo' };

    delete state.pending[playerId];
    return { valid: true };
  }

  /**
   * Confirm ("continue"). Requires a capture to exist. When BOTH partners have
   * confirmed, the row is committed and the game advances (next round or
   * REVIEW).
   */
  confirm(state: PhotoboothGameState, playerId: string): PhotoboothResult {
    if (state.phase !== PhotoboothPhase.CAPTURE)
      return { valid: false, reason: 'Not capturing right now' };
    if (!this.isSeat(state, playerId))
      return { valid: false, reason: 'You are not a player in this game' };

    const mine = state.pending[playerId];
    if (!mine) return { valid: false, reason: 'Take a photo first' };
    mine.confirmed = true;

    const hostCapture = state.pending[state.hostId];
    const guestCapture = state.guestId ? state.pending[state.guestId] : undefined;
    const bothReady = !!hostCapture?.confirmed && !!guestCapture?.confirmed;
    if (!bothReady) return { valid: true };

    // Commit the combined row.
    const slot = state.slots[state.currentRound];
    slot.left = hostCapture!.dataUrl;
    slot.right = guestCapture!.dataUrl;
    state.pending = {};

    if (state.currentRound >= state.totalRounds - 1) {
      state.phase = PhotoboothPhase.REVIEW;
      state.finishedAt = Date.now();
      return { valid: true, committed: true, finished: true };
    }

    state.currentRound += 1;
    return { valid: true, committed: true };
  }

  /** Either partner picks the keepsake filter during REVIEW (broadcast to both). */
  setFilter(
    state: PhotoboothGameState,
    playerId: string,
    filter: PhotoboothFilter,
  ): PhotoboothResult {
    if (state.phase !== PhotoboothPhase.REVIEW)
      return { valid: false, reason: 'Not ready to style yet' };
    if (!this.isSeat(state, playerId))
      return { valid: false, reason: 'You are not a player in this game' };
    if (!PHOTOBOOTH_FILTERS.includes(filter))
      return { valid: false, reason: 'Invalid filter' };

    state.filter = filter;
    return { valid: true };
  }

  setConnected(
    state: PhotoboothGameState,
    playerId: string,
    connected: boolean,
  ): void {
    const isDown = state.disconnected.includes(playerId);
    if (connected && isDown) {
      state.disconnected = state.disconnected.filter((id) => id !== playerId);
    } else if (!connected && !isDown && this.isSeat(state, playerId)) {
      state.disconnected.push(playerId);
    }
  }

  getPlayerView(
    state: PhotoboothGameState,
    playerId: string,
  ): PhotoboothPlayerView | null {
    if (!this.isSeat(state, playerId)) return null;
    const isHost = playerId === state.hostId;
    const partnerId = isHost ? state.guestId : state.hostId;
    const mine = state.pending[playerId] ?? null;
    const partner = partnerId ? state.pending[partnerId] : undefined;

    return {
      gameId: state.gameId,
      lobbyCode: state.lobbyCode,
      role: isHost ? 'host' : 'guest',
      side: isHost ? 'left' : 'right',
      phase: state.phase,
      layout: state.layout,
      theme: state.theme,
      filter: state.filter,
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      slots: state.slots,
      hostName: state.hostName,
      guestName: state.guestName,
      hostId: state.hostId,
      guestId: state.guestId,
      // Only expose my own in-flight capture — partner's stays hidden until
      // the synchronized reveal on commit.
      myCapture: mine?.dataUrl ?? null,
      iConfirmed: mine?.confirmed ?? false,
      partnerConfirmed: partner?.confirmed ?? false,
      partnerConnected: partnerId ? !state.disconnected.includes(partnerId) : false,
      finishedAt: state.finishedAt,
    };
  }

  private isSeat(state: PhotoboothGameState, playerId: string): boolean {
    return playerId === state.hostId || playerId === state.guestId;
  }

  /**
   * Validate an incoming capture payload. SECURITY_NOTE: bounds length and
   * restricts to image data URLs so the value can be safely rendered via
   * <img src> (no javascript:/data:text XSS vector) and cannot be used to
   * DoS the socket layer with an oversized frame.
   */
  static async isValidImage(dataUrl: unknown): Promise<boolean> {
    if (typeof dataUrl !== 'string') return false;
    if (
      dataUrl.length < PHOTOBOOTH_MIN_DATAURL_LENGTH ||
      dataUrl.length > PHOTOBOOTH_MAX_DATAURL_LENGTH
    )
      return false;

    const match = PHOTOBOOTH_DATAURL_PATTERN.exec(dataUrl);
    if (!match) return false;

    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length === 0 || bytes.length > PHOTOBOOTH_MAX_DECODED_BYTES)
      return false;
    if (bytes.toString('base64') !== encoded) return false;

    try {
      const dimensions = await sharp(bytes, {
        failOn: 'warning',
        limitInputPixels: PHOTOBOOTH_MAX_PIXELS,
      }).metadata();
      return (
        dimensions.format === match[1] &&
        typeof dimensions.width === 'number' &&
        typeof dimensions.height === 'number' &&
        dimensions.width > 0 &&
        dimensions.height > 0 &&
        dimensions.width <= PHOTOBOOTH_MAX_EDGE_PX &&
        dimensions.height <= PHOTOBOOTH_MAX_EDGE_PX &&
        dimensions.width * dimensions.height <= PHOTOBOOTH_MAX_PIXELS
      );
    } catch {
      return false;
    }
  }
}

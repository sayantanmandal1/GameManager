import { PhotoboothEngine } from './photobooth.engine';
import {
  PhotoboothPhase,
  PHOTOBOOTH_SLOTS,
  PHOTOBOOTH_MAX_DATAURL_LENGTH,
  type PhotoboothGameState,
} from '../../../shared';

const HOST = 'host-id';
const GUEST = 'guest-id';
const GID = 'game-1';
const CODE = '123456';

// A valid 1x1 PNG used as a camera capture fixture.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const IMG = `data:image/png;base64,${PNG_BASE64}`;
const IMG2 = IMG;

function oversizedPng(): string {
  const bytes = Buffer.from(PNG_BASE64, 'base64');
  bytes.writeUInt32BE(100_000, 16);
  bytes.writeUInt32BE(100_000, 20);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function newGame(engine: PhotoboothEngine): PhotoboothGameState {
  return engine.initGame(GID, CODE, HOST, GUEST, 'Janice', 'Gavin');
}

describe('PhotoboothEngine', () => {
  let engine: PhotoboothEngine;
  let state: PhotoboothGameState;

  beforeEach(() => {
    engine = new PhotoboothEngine();
    state = newGame(engine);
  });

  describe('initGame', () => {
    it('starts in SETUP with an empty strip', () => {
      expect(state.phase).toBe(PhotoboothPhase.SETUP);
      expect(state.totalRounds).toBe(PHOTOBOOTH_SLOTS);
      expect(state.slots).toHaveLength(PHOTOBOOTH_SLOTS);
      expect(state.slots.every((s) => s.left === null && s.right === null)).toBe(
        true,
      );
      expect(state.currentRound).toBe(0);
    });
  });

  describe('configure', () => {
    it('lets the host set layout + theme', () => {
      const r = engine.configure(state, HOST, 'grid-2x2', 'denim');
      expect(r.valid).toBe(true);
      expect(state.layout).toBe('grid-2x2');
      expect(state.theme).toBe('denim');
    });

    it('rejects the guest', () => {
      const r = engine.configure(state, GUEST, 'grid-2x2', 'denim');
      expect(r.valid).toBe(false);
    });

    it('rejects unknown layout / theme', () => {
      expect(
        engine.configure(state, HOST, 'nope' as never, 'denim').valid,
      ).toBe(false);
      expect(
        engine.configure(state, HOST, 'grid-2x2', 'nope' as never).valid,
      ).toBe(false);
    });

    it('rejects configuration outside SETUP', () => {
      engine.startCapture(state, HOST);
      expect(engine.configure(state, HOST, 'grid-2x2', 'denim').valid).toBe(
        false,
      );
    });
  });

  describe('startCapture', () => {
    it('host moves the game into CAPTURE', () => {
      const r = engine.startCapture(state, HOST);
      expect(r.valid).toBe(true);
      expect(state.phase).toBe(PhotoboothPhase.CAPTURE);
    });

    it('guest cannot start', () => {
      expect(engine.startCapture(state, GUEST).valid).toBe(false);
      expect(state.phase).toBe(PhotoboothPhase.SETUP);
    });
  });

  describe('capture / retake', () => {
    beforeEach(() => engine.startCapture(state, HOST));

    it('stores a pending, unconfirmed capture', async () => {
      const r = await engine.capture(state, HOST, IMG);
      expect(r.valid).toBe(true);
      expect(state.pending[HOST]).toEqual({ dataUrl: IMG, confirmed: false });
    });

    it('rejects invalid images', async () => {
      expect((await engine.capture(state, HOST, 'not-an-image')).valid).toBe(
        false,
      );
      expect(
        (
          await engine.capture(
            state,
            HOST,
            `data:image/gif;base64,${'A'.repeat(200)}`,
          )
        ).valid,
      ).toBe(false);
    });

    it('rejects a non-seat', async () => {
      expect((await engine.capture(state, 'stranger', IMG)).valid).toBe(false);
    });

    it('retake clears my pending capture', async () => {
      await engine.capture(state, HOST, IMG);
      expect(engine.retake(state, HOST).valid).toBe(true);
      expect(state.pending[HOST]).toBeUndefined();
    });

    it('cannot retake once confirmed', async () => {
      await engine.capture(state, HOST, IMG);
      engine.confirm(state, HOST);
      expect(engine.retake(state, HOST).valid).toBe(false);
    });
  });

  describe('confirm → commit', () => {
    beforeEach(() => engine.startCapture(state, HOST));

    it('needs a capture first', () => {
      expect(engine.confirm(state, HOST).valid).toBe(false);
    });

    it('does not commit until BOTH confirm', async () => {
      await engine.capture(state, HOST, IMG);
      const r = engine.confirm(state, HOST);
      expect(r.valid).toBe(true);
      expect(r.committed).toBeFalsy();
      expect(state.slots[0].left).toBeNull();
    });

    it('commits the row and advances when both confirm', async () => {
      await engine.capture(state, HOST, IMG);
      engine.confirm(state, HOST);
      await engine.capture(state, GUEST, IMG2);
      const r = engine.confirm(state, GUEST);
      expect(r.committed).toBe(true);
      expect(state.slots[0]).toEqual({ left: IMG, right: IMG2 });
      expect(state.currentRound).toBe(1);
      expect(state.pending).toEqual({});
    });

    it('finishes into REVIEW after the last round', async () => {
      for (let round = 0; round < PHOTOBOOTH_SLOTS; round += 1) {
        await engine.capture(state, HOST, IMG);
        engine.confirm(state, HOST);
        await engine.capture(state, GUEST, IMG2);
        const r = engine.confirm(state, GUEST);
        if (round < PHOTOBOOTH_SLOTS - 1) {
          expect(r.finished).toBeFalsy();
        } else {
          expect(r.finished).toBe(true);
        }
      }
      expect(state.phase).toBe(PhotoboothPhase.REVIEW);
      expect(state.finishedAt).not.toBeNull();
      expect(state.slots.every((s) => s.left && s.right)).toBe(true);
    });
  });

  describe('getPlayerView', () => {
    beforeEach(() => engine.startCapture(state, HOST));

    it('hides the partner’s unconfirmed capture but reports readiness', async () => {
      await engine.capture(state, HOST, IMG);
      engine.confirm(state, HOST);

      const guestView = engine.getPlayerView(state, GUEST)!;
      expect(guestView.role).toBe('guest');
      expect(guestView.side).toBe('right');
      expect(guestView.myCapture).toBeNull(); // guest hasn't captured
      expect(guestView.partnerConfirmed).toBe(true); // host confirmed

      const hostView = engine.getPlayerView(state, HOST)!;
      expect(hostView.myCapture).toBe(IMG);
      expect(hostView.iConfirmed).toBe(true);
      expect(hostView.partnerConfirmed).toBe(false);
    });

    it('returns null for a non-seat', () => {
      expect(engine.getPlayerView(state, 'stranger')).toBeNull();
    });
  });

  describe('setFilter', () => {
    it('is rejected before REVIEW', () => {
      expect(engine.setFilter(state, HOST, 'mono').valid).toBe(false);
    });

    it('is accepted in REVIEW', () => {
      state.phase = PhotoboothPhase.REVIEW;
      expect(engine.setFilter(state, GUEST, 'retro').valid).toBe(true);
      expect(state.filter).toBe('retro');
      expect(engine.setFilter(state, GUEST, 'bogus' as never).valid).toBe(false);
    });
  });

  describe('setConnected', () => {
    it('tracks disconnect / reconnect for seats only', () => {
      engine.setConnected(state, GUEST, false);
      expect(state.disconnected).toContain(GUEST);
      engine.setConnected(state, GUEST, true);
      expect(state.disconnected).not.toContain(GUEST);

      engine.setConnected(state, 'stranger', false);
      expect(state.disconnected).not.toContain('stranger');
    });
  });

  describe('isValidImage', () => {
    it('accepts a well-formed, bounded image data URL', async () => {
      await expect(PhotoboothEngine.isValidImage(IMG)).resolves.toBe(true);
      await expect(PhotoboothEngine.isValidImage(IMG2)).resolves.toBe(true);
    });

    it('rejects mismatched MIME types and oversized decoded dimensions', async () => {
      await expect(
        PhotoboothEngine.isValidImage(
          `data:image/jpeg;base64,${PNG_BASE64}`,
        ),
      ).resolves.toBe(false);
      await expect(
        PhotoboothEngine.isValidImage(oversizedPng()),
      ).resolves.toBe(false);
    });

    it('rejects non-strings, wrong mime, empty and oversized payloads', async () => {
      await expect(PhotoboothEngine.isValidImage(123 as never)).resolves.toBe(
        false,
      );
      await expect(
        PhotoboothEngine.isValidImage('data:text/html;base64,AAAA'),
      ).resolves.toBe(false);
      await expect(
        PhotoboothEngine.isValidImage('data:image/jpeg;base64,'),
      ).resolves.toBe(false);
      const huge = `data:image/jpeg;base64,${'A'.repeat(
        PHOTOBOOTH_MAX_DATAURL_LENGTH + 10,
      )}`;
      await expect(PhotoboothEngine.isValidImage(huge)).resolves.toBe(false);
    });
  });
});

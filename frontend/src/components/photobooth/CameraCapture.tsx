'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PHOTOBOOTH_MAX_DATAURL_LENGTH } from '@/shared';
import { photoboothStrings as S } from './strings';

interface CameraCaptureProps {
  /** Current 0-based round — changing it resets the local capture state. */
  round: number;
  /** My confirmed/pending capture from the server (data URL) if any. */
  myCapture: string | null;
  /** I have locked in this round. */
  iConfirmed: boolean;
  /** Partner has locked in. */
  partnerConfirmed: boolean;
  side: 'left' | 'right';
  onCapture: (dataUrl: string) => void;
  onRetake: () => void;
  onConfirm: () => void;
}

const TARGET_WIDTH = 640;

/** Downscale + compress a video frame to a bounded JPEG data URL. */
function frameToDataUrl(video: HTMLVideoElement): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // Center-crop to a square, then scale to TARGET_WIDTH.
  const size = Math.min(vw, vh);
  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_WIDTH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Mirror horizontally so the snapshot matches the selfie preview.
  ctx.translate(TARGET_WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, size, size, 0, 0, TARGET_WIDTH, TARGET_WIDTH);

  // Step quality down until the payload fits the transport cap.
  for (const q of [0.72, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= PHOTOBOOTH_MAX_DATAURL_LENGTH) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.3);
}

export function CameraCapture({
  round,
  myCapture,
  iConfirmed,
  partnerConfirmed,
  side,
  onCapture,
  onRetake,
  onConfirm,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [camError, setCamError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [localShot, setLocalShot] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCamError(S.capture.cameraDenied);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCamError(S.capture.cameraDenied);
    }
  }, []);

  // Acquire the camera once on mount; release on unmount.
  useEffect(() => {
    startCamera();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  // Reset local snapshot whenever a fresh round begins.
  useEffect(() => {
    setLocalShot(null);
    setCount(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [round]);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const url = frameToDataUrl(video);
    if (!url) return;
    setLocalShot(url);
    onCapture(url);
  }, [onCapture]);

  const beginCountdown = useCallback(() => {
    if (count !== null) return;
    let n = 3;
    setCount(n);
    countdownRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCount(null);
        snap();
      } else {
        setCount(n);
      }
    }, 1000);
  }, [count, snap]);

  const handleRetake = useCallback(() => {
    setLocalShot(null);
    onRetake();
  }, [onRetake]);

  const shot = localShot ?? myCapture;
  const showShot = !!shot;
  const accentRing = side === 'left' ? 'ring-rose-300' : 'ring-sky-300';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative aspect-square w-full max-w-[320px] overflow-hidden rounded-3xl bg-black/5 shadow-lg ring-4 ${accentRing}`}
      >
        {/* Live preview (mirrored) */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)', display: showShot ? 'none' : 'block' }}
        />

        {/* Frozen snapshot */}
        {showShot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot!}
            alt="Your capture"
            className="h-full w-full object-cover"
          />
        )}

        {/* Camera error overlay */}
        {camError && !showShot && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 p-6 text-center">
            <span className="text-3xl">📷</span>
            <p className="text-sm text-rose-500">{camError}</p>
            <button
              onClick={startCamera}
              className="rounded-full bg-rose-400 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-500"
            >
              {S.capture.cameraRetry}
            </button>
          </div>
        )}

        {/* Countdown overlay */}
        <AnimatePresence>
          {count !== null && (
            <motion.div
              key={count}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="text-8xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                {count}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Locked badge */}
        {iConfirmed && (
          <div className="absolute right-3 top-3 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-semibold text-white shadow">
            {S.capture.locked}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex min-h-[44px] items-center gap-3">
        {iConfirmed ? (
          <span className="text-sm font-medium text-rose-500">
            {partnerConfirmed ? S.capture.bothReady : S.capture.waitingPartner}
          </span>
        ) : showShot ? (
          <>
            <button
              onClick={handleRetake}
              className="rounded-full border border-rose-200 bg-white px-5 py-2 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
            >
              {S.capture.retake}
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onConfirm}
              className="rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-6 py-2 text-sm font-bold text-white shadow-md transition hover:from-rose-500 hover:to-pink-500"
            >
              {S.capture.continue}
            </motion.button>
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={!!camError || count !== null}
            onClick={beginCountdown}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-7 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-500 hover:to-pink-500 disabled:opacity-50"
          >
            <span className="text-lg">📸</span>
            {count !== null ? S.capture.smile : S.capture.takePhoto}
          </motion.button>
        )}
      </div>
    </div>
  );
}

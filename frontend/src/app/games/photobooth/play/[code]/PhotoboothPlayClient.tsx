'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuthStore } from '@/stores/authStore';
import { usePhotoboothStore } from '@/stores/photoboothStore';
import { useSocket } from '@/hooks/useSocket';
import { usePhotoboothSocket } from '@/hooks/usePhotoboothSocket';
import { getSocket } from '@/lib/socket';
import {
  LOBBY_EVENTS,
  PhotoboothPhase,
  type PhotoboothLayout,
  type PhotoboothThemeId,
} from '@/shared';
import {
  PhotoStrip,
  CameraCapture,
  StripLayoutPicker,
  ThemePicker,
  FilterPicker,
  photoboothStrings as S,
  downloadStripPng,
  downloadStripPdf,
} from '@/components/photobooth';

interface Props {
  code: string;
}

export default function PhotoboothPlayClient({ code }: Props) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { isConnected } = useSocket();
  usePhotoboothSocket(code);

  const view = usePhotoboothStore((s) => s.view);
  const error = usePhotoboothStore((s) => s.error);
  const complete = usePhotoboothStore((s) => s.complete);
  const configure = usePhotoboothStore((s) => s.configure);
  const startCapture = usePhotoboothStore((s) => s.startCapture);
  const capture = usePhotoboothStore((s) => s.capture);
  const retake = usePhotoboothStore((s) => s.retake);
  const confirm = usePhotoboothStore((s) => s.confirm);
  const setFilter = usePhotoboothStore((s) => s.setFilter);
  const reset = usePhotoboothStore((s) => s.reset);

  // Host's local frame selection (drives the live preview + syncs to guest).
  const [setupStep, setSetupStep] = useState<'strip' | 'theme'>('strip');
  const [localLayout, setLocalLayout] = useState<PhotoboothLayout>('strip-1x4');
  const [localTheme, setLocalTheme] = useState<PhotoboothThemeId>('blush');
  const inited = useRef(false);

  const [revealRound, setRevealRound] = useState<number | null>(null);
  const prevFilled = useRef(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!code) router.push('/games/photobooth');
  }, [code, router]);

  useEffect(() => () => reset(), [reset]);

  // Seed local frame choice from the first server view.
  useEffect(() => {
    if (view && !inited.current) {
      setLocalLayout(view.layout);
      setLocalTheme(view.theme);
      inited.current = true;
    }
  }, [view]);

  // Reveal animation whenever a new row is committed.
  const filledCount = useMemo(
    () => (view ? view.slots.filter((s) => s.left && s.right).length : 0),
    [view],
  );
  useEffect(() => {
    if (filledCount > prevFilled.current) {
      setRevealRound(filledCount - 1);
      const t = setTimeout(() => setRevealRound(null), 900);
      prevFilled.current = filledCount;
      return () => clearTimeout(t);
    }
    prevFilled.current = filledCount;
  }, [filledCount]);

  // Celebrate completion.
  useEffect(() => {
    if (!complete) return;
    const burst = (x: number) =>
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x, y: 0.6 },
        colors: ['#fb7185', '#f9a8d4', '#fda4af', '#fcd34d', '#a5b4fc'],
        scalar: 0.9,
      });
    burst(0.25);
    burst(0.75);
    const t = setTimeout(() => burst(0.5), 250);
    return () => clearTimeout(t);
  }, [complete]);

  const handleHostConfigure = useCallback(
    (layout: PhotoboothLayout, theme: PhotoboothThemeId) => {
      setLocalLayout(layout);
      setLocalTheme(theme);
      configure(layout, theme);
    },
    [configure],
  );

  const handleBackToLobby = useCallback(() => {
    getSocket()?.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
    reset();
    router.push(`/lobby/${code}`);
  }, [code, reset, router]);

  const handleDownload = useCallback(
    async (format: 'png' | 'pdf') => {
      if (!view) return;
      setDownloading(true);
      try {
        const args = {
          slots: view.slots,
          layout: view.layout,
          theme: view.theme,
          filter: view.filter,
          hostName: view.hostName,
          guestName: view.guestName,
        };
        if (format === 'pdf') {
          await downloadStripPdf(args);
        } else {
          await downloadStripPng(args);
        }
      } finally {
        setDownloading(false);
      }
    },
    [view],
  );

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50">
        <div className="text-center text-rose-400">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-rose-300 border-t-transparent" />
          <p>{isConnected ? S.errors.loading : S.errors.disconnected}</p>
        </div>
      </main>
    );
  }

  const isHost = view.role === 'host';
  const previewLayout = isHost ? localLayout : view.layout;
  const previewTheme = isHost ? localTheme : view.theme;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50 px-4 py-6 text-zinc-700">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={handleBackToLobby}
            className="text-sm text-zinc-400 transition hover:text-zinc-600"
          >
            ← {S.review.backToLobby}
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            <PhaseDot active={view.phase === PhotoboothPhase.SETUP} label="Setup" />
            <span>·</span>
            <PhaseDot active={view.phase === PhotoboothPhase.CAPTURE} label="Capture" />
            <span>·</span>
            <PhaseDot active={view.phase === PhotoboothPhase.REVIEW} label="Review" />
          </div>
          <span className="font-mono text-sm tracking-widest text-rose-400">
            #{code}
          </span>
        </div>

        {/* Partner presence */}
        <AnimatePresence>
          {!view.partnerConnected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-auto mb-4 w-fit rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-700 shadow-sm"
            >
              {S.presence.reconnecting(
                isHost ? view.guestName : view.hostName,
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="mx-auto mb-4 w-fit rounded-full bg-rose-100 px-4 py-2 text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        {/* ─── SETUP ─── */}
        {view.phase === PhotoboothPhase.SETUP && (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              {isHost ? (
                <div>
                  {setupStep === 'strip' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <h2 className="mb-1 text-center font-serif text-2xl font-bold text-rose-500">
                        {S.setup.chooseStrip}
                      </h2>
                      <p className="mb-6 text-center text-sm text-zinc-500">
                        {S.setup.stripHint}
                      </p>
                      <StripLayoutPicker
                        value={localLayout}
                        onChange={(l) => handleHostConfigure(l, localTheme)}
                      />
                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={() => setSetupStep('theme')}
                          className="rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-8 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-500 hover:to-pink-500"
                        >
                          {S.setup.next} ▸
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <h2 className="mb-1 text-center font-serif text-2xl font-bold text-rose-500">
                        {S.setup.chooseTheme}
                      </h2>
                      <p className="mb-6 text-center text-sm text-zinc-500">
                        {S.setup.themeHint}
                      </p>
                      <ThemePicker
                        value={localTheme}
                        onChange={(t) => handleHostConfigure(localLayout, t)}
                      />
                      <div className="mt-8 flex justify-center gap-3">
                        <button
                          onClick={() => setSetupStep('strip')}
                          className="rounded-full border border-rose-200 bg-white px-6 py-2.5 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
                        >
                          ◂ {S.setup.back}
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={startCapture}
                          className="rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-8 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-rose-500 hover:to-pink-500"
                        >
                          {S.setup.start}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl bg-white/60 p-10 text-center shadow-sm backdrop-blur">
                  <motion.span
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="mb-4 text-5xl"
                  >
                    💞
                  </motion.span>
                  <h2 className="font-serif text-2xl font-bold text-rose-500">
                    {S.setup.waitingTitle}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    {S.setup.waitingBody(view.hostName)}
                  </p>
                </div>
              )}
            </div>

            {/* Live preview */}
            <div className="flex flex-col items-center">
              <span className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                {S.setup.preview}
              </span>
              <PhotoStrip
                slots={emptySlots(view.totalRounds)}
                layout={previewLayout}
                theme={previewTheme}
                filter="none"
                hostName={view.hostName}
                guestName={view.guestName}
                placeholder
                maxWidth={previewLayout === 'grid-2x2' ? 320 : 220}
              />
            </div>
          </div>
        )}

        {/* ─── CAPTURE ─── */}
        {view.phase === PhotoboothPhase.CAPTURE && (
          <div>
            <div className="mb-6 text-center">
              <h2 className="font-serif text-2xl font-bold text-rose-500">
                {S.capture.round(view.currentRound + 1, view.totalRounds)}
              </h2>
              <div className="mt-3 flex justify-center gap-2">
                {Array.from({ length: view.totalRounds }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition ${
                      i < filledCount
                        ? 'bg-rose-400'
                        : i === view.currentRound
                          ? 'bg-rose-300 ring-2 ring-rose-200'
                          : 'bg-zinc-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid items-start gap-8 md:grid-cols-[1fr_260px]">
              {/* My camera */}
              <div className="flex flex-col items-center">
                <span className="mb-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-500">
                  {S.capture.you} · {view.side === 'left' ? '◧ left' : 'right ◨'}
                </span>
                <CameraCapture
                  round={view.currentRound}
                  myCapture={view.myCapture}
                  iConfirmed={view.iConfirmed}
                  partnerConfirmed={view.partnerConfirmed}
                  side={view.side}
                  onCapture={capture}
                  onRetake={retake}
                  onConfirm={confirm}
                />
              </div>

              {/* Partner status + strip so far */}
              <div className="flex flex-col items-center gap-5">
                <div
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 shadow-sm transition ${
                    view.partnerConfirmed
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-zinc-200 bg-white/70'
                  }`}
                >
                  <span className="text-2xl">
                    {view.partnerConfirmed ? '💞' : '⏳'}
                  </span>
                  <div className="text-sm">
                    <div className="font-semibold text-zinc-600">
                      {isHost ? view.guestName : view.hostName}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {view.partnerConfirmed
                        ? S.capture.partnerReady
                        : S.capture.waitingPartner}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    {S.capture.stripSoFar}
                  </span>
                  <PhotoStrip
                    slots={view.slots}
                    layout={view.layout}
                    theme={view.theme}
                    filter={view.filter}
                    hostName={view.hostName}
                    guestName={view.guestName}
                    highlightRound={view.currentRound}
                    revealRound={revealRound}
                    maxWidth={view.layout === 'grid-2x2' ? 240 : 150}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── REVIEW ─── */}
        {view.phase === PhotoboothPhase.REVIEW && (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              >
                <PhotoStrip
                  slots={view.slots}
                  layout={view.layout}
                  theme={view.theme}
                  filter={view.filter}
                  hostName={view.hostName}
                  guestName={view.guestName}
                  showLabels
                  maxWidth={view.layout === 'grid-2x2' ? 460 : 300}
                />
              </motion.div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="text-center lg:text-left">
                <h2 className="font-serif text-3xl font-black text-rose-500">
                  {S.review.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{S.review.subtitle}</p>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  {S.review.filters}
                </span>
                <FilterPicker
                  value={view.filter}
                  onChange={setFilter}
                  sample={view.slots[0]?.left ?? view.slots[0]?.right ?? null}
                />
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  {S.review.saveAs}
                </span>
                <div className="flex flex-wrap gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={downloading}
                    onClick={() => handleDownload('png')}
                    className="flex-1 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-rose-500 hover:to-pink-500 disabled:opacity-60"
                  >
                    {downloading ? S.review.preparing : `⬇ ${S.review.downloadPng}`}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={downloading}
                    onClick={() => handleDownload('pdf')}
                    className="flex-1 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-sky-500 hover:to-indigo-500 disabled:opacity-60"
                  >
                    {downloading ? S.review.preparing : `⬇ ${S.review.downloadPdf}`}
                  </motion.button>
                </div>
                <button
                  onClick={handleBackToLobby}
                  className="rounded-full border border-rose-200 bg-white px-6 py-3 text-sm font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
                >
                  {S.review.newSession}
                </button>
              </div>

              <p className="text-center text-xs text-zinc-400 lg:text-left">
                {S.review.made} 💕
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function PhaseDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={active ? 'text-rose-500' : 'text-zinc-300'}>{label}</span>
  );
}

function emptySlots(n: number) {
  return Array.from({ length: n }, () => ({ left: null, right: null }));
}

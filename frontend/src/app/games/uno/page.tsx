'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { GameType, LOBBY_EVENTS, type UnoMode, type UnoRules } from '@/shared';
import { getSocket } from '@/lib/socket';
import { unoStrings as S } from '@/components/uno';

type FormatKey = 'single' | '200' | '500';
const FORMATS: { key: FormatKey; label: string; target: number | null }[] = [
  { key: 'single', label: S.landing.single, target: null },
  { key: '200', label: S.landing.to200, target: 200 },
  { key: '500', label: S.landing.to500, target: 500 },
];

const MODES: { key: UnoMode; label: string; hint: string; emoji: string }[] = [
  { key: 'classic', label: S.landing.modeClassic, hint: S.landing.modeClassicHint, emoji: '🎴' },
  { key: 'custom', label: S.landing.modeCustom, hint: S.landing.modeCustomHint, emoji: '🛠️' },
  { key: 'noMercy', label: S.landing.modeNoMercy, hint: S.landing.modeNoMercyHint, emoji: '💀' },
  { key: 'flip', label: S.landing.modeFlip, hint: S.landing.modeFlipHint, emoji: '🌗' },
];

const RULES: { key: keyof Omit<UnoRules, 'mode' | 'targetScore'>; label: string }[] = [
  { key: 'stacking', label: S.landing.ruleStacking },
  { key: 'drawToMatch', label: S.landing.ruleDrawToMatch },
  { key: 'jumpIn', label: S.landing.ruleJumpIn },
  { key: 'sevenZero', label: S.landing.ruleSevenZero },
  { key: 'forcePlay', label: S.landing.ruleForcePlay },
  { key: 'noBluffing', label: S.landing.ruleNoBluffing },
];

export default function UnoLandingPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { lobby, isLoading, joinLobby, initListeners, error, reset } = useLobbyStore();
  const { isConnected } = useSocket();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<UnoMode>('classic');
  const [format, setFormat] = useState<FormatKey>('500');
  const [creating, setCreating] = useState(false);
  const [toggles, setToggles] = useState({
    stacking: false,
    drawToMatch: false,
    jumpIn: false,
    sevenZero: false,
    forcePlay: false,
    noBluffing: false,
  });

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!isConnected) return;
    const cleanup = initListeners();
    return cleanup;
  }, [hasHydrated, isAuthenticated, isConnected, router, initListeners]);

  useEffect(() => {
    if (lobby) router.push(`/lobby/${lobby.code}`);
  }, [lobby, router]);

  useEffect(() => () => reset(), [reset]);

  const showFormat = mode !== 'noMercy';
  const showToggles = mode === 'custom';

  const handleCreate = () => {
    if (creating || isLoading) return;
    const socket = getSocket();
    if (!socket) return;
    setCreating(true);
    const target = FORMATS.find((f) => f.key === format)!.target;
    const unoRules: UnoRules = {
      mode,
      targetScore: showFormat ? target : null,
      ...toggles,
    };
    socket.emit(LOBBY_EVENTS.CREATE, { gameType: GameType.UNO, maxPlayers: 4, unoRules });
  };

  const seg = (active: boolean) =>
    `rounded-lg border px-4 py-2 text-sm transition-colors ${
      active
        ? 'border-white bg-white text-black'
        : 'border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.06]'
    }`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0d12] via-black to-[#0d1220] p-6">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <span
            className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#e63946] text-3xl font-black italic text-white shadow-lg"
            style={{ transform: 'rotate(-8deg)' }}
          >
            UNO
          </span>
          <h1 className="text-4xl font-black text-white">{S.landing.title}</h1>
          <p className="mt-1 text-white/40">{S.landing.subtitle}</p>
        </motion.div>

        {/* Mode picker */}
        <fieldset className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <legend className="px-2 text-xs uppercase tracking-wider text-white/40">
            {S.landing.mode}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => setMode(m.key)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  mode === m.key
                    ? 'border-white bg-white/[0.1] text-white'
                    : 'border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-white/40">
            {MODES.find((m) => m.key === mode)!.hint}
          </p>
        </fieldset>

        {/* Format picker */}
        <AnimatePresence initial={false}>
          {showFormat && (
            <motion.fieldset
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
            >
              <legend className="px-2 text-xs uppercase tracking-wider text-white/40">
                {S.landing.format}
              </legend>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button key={f.key} type="button" aria-pressed={format === f.key} onClick={() => setFormat(f.key)} className={seg(format === f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </motion.fieldset>
          )}
        </AnimatePresence>

        {/* House-rule toggles (Custom only) */}
        <AnimatePresence initial={false}>
          {showToggles && (
            <motion.fieldset
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
            >
              <legend className="px-2 text-xs uppercase tracking-wider text-white/40">
                {S.landing.houseRules}
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {RULES.map((r) => {
                  const on = toggles[r.key];
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => setToggles((t) => ({ ...t, [r.key]: !t[r.key] }))}
                      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                        on
                          ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                          : 'border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.06]'
                      }`}
                    >
                      {r.label}
                      <span
                        className={`ml-2 flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                          on ? 'bg-emerald-400' : 'bg-white/15'
                        }`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.fieldset>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card hoverable glowing className="text-center" onClick={handleCreate}>
              <div className="text-3xl mb-2">{creating || isLoading ? '⏳' : '🎴'}</div>
              <h3 className="font-bold text-white mb-1">
                {creating || isLoading ? S.landing.creating : S.landing.createLobby}
              </h3>
              <p className="text-xs text-white/40">Up to 4 players</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card hoverable className="text-center" onClick={() => setShowJoin(true)}>
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="font-bold text-white mb-1">{S.landing.joinLobby}</h3>
              <p className="text-xs text-white/40">{S.landing.joinDescription}</p>
            </Card>
          </motion.div>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 text-center">
          <button onClick={() => router.push('/games')} className="text-sm text-white/40 transition-colors hover:text-white">
            {S.landing.back}
          </button>
        </div>

        <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title={S.landing.joinModalTitle}>
          <div className="space-y-4">
            <Input
              label={S.landing.joinCodeLabel}
              placeholder={S.landing.joinCodePlaceholder}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinCode.length === 6) joinLobby(joinCode);
              }}
            />
            <button
              disabled={joinCode.length !== 6}
              onClick={() => joinLobby(joinCode)}
              className="w-full rounded-xl bg-white py-2.5 font-bold text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              {S.landing.join}
            </button>
          </div>
        </Modal>
      </div>
    </main>
  );
}

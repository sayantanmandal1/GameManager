'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useUnoStore } from '@/stores/unoStore';
import { useSocket } from '@/hooks/useSocket';
import { useUnoSocket } from '@/hooks/useUnoSocket';
import { getSocket } from '@/lib/socket';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import {
  LOBBY_EVENTS,
  UnoPhase,
  type UnoCard as UnoCardT,
  type UnoColor,
  type UnoEvent,
} from '@/shared';
import {
  PlayerHand,
  OpponentSeat,
  TableCenter,
  UnoControls,
  ColorPicker,
  Scoreboard,
  TurnTimer,
  unoStrings as S,
  COLOR_NAME,
} from '@/components/uno';
import {
  playUnoPlay,
  playUnoDraw,
  playUnoCall,
  playUnoReverse,
  playUnoPenalty,
  playTurnSkip,
  playWin,
} from '@/lib/sounds';

interface Props {
  code: string;
}

const MODE_LABEL: Record<string, string> = {
  classic: 'Classic',
  custom: 'Custom',
  noMercy: 'No Mercy',
  flip: 'Flip',
};

export default function UnoPlayClient({ code }: Props) {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { isConnected } = useSocket();
  useUnoSocket(code, isConnected);

  const view = useUnoStore((s) => s.view);
  const error = useUnoStore((s) => s.error);
  const roundResult = useUnoStore((s) => s.roundResult);
  const matchResult = useUnoStore((s) => s.matchResult);
  const play = useUnoStore((s) => s.play);
  const draw = useUnoStore((s) => s.draw);
  const pass = useUnoStore((s) => s.pass);
  const take = useUnoStore((s) => s.take);
  const challenge = useUnoStore((s) => s.challenge);
  const callUno = useUnoStore((s) => s.callUno);
  const catchPlayer = useUnoStore((s) => s.catchPlayer);
  const surrender = useUnoStore((s) => s.surrender);
  const chooseSeven = useUnoStore((s) => s.chooseSeven);
  const jumpIn = useUnoStore((s) => s.jumpIn);
  const dismissRoundResult = useUnoStore((s) => s.dismissRoundResult);
  const reset = useUnoStore((s) => s.reset);

  const [wildCardId, setWildCardId] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.push('/');
  }, [hasHydrated, isAuthenticated, router]);
  useEffect(() => {
    if (!code) router.push('/games/uno');
  }, [code, router]);
  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (view?.phase === UnoPhase.PLAYING && roundResult) dismissRoundResult();
  }, [view?.phase, roundResult, dismissRoundResult]);

  const nameOf = useCallback(
    (id: string | null) => view?.players.find((p) => p.id === id)?.name ?? 'Player',
    [view],
  );

  const lastEventId = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    const evs = view.events;
    if (evs.length === 0) return;
    const newest = evs[evs.length - 1].id;
    if (lastEventId.current === null) {
      lastEventId.current = newest;
      return;
    }
    const fresh = evs.filter((e) => e.id > (lastEventId.current ?? 0));
    lastEventId.current = newest;
    for (const ev of fresh) handleEvent(ev);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEvent = (ev: UnoEvent) => {
    switch (ev.type) {
      case 'play':
        playUnoPlay();
        break;
      case 'draw':
      case 'take':
        playUnoDraw();
        break;
      case 'skip':
        playTurnSkip();
        setToast({ id: ev.id, text: S.events.skip(nameOf(ev.by)) });
        break;
      case 'reverse':
        playUnoReverse();
        setToast({ id: ev.id, text: S.events.reverse });
        break;
      case 'flip':
        playUnoReverse();
        setToast({ id: ev.id, text: S.events.flip });
        break;
      case 'swap':
        playUnoDraw();
        setToast({ id: ev.id, text: S.events.swap(nameOf(ev.by)) });
        break;
      case 'rotate':
        playUnoDraw();
        setToast({ id: ev.id, text: S.events.rotate });
        break;
      case 'discardAll':
        playUnoPlay();
        setToast({ id: ev.id, text: S.events.discardAll(nameOf(ev.by)) });
        break;
      case 'uno':
        playUnoCall();
        setToast({ id: ev.id, text: S.events.uno(nameOf(ev.by)) });
        break;
      case 'caught':
        playUnoPenalty();
        setToast({ id: ev.id, text: S.events.caught(nameOf(ev.target ?? null)) });
        break;
      case 'challengeWin':
        playUnoPenalty();
        setToast({ id: ev.id, text: S.events.challengeWin });
        break;
      case 'challengeLoss':
        playUnoPenalty();
        setToast({ id: ev.id, text: S.events.challengeLoss });
        break;
      case 'surrender':
        playUnoPenalty();
        setToast({ id: ev.id, text: S.events.surrender(nameOf(ev.by)) });
        break;
      case 'eliminated':
        playUnoPenalty();
        setToast({ id: ev.id, text: S.events.eliminated(nameOf(ev.by)) });
        break;
      case 'reshuffle':
        setToast({ id: ev.id, text: S.events.reshuffle });
        break;
      case 'color':
        if (ev.color) setToast({ id: ev.id, text: S.events.colorChange(COLOR_NAME[ev.color]) });
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (matchResult) playWin();
  }, [matchResult]);

  const onSelectCard = (card: UnoCardT) => {
    const kind = view?.side === 'dark' && card.dark ? card.dark.kind : card.kind;
    const isWild = ['wild', 'wild4', 'wildDraw2', 'wildDrawColor', 'draw10', 'reverseDraw4'].includes(kind);
    if (isWild) setWildCardId(card.id);
    else play(card.id);
  };

  const onPickColor = (color: UnoColor) => {
    if (wildCardId) play(wildCardId, color);
    setWildCardId(null);
  };

  const handleBackToLobby = () => {
    getSocket()?.emit(LOBBY_EVENTS.BACK_TO_LOBBY);
    reset();
    router.push(`/lobby/${code}`);
  };

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center text-white/50">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
          <p>{isConnected ? S.errors.loading : S.errors.disconnected}</p>
        </div>
      </main>
    );
  }

  const meIdx = view.players.findIndex((p) => p.id === view.youId);
  const me = meIdx >= 0 ? view.players[meIdx] : null;
  const iAmOut = !!me?.eliminated;
  const isSpectator = view.role === 'spectator' || meIdx < 0;
  const canAct = !isSpectator && !iAmOut;
  const opponents = isSpectator
    ? view.players
    : [...view.players.slice(meIdx + 1), ...view.players.slice(0, meIdx)];
  const isMyTurn = canAct && view.currentPlayerId === view.youId && view.phase === UnoPhase.PLAYING;
  const isDark = view.side === 'dark';
  const swapTargets = view.players.filter((p) => p.id !== view.youId && !p.eliminated);

  return (
    <main
      className={`relative min-h-screen px-3 py-3 text-white transition-colors duration-500 sm:px-5 ${
        isDark
          ? 'bg-[#110d18]'
          : 'bg-[#0d1512]'
      }`}
    >
      {/* Header */}
      <div className="mx-auto mb-3 flex w-full max-w-[96rem] items-center justify-between gap-3 px-1">
        <button onClick={handleBackToLobby} className="text-sm text-white/40 transition hover:text-white">
          ← {S.over.backToLobby}
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/70">
            {MODE_LABEL[view.mode]}
          </span>
          {isSpectator && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
              {S.hud.spectating}
            </span>
          )}
        </div>
        <span className="font-mono text-sm tracking-widest text-white/40">#{code}</span>
      </div>

      <div className="mx-auto grid w-full max-w-[96rem] gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section
          className={`relative flex min-h-[calc(100svh-4.75rem)] min-w-0 flex-col overflow-hidden rounded-[2rem] border shadow-2xl shadow-black/40 ${
            isDark
              ? 'border-[#6b4ca0]/35 bg-[#261a35]'
              : 'border-[#5e8c76]/40 bg-[#183d31]'
          }`}
        >
          <div className="pointer-events-none absolute inset-5 rounded-[1.5rem] border border-white/10" />
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(45deg,transparent,transparent_18px,rgba(255,255,255,0.03)_19px)]" />

          {/* Opponent rail */}
          <div className="relative z-10 flex min-h-28 flex-wrap items-start justify-center gap-2 px-3 pt-4 sm:gap-3">
            {opponents.map((p) => (
              <OpponentSeat
                key={p.id}
                player={p}
                side={view.side}
                isCurrent={view.currentPlayerId === p.id && view.phase === UnoPhase.PLAYING}
                turnEndsAt={view.turnEndsAt}
                catchable={canAct && view.catchableIds.includes(p.id)}
                onCatch={() => catchPlayer(p.id)}
              />
            ))}
          </div>

          {/* Table centre */}
          <div className="relative z-10 flex min-h-64 flex-1 items-center justify-center px-4 py-5">
            <TableCenter view={view} onDrawPile={() => isMyTurn && view.canDraw && draw()} />
          </div>

          {/* Controls + my seat */}
          {canAct && (
            <div className="relative z-10 flex flex-col items-center gap-3 px-3">
          <UnoControls
            view={view}
            onDraw={draw}
            onPass={pass}
            onTake={take}
            onChallenge={challenge}
            onCallUno={callUno}
          />
          {me && (
            <div className="flex items-center gap-3 text-sm">
              {isMyTurn && <TurnTimer turnEndsAt={view.turnEndsAt} active size={30} />}
              <span className={`font-semibold ${isMyTurn ? 'text-white' : 'text-white/50'}`}>
                {isMyTurn ? S.hud.yourTurn : S.hud.waitingFor(nameOf(view.currentPlayerId))}
              </span>
              {view.targetScore !== null && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/60">
                  {me.score} pts
                </span>
              )}
              {view.canSurrender && (
                <button
                  onClick={() => setConfirmQuit(true)}
                  className="rounded-full border border-red-500/40 px-3 py-0.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                >
                  {S.hud.surrender}
                </button>
              )}
            </div>
          )}
              {view.jumpInIds.length > 0 && !isMyTurn && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-xs font-semibold text-amber-300"
            >
              ⚡ {S.hud.jumpInHint}
            </motion.span>
              )}
            </div>
          )}

          {iAmOut && (
            <div className="relative z-10 py-6 text-center text-sm font-semibold text-red-300">
              You’re out of this game — watching the rest unfold.
            </div>
          )}

          {/* My hand rail */}
          {!isSpectator && !iAmOut && (
            <div className="relative z-10 mt-2 border-t border-white/10 bg-black/15">
              <PlayerHand
                hand={view.yourHand}
                side={view.side}
                legalCardIds={view.legalCardIds}
                jumpInIds={view.jumpInIds}
                isMyTurn={isMyTurn}
                playableDrawnCardId={view.playableDrawnCardId}
                onSelect={onSelectCard}
                onJumpIn={(card) => jumpIn(card.id)}
              />
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <VoiceChat roomId={code} />
          <GameChat lobbyCode={code} />
        </aside>
      </div>

      {/* Colour picker */}
      <ColorPicker open={wildCardId !== null} side={view.side} onPick={onPickColor} onCancel={() => setWildCardId(null)} />

      {/* Seven-0 swap target picker */}
      <AnimatePresence>
        {view.awaitingSevenTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative rounded-lg border border-white/10 bg-[#111] p-6 shadow-2xl">
              <h3 className="mb-4 text-center text-lg font-bold text-white">{S.hud.chooseSwap}</h3>
              <div className="flex flex-col gap-2">
                {swapTargets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => chooseSeven(p.id)}
                    className="flex items-center justify-between rounded-xl bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    {p.name}
                    <span className="text-xs text-white/50">{p.handCount} cards</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Surrender confirm */}
      <AnimatePresence>
        {confirmQuit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmQuit(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative w-full max-w-sm rounded-lg border border-white/10 bg-[#111] p-6 text-center shadow-2xl">
              <div className="mb-2 text-4xl">🏳️</div>
              <h3 className="text-lg font-bold text-white">{S.hud.surrenderTitle}</h3>
              <p className="mt-1 text-sm text-white/60">{S.hud.surrenderBody}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button onClick={() => setConfirmQuit(false)} className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white hover:bg-white/5">
                  {S.hud.surrenderNo}
                </button>
                <button
                  onClick={() => {
                    surrender();
                    setConfirmQuit(false);
                  }}
                  className="rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white hover:bg-red-400"
                >
                  {S.hud.surrenderYes}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoreboards */}
      {matchResult && (
        <Scoreboard result={matchResult} players={view.players} isMatch lobbyCode={code} onBackToLobby={handleBackToLobby} />
      )}
      {!matchResult && roundResult && view.phase === UnoPhase.ROUND_OVER && (
        <Scoreboard result={roundResult} players={view.players} isMatch={false} lobbyCode={code} onBackToLobby={handleBackToLobby} />
      )}

      {/* Event toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-black/80 px-5 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

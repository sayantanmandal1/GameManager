'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { UnoPlayerPublic, UnoRoundResult } from '@/shared';
import { unoStrings as S } from './strings';
import { RematchButton } from '@/components/lobby/RematchButton';

interface ScoreboardProps {
  result: UnoRoundResult;
  players: UnoPlayerPublic[];
  isMatch: boolean;
  lobbyCode: string;
  onBackToLobby: () => void;
  onPlayAgain?: () => void;
}

export function Scoreboard({
  result,
  players,
  isMatch,
  lobbyCode,
  onBackToLobby,
  onPlayAgain,
}: ScoreboardProps) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player';
  const rows = [...players].sort(
    (a, b) => (result.scores[b.id] ?? 0) - (result.scores[a.id] ?? 0),
  );

  return (
    <Modal isOpen onClose={onBackToLobby} title={isMatch ? S.over.matchTitle : S.over.roundTitle} dismissible={false}>
      <div className="text-center">
        <div className="mb-1 text-5xl">{isMatch ? '🏆' : '🎉'}</div>
        <p className="mt-3 text-sm text-game-muted">
          {isMatch
            ? result.reason === 'lastStanding'
              ? S.over.lastStanding(nameOf(result.roundWinnerId))
              : S.over.wonMatch(nameOf(result.roundWinnerId))
            : `${S.over.wonRound(nameOf(result.roundWinnerId))} · ${S.over.points(result.points)}`}
        </p>

        <div className="mt-5 space-y-1.5">
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                p.id === result.roundWinnerId
                  ? 'bg-yellow-400/15 text-yellow-200'
                  : 'bg-white/[0.04] text-white/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-4 text-white/40">{i + 1}</span>
                {p.name}
              </span>
              <span className="font-bold">{result.scores[p.id] ?? 0}</span>
            </div>
          ))}
        </div>

        {isMatch ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <RematchButton lobbyCode={lobbyCode} />
            {onPlayAgain && (
              <Button
                onClick={onPlayAgain}
              >
                {S.over.playAgain}
              </Button>
            )}
            <Button variant="secondary"
              onClick={onBackToLobby}
            >
              {S.over.backToLobby}
            </Button>
          </div>
        ) : (
          <p className="mt-6 animate-pulse text-xs font-semibold uppercase tracking-widest text-white/40">
            {S.over.nextRound}
          </p>
        )}
      </div>
    </Modal>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LobbyPlayerCard } from '@/components/lobby/LobbyPlayer';
import { PartnershipTeamPicker } from '@/components/lobby/PartnershipTeamPicker';
import { GameChat } from '@/components/chat/GameChat';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useGameStore } from '@/stores/gameStore';
import { useLudoStore } from '@/stores/ludoStore';
import { useSocket } from '@/hooks/useSocket';
import { LOBBY_EVENTS, GameType, isPartnershipGameKey, type Lobby } from '@/shared';
import { getSocket } from '@/lib/socket';
import { DISTINCT_GAME_UI } from '@/lib/distinctGames';

const LEGACY_GAME_NAMES: Partial<Record<GameType, string>> = {
  [GameType.BINGO]: 'Bingo',
  [GameType.LUDO]: 'Ludo',
  [GameType.CHESS]: 'Chess',
  [GameType.PHOTOBOOTH]: 'Photobooth',
  [GameType.UNO]: 'UNO',
  [GameType.TICTACTOE]: 'Tic Tac Toe',
  [GameType.CONNECTFOUR]: 'Connect Four',
  [GameType.SUDOKU]: 'Sudoku',
};

function getGameName(lobby: Lobby | null): string {
  if (!lobby) return '';
  if (lobby.gameType === GameType.DISTINCT && lobby.gameKey) {
    return DISTINCT_GAME_UI[lobby.gameKey].name;
  }
  return LEGACY_GAME_NAMES[lobby.gameType] ?? 'Game';
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const { lobby, error, joinLobby, leaveLobby, setReady, selectTeam, startGame, initListeners } =
    useLobbyStore();
  const { initListeners: initGameListeners, reset: resetGame } = useGameStore();
  const { initListeners: initLudoListeners, reset: resetLudo } = useLudoStore();
  const [copied, setCopied] = useState(false);
  const isLeavingRef = useRef(false);
  const { isConnected } = useSocket();

  // Set up listeners and auto-rejoin lobby when socket is connected
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (!isConnected) return;

    resetGame();
    resetLudo();

    const cleanupLobby = initListeners();
    const cleanupGame = initGameListeners();
    const cleanupLudo = initLudoListeners();

    // Re-join lobby to ensure socket is in the room (handles page refresh).
    // Do not re-enroll a player while navigation after an explicit leave is pending.
    if (!isLeavingRef.current) {
      joinLobby(code);
    }

    // Listen for game starting to navigate
    const socket = getSocket();
    const onGameStarting = () => {
      const gameType = useLobbyStore.getState().lobby?.gameType;
      if (gameType === GameType.LUDO) {
        router.push(`/games/ludo/play?lobby=${code}`);
      } else if (gameType === GameType.CHESS) {
        router.push(`/games/chess/play/${code}`);
      } else if (gameType === GameType.PHOTOBOOTH) {
        router.push(`/games/photobooth/play/${code}`);
      } else if (gameType === GameType.UNO) {
        router.push(`/games/uno/play/${code}`);
      } else if (gameType === GameType.TICTACTOE) {
        router.push(`/games/tictactoe/play/${code}`);
      } else if (gameType === GameType.CONNECTFOUR) {
        router.push(`/games/connectfour/play/${code}`);
      } else if (gameType === GameType.DISTINCT) {
        const gameKey = useLobbyStore.getState().lobby?.gameKey;
        if (gameKey) router.push(`/games/${gameKey}/play/${code}`);
      } else {
        router.push(`/games/bingo/play?lobby=${code}`);
      }
    };
    socket?.on(LOBBY_EVENTS.GAME_STARTING, onGameStarting);

    return () => {
      cleanupLobby();
      cleanupGame();
      cleanupLudo();
      socket?.off(LOBBY_EVENTS.GAME_STARTING, onGameStarting);
    };
  }, [hasHydrated, isAuthenticated, isConnected, router, code, initListeners, initGameListeners, initLudoListeners, resetGame, resetLudo, joinLobby]);

  const isHost = lobby?.hostId === user?.id;
  const currentPlayer = lobby?.players.find((p) => p.id === user?.id);
  const allReady = lobby?.players
    .filter((p) => !p.isHost)
    .every((p) => p.isReady);
  const isPartnershipGame = lobby?.gameType === GameType.DISTINCT
    && isPartnershipGameKey(lobby.gameKey);
  const teamsComplete = !isPartnershipGame || (
    lobby.players.length === 4
    && lobby.players.filter((player) => player.team === 0).length === 2
    && lobby.players.filter((player) => player.team === 1).length === 2
  );
  const minimumPlayers = isPartnershipGame ? 4 : 2;
  const canStart =
    isHost && allReady && teamsComplete && (lobby?.players.length ?? 0) >= minimumPlayers;
  const gameName = getGameName(lobby);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    isLeavingRef.current = true;
    leaveLobby();
    const gameType = lobby?.gameType;
    if (gameType === GameType.LUDO) {
      router.push('/games/ludo');
    } else if (gameType === GameType.PHOTOBOOTH) {
      router.push('/games/photobooth');
    } else if (gameType === GameType.UNO) {
      router.push('/games/uno');
    } else if (gameType === GameType.TICTACTOE) {
      router.push('/games/tictactoe');
    } else if (gameType === GameType.CONNECTFOUR) {
      router.push('/games/connectfour');
    } else if (gameType === GameType.CHESS) {
      router.push('/games/chess');
    } else if (gameType === GameType.DISTINCT && lobby?.gameKey) {
      router.push(`/games/${lobby.gameKey}`);
    } else {
      router.push('/games/bingo');
    }
  };

  if (!lobby) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-game-muted">Connecting to lobby…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end"
        >
          <div>
            <p className="text-sm font-bold text-game-coral">{gameName.toUpperCase()} ROOM</p>
            <h1 className="mt-1 text-3xl font-black text-white">Get the table ready</h1>
            <p className="mt-2 text-sm text-game-muted">
              {isHost ? 'Start when every guest is ready.' : 'Mark yourself ready when you are set.'}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-xs font-bold text-game-muted">INVITE CODE</p>
            <button
              type="button"
              onClick={copyCode}
              className="rounded-lg border border-white/15 bg-[#1c1f1b] px-4 py-2 font-mono text-2xl font-black text-white transition-colors hover:border-game-mint/60"
              title="Copy lobby code"
            >
              {code}
            </button>
            <p className="mt-1 text-xs text-game-muted">
              {copied ? 'Copied' : 'Click to copy'}
            </p>
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="self-start">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-game-muted">PLAYERS</p>
                <h2 className="mt-1 text-xl font-bold text-white">At the table</h2>
              </div>
              <span className="rounded-full bg-white/8 px-3 py-1 text-sm font-semibold text-game-muted">
                {lobby.players.length}/{lobby.maxPlayers}
              </span>
            </div>
            {isPartnershipGame && user?.id && (
              <PartnershipTeamPicker
                players={lobby.players}
                currentUserId={user.id}
                onSelect={selectTeam}
              />
            )}
            <div className="space-y-2">
              <AnimatePresence>
                {lobby.players.map((player) => (
                  <LobbyPlayerCard
                    key={player.id}
                    player={player}
                    isCurrentUser={player.id === user?.id}
                  />
                ))}
              </AnimatePresence>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              {!isHost && currentPlayer && (
                <Button
                  variant={currentPlayer.isReady ? 'secondary' : 'primary'}
                  onClick={() => setReady(!currentPlayer.isReady)}
                >
                  {currentPlayer.isReady ? 'Set not ready' : 'Ready up'}
                </Button>
              )}

              {isHost && (
                <Button
                  disabled={!canStart}
                  onClick={startGame}
                  className={canStart ? 'animate-pulse-glow' : ''}
                >
                  {canStart ? 'Start game' : 'Waiting for players'}
                </Button>
              )}

              <Button variant="danger" onClick={handleLeave}>
                Leave room
              </Button>
            </div>
            {!canStart && isHost && (
              <p className="mt-3 text-xs text-game-muted">
                {isPartnershipGame && !teamsComplete
                  ? 'Choose two players for each team before starting.'
                  : `At least ${minimumPlayers} players are required and every guest must be ready.`}
              </p>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          </Card>

          <div className="space-y-4">
            <VoiceChat roomId={code} />
            <GameChat lobbyCode={code} />
          </div>
        </div>
      </div>
    </main>
  );
}

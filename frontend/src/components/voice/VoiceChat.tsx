'use client';

import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { Button } from '@/components/ui/Button';

interface VoiceChatProps {
  readonly roomId: string;
}

export function VoiceChat({ roomId }: VoiceChatProps) {
  const {
    isInVoice,
    isJoining,
    isMuted,
    isSpeakerOff,
    connectionError,
    needsAudioResume,
    activePeers,
    toggleMute,
    toggleSpeaker,
  } =
    useVoiceStore();
  const { joinVoice, leaveVoice, resumeAudio } = useVoiceChat(roomId);
  let voiceActionLabel = 'Join';
  if (isJoining) voiceActionLabel = 'Connecting…';
  else if (isInVoice) voiceActionLabel = 'Leave';

  const handleToggleVoice = async () => {
    if (isInVoice) {
      leaveVoice();
    } else {
      await joinVoice();
    }
  };

  return (
    <div className="premium-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="eyebrow">
          Voice Chat
        </h3>
        <div className="flex gap-2">
          {isInVoice && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? '🎙️❌' : '🎙️'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSpeaker}
                title={isSpeakerOff ? 'Enable Speaker' : 'Disable Speaker'}
              >
                {isSpeakerOff ? '🔇' : '🔊'}
              </Button>
            </>
          )}
          <Button
            variant={isInVoice ? 'danger' : 'secondary'}
            size="sm"
            onClick={handleToggleVoice}
            disabled={isJoining}
          >
            {voiceActionLabel}
          </Button>
        </div>
      </div>

      {isInVoice && activePeers.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(activePeers.values()).map((peer) => (
            <div
              key={peer.socketId}
              className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg text-sm"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  peer.isMuted ? 'bg-red-400' : 'bg-green-400 animate-pulse'
                }`}
              />
              <span className="text-game-muted">{peer.username}</span>
            </div>
          ))}
        </div>
      )}

      {isInVoice && activePeers.size === 0 && (
        <p className="text-xs leading-5 text-game-muted">No one else in voice yet…</p>
      )}

      {!isInVoice && (
        <p className="text-xs leading-5 text-game-muted">Click Join to start voice chat</p>
      )}

      {connectionError && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2">
          <p role="alert" className="text-xs text-red-200">{connectionError}</p>
          {needsAudioResume && (
            <Button variant="secondary" size="sm" onClick={resumeAudio}>
              Enable audio
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

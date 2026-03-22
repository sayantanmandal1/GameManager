'use client';

import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { Button } from '@/components/ui/Button';

interface VoiceChatProps {
  roomId: string;
}

export function VoiceChat({ roomId }: VoiceChatProps) {
  const { isInVoice, isMuted, isSpeakerOff, activePeers, toggleVoice, toggleMute, toggleSpeaker } =
    useVoiceStore();
  const { joinVoice, leaveVoice } = useVoiceChat(roomId);

  const handleToggleVoice = async () => {
    if (isInVoice) {
      leaveVoice();
      toggleVoice();
    } else {
      await joinVoice();
      toggleVoice();
    }
  };

  return (
    <div className="bg-game-card border border-game-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-game-muted uppercase tracking-wider">
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
          >
            {isInVoice ? 'Leave' : 'Join'}
          </Button>
        </div>
      </div>

      {isInVoice && activePeers.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(activePeers.values()).map((peer) => (
            <div
              key={peer.socketId}
              className="flex items-center gap-1.5 px-2 py-1 bg-game-bg rounded-lg text-sm"
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
        <p className="text-xs text-game-muted">No one else in voice yet…</p>
      )}

      {!isInVoice && (
        <p className="text-xs text-game-muted">Click Join to start voice chat</p>
      )}
    </div>
  );
}

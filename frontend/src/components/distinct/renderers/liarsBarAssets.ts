export const LIARS_BAR_CHARACTERS = [
  {
    id: 'scubby',
    name: 'Scubby',
    portrait: '/liars-bar/characters/scubby.webp',
    voices: {
      threeCards: '/liars-bar/voices/scubby-three-cards.mp3',
      spotOn: '/liars-bar/voices/scubby-spot-on.mp3',
    },
  },
  {
    id: 'foxy',
    name: 'Foxy',
    portrait: '/liars-bar/characters/foxy.webp',
    voices: {
      threeCards: '/liars-bar/voices/foxy-three-cards.mp3',
      spotOn: '/liars-bar/voices/foxy-spot-on.mp3',
    },
  },
  {
    id: 'bristle',
    name: 'Bristle',
    portrait: '/liars-bar/characters/bristle.webp',
    voices: {
      threeCards: '/liars-bar/voices/bristle-three-cards.mp3',
      spotOn: '/liars-bar/voices/bristle-spot-on.mp3',
    },
  },
  {
    id: 'toar',
    name: 'Toar',
    portrait: '/liars-bar/characters/toar.webp',
    voices: {
      threeCards: '/liars-bar/voices/toar-three-cards.mp3',
      spotOn: '/liars-bar/voices/toar-spot-on.mp3',
    },
  },
  {
    id: 'cupcake',
    name: 'Cupcake',
    portrait: '/liars-bar/characters/cupcake.webp',
    voices: {
      threeCards: '/liars-bar/voices/cupcake-three-cards.mp3',
      spotOn: '/liars-bar/voices/cupcake-spot-on.mp3',
    },
  },
  {
    id: 'gerk',
    name: 'Gerk',
    portrait: '/liars-bar/characters/gerk.webp',
    voices: {
      threeCards: '/liars-bar/voices/gerk-three-cards.mp3',
      spotOn: '/liars-bar/voices/gerk-spot-on.mp3',
    },
  },
] as const;

export type LiarsBarVoice = 'threeCards' | 'spotOn';

let activeVoiceAudio: HTMLAudioElement | null = null;

export function getLiarsBarCharacter(playerIndex: number) {
  const index = ((playerIndex % LIARS_BAR_CHARACTERS.length) + LIARS_BAR_CHARACTERS.length) % LIARS_BAR_CHARACTERS.length;
  return LIARS_BAR_CHARACTERS[index];
}

export function playLiarsBarVoice(playerIndex: number, voice: LiarsBarVoice) {
  if (typeof Audio === 'undefined') return;

  activeVoiceAudio?.pause();
  const character = getLiarsBarCharacter(playerIndex);
  const audio = new Audio(character.voices[voice]);
  activeVoiceAudio = audio;
  audio.preload = 'none';
  audio.volume = 0.72;
  audio.addEventListener('ended', () => {
    if (activeVoiceAudio === audio) activeVoiceAudio = null;
  }, { once: true });

  void audio.play().catch((error: unknown) => {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      console.info('Character voice playback was blocked by the browser; portraits remain available.');
      return;
    }
    console.error(`Unable to play the ${voice} character voice clip.`, error);
  });
}

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
export type LiarsBarCharacterId = (typeof LIARS_BAR_CHARACTERS)[number]['id'];

/**
 * Character dialogue shipped for the desktop 3D table, by group and number of takes.
 * count-n says the number n, plural/singular are ordered King, Queen, Ace, and bold-2/3 are
 * reactions to someone else's three-card play.
 */
export const LIARS_BAR_VOICE_LINES: Record<LiarsBarCharacterId, Record<LiarsBarLineGroup, number>> = {
  scubby: { turn: 3, liar: 1, devil: 1, preshot: 2, count: 5, plural: 3, singular: 3, relief: 2, bold: 3 },
  foxy: { turn: 3, liar: 1, devil: 1, preshot: 2, count: 5, plural: 3, singular: 3, relief: 2, bold: 3 },
  bristle: { turn: 3, liar: 1, devil: 1, preshot: 3, count: 5, plural: 3, singular: 3, relief: 2, bold: 3 },
  toar: { turn: 3, liar: 1, devil: 1, preshot: 4, count: 3, plural: 3, singular: 3, relief: 1, bold: 3 },
  cupcake: { turn: 3, liar: 1, devil: 1, preshot: 3, count: 5, plural: 3, singular: 3, relief: 4, bold: 3 },
  gerk: { turn: 2, liar: 1, devil: 1, preshot: 4, count: 5, plural: 3, singular: 3, relief: 1, bold: 2 },
};
export type LiarsBarLineGroup = 'turn' | 'liar' | 'devil' | 'preshot' | 'count' | 'plural' | 'singular' | 'relief' | 'bold';
export type LiarsBarSfx = 'card-flip' | 'card-pick' | 'card-switch' | 'card-throw' | 'card-throw-soft' | 'fist-table' | 'head-fall'
  | 'gunshot' | 'heartbeat' | 'last-round' | 'liar-strike' | 'new-round' | 'reload' | 'revolver-cock' | 'roulette-sting'
  | 'ui-click' | 'ui-hover' | 'winner';

const RANK_LINE_INDEX = { K: 1, Q: 2, A: 3 } as const;

export function liarsBarLineUrl(character: LiarsBarCharacterId, group: LiarsBarLineGroup, take: number) {
  return `/liars-bar/voices/${character}/${group}-${take}.mp3`;
}

/** Voice lines for a claim such as "Two Kings"; null when the character has no take for that count. */
export function liarsBarClaimLines(character: LiarsBarCharacterId, count: number, rank: keyof typeof RANK_LINE_INDEX): string[] | null {
  const lines = LIARS_BAR_VOICE_LINES[character];
  if (count < 1 || count > lines.count) return null;
  return [liarsBarLineUrl(character, 'count', count), liarsBarLineUrl(character, count === 1 ? 'singular' : 'plural', RANK_LINE_INDEX[rank])];
}

function supportsHtmlAudio() {
  return typeof Audio !== 'undefined' && (typeof navigator === 'undefined' || !/jsdom/i.test(navigator.userAgent));
}

export function randomLiarsBarLine(character: LiarsBarCharacterId, group: LiarsBarLineGroup, random: () => number = Math.random, minTake = 1) {
  const takes = LIARS_BAR_VOICE_LINES[character][group];
  if (takes < minTake) return null;
  return liarsBarLineUrl(character, group, minTake + Math.floor(random() * (takes - minTake + 1)));
}

let activeVoiceAudio: HTMLAudioElement | null = null;
let activeSequence = 0;

/** Plays character lines back to back, interrupting whatever line is currently being spoken. */
export function playLiarsBarLines(urls: string[], volume = 0.85) {
  if (!supportsHtmlAudio() || urls.length === 0) return;
  activeVoiceAudio?.pause();
  const sequence = ++activeSequence;
  const next = (index: number) => {
    if (sequence !== activeSequence || index >= urls.length) return;
    const audio = new Audio(urls[index]);
    activeVoiceAudio = audio;
    audio.volume = volume;
    audio.addEventListener('ended', () => next(index + 1), { once: true });
    void audio.play().catch(() => undefined);
  };
  next(0);
}

export function stopLiarsBarLines() {
  activeSequence += 1;
  activeVoiceAudio?.pause();
  activeVoiceAudio = null;
}

const sfxPool = new Map<string, HTMLAudioElement>();
let winnerAudio: HTMLAudioElement | null = null;
let soundtrackAudio: HTMLAudioElement | null = null;
let ambienceAudio: HTMLAudioElement | null = null;
let heartbeatAudio: HTMLAudioElement | null = null;
let soundtrackIndex = 0;
let soundtrackGeneration = 0;

const SOUNDTRACK = [
  '/liars-bar/music/outlaw-beginnings.mp3',
  '/liars-bar/music/country-fireside.mp3',
  '/liars-bar/music/outlaw-arrives.mp3',
];

export function preloadLiarsBarSfx(names: LiarsBarSfx[]) {
  if (!supportsHtmlAudio()) return;
  for (const name of names) {
    if (sfxPool.has(name)) continue;
    const audio = new Audio(`/liars-bar/sfx/${name}.mp3`);
    audio.preload = 'auto';
    sfxPool.set(name, audio);
  }
}

export function playLiarsBarSfx(name: LiarsBarSfx, volume = 0.7) {
  if (!supportsHtmlAudio()) return;
  const source = sfxPool.get(name) ?? new Audio(`/liars-bar/sfx/${name}.mp3`);
  sfxPool.set(name, source);
  const audio = name === 'winner' ? source : (source.cloneNode(true) as HTMLAudioElement);
  if (name === 'winner') {
    soundtrackAudio?.pause();
    ambienceAudio?.pause();
    winnerAudio = audio;
    audio.currentTime = 0;
  }
  audio.volume = volume;
  void audio.play().catch((error: unknown) => {
    if (error instanceof Error && error.name !== 'NotAllowedError') {
      console.error(`Unable to play the Liar's Bar ${name} sound.`, error);
    }
  });
}

function startSoundtrackTrack(index: number, generation: number) {
  const audio = new Audio(SOUNDTRACK[index]);
  soundtrackAudio = audio;
  audio.volume = 0.16;
  audio.addEventListener('ended', () => {
    if (generation !== soundtrackGeneration || soundtrackAudio !== audio) return;
    soundtrackIndex = (index + 1) % SOUNDTRACK.length;
    startSoundtrackTrack(soundtrackIndex, generation);
  }, { once: true });
  void audio.play().catch((error: unknown) => {
    if (error instanceof Error && error.name !== 'NotAllowedError') {
      console.error("Unable to play the Liar's Bar soundtrack.", error);
    }
  });
}

/** Starts the original soundtrack and room ambience after the player interacts with the table. */
export function playLiarsBarMusic() {
  if (!supportsHtmlAudio()) return;
  if (!soundtrackAudio) {
    soundtrackGeneration += 1;
    startSoundtrackTrack(soundtrackIndex, soundtrackGeneration);
  } else if (soundtrackAudio.paused) {
    void soundtrackAudio.play().catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'NotAllowedError') {
        console.error("Unable to resume the Liar's Bar soundtrack.", error);
      }
    });
  }
  if (!ambienceAudio) {
    ambienceAudio = new Audio('/liars-bar/sfx/ambience.mp3');
    ambienceAudio.loop = true;
    ambienceAudio.volume = 0.12;
    void ambienceAudio.play().catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'NotAllowedError') {
        console.error("Unable to play the Liar's Bar room ambience.", error);
      }
    });
  } else if (ambienceAudio.paused) {
    void ambienceAudio.play().catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'NotAllowedError') {
        console.error("Unable to resume the Liar's Bar room ambience.", error);
      }
    });
  }
}

export function playLiarsBarHeartbeat() {
  if (!supportsHtmlAudio() || (heartbeatAudio && !heartbeatAudio.paused)) return;
  heartbeatAudio = new Audio('/liars-bar/sfx/heartbeat.mp3');
  heartbeatAudio.loop = true;
  heartbeatAudio.volume = 0.28;
  void heartbeatAudio.play().catch((error: unknown) => {
    if (error instanceof Error && error.name !== 'NotAllowedError') {
      console.error("Unable to play the Liar's Bar roulette heartbeat.", error);
    }
  });
}

export function stopLiarsBarHeartbeat() {
  heartbeatAudio?.pause();
  heartbeatAudio = null;
}

export function stopLiarsBarMusic() {
  soundtrackGeneration += 1;
  soundtrackAudio?.pause();
  soundtrackAudio = null;
  ambienceAudio?.pause();
  ambienceAudio = null;
  winnerAudio?.pause();
  winnerAudio = null;
  stopLiarsBarHeartbeat();
}

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

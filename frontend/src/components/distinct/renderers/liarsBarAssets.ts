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
  | 'last-round' | 'liar-strike' | 'new-round' | 'reload' | 'roulette-sting' | 'ui-click' | 'ui-hover' | 'winner';

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

export function randomLiarsBarLine(character: LiarsBarCharacterId, group: LiarsBarLineGroup, random: () => number = Math.random, minTake = 1) {
  const takes = LIARS_BAR_VOICE_LINES[character][group];
  if (takes < minTake) return null;
  return liarsBarLineUrl(character, group, minTake + Math.floor(random() * (takes - minTake + 1)));
}

let activeVoiceAudio: HTMLAudioElement | null = null;
let activeSequence = 0;

/** Plays character lines back to back, interrupting whatever line is currently being spoken. */
export function playLiarsBarLines(urls: string[], volume = 0.85) {
  if (typeof Audio === 'undefined' || urls.length === 0) return;
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
let musicAudio: HTMLAudioElement | null = null;

export function preloadLiarsBarSfx(names: LiarsBarSfx[]) {
  if (typeof Audio === 'undefined') return;
  for (const name of names) {
    if (sfxPool.has(name)) continue;
    const audio = new Audio(`/liars-bar/sfx/${name}.mp3`);
    audio.preload = 'auto';
    sfxPool.set(name, audio);
  }
}

export function playLiarsBarSfx(name: LiarsBarSfx, volume = 0.7) {
  if (typeof Audio === 'undefined') return;
  const source = sfxPool.get(name) ?? new Audio(`/liars-bar/sfx/${name}.mp3`);
  sfxPool.set(name, source);
  const audio = name === 'winner' ? source : (source.cloneNode(true) as HTMLAudioElement);
  if (name === 'winner') {
    musicAudio = audio;
    audio.currentTime = 0;
  }
  audio.volume = volume;
  void audio.play().catch(() => undefined);
}

export function stopLiarsBarMusic() {
  musicAudio?.pause();
  musicAudio = null;
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

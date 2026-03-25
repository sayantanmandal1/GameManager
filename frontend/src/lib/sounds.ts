'use client';

// Web Audio API sound effects for game events
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.08) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export function playDiceRoll() {
  // Short rattling noise burst
  playNoise(0.25, 0.1);
  setTimeout(() => playTone(800, 0.08, 'square', 0.06), 50);
  setTimeout(() => playTone(600, 0.08, 'square', 0.06), 120);
  setTimeout(() => playTone(900, 0.06, 'square', 0.05), 180);
}

export function playTokenMove() {
  playTone(520, 0.1, 'sine', 0.1);
}

export function playTokenCapture() {
  playTone(300, 0.15, 'sawtooth', 0.1);
  setTimeout(() => playTone(200, 0.2, 'sawtooth', 0.08), 100);
}

export function playTokenHome() {
  // Ascending victory arpeggio
  playTone(523, 0.12, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.15), 200);
}

export function playWin() {
  // Triumphant fanfare
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.15), i * 150);
  });
  setTimeout(() => playTone(1047, 0.5, 'triangle', 0.2), 600);
}

export function playSixRoll() {
  playTone(880, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.15), 80);
}

export function playTurnSkip() {
  playTone(300, 0.2, 'triangle', 0.08);
  setTimeout(() => playTone(200, 0.3, 'triangle', 0.06), 150);
}

/**
 * Alarm sounds for the focus timer.
 * Built-in sounds are synthesised with Web Audio (no files, no licences). Custom sounds are audio
 * files from the repo's sounds/ folder, served by the API. Ids: "builtin:<key>" or "file:<name>".
 */

type Pattern = (ctx: AudioContext, out: AudioNode, t0: number) => void;

function tone(ctx: AudioContext, out: AudioNode, freq: number, t0: number, dur: number, type: OscillatorType = 'sine', peak = 0.35) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const BUILTIN_SOUNDS: Record<string, { label: string; period: number; play: Pattern }> = {
  chime: {
    label: 'Chime',
    period: 2.2,
    play: (c, o, t) => {
      tone(c, o, 880, t, 0.9);
      tone(c, o, 1318.5, t + 0.18, 1.0);
      tone(c, o, 1760, t + 0.36, 1.3);
    },
  },
  bell: {
    label: 'Bell',
    period: 2.5,
    play: (c, o, t) => {
      // Inharmonic partials give a struck-bell timbre.
      [1, 2.76, 5.4].forEach((m, i) => tone(c, o, 523.25 * m, t, 2.2 - i * 0.5, 'sine', 0.3 / (i + 1)));
    },
  },
  digital: {
    label: 'Digital beep',
    period: 1.6,
    play: (c, o, t) => {
      for (let i = 0; i < 4; i++) tone(c, o, 1000, t + i * 0.16, 0.09, 'square', 0.12);
    },
  },
  pulse: {
    label: 'Soft pulse',
    period: 2,
    play: (c, o, t) => {
      tone(c, o, 440, t, 0.5, 'triangle', 0.3);
      tone(c, o, 554.4, t + 0.3, 0.7, 'triangle', 0.3);
    },
  },
};

export const DEFAULT_SOUND = 'builtin:chime';
const ALARM_SECONDS = 60;

let ctx: AudioContext | null = null;

/** Create/resume the audio context. Call from a click so later alarms are allowed to play. */
export function unlockAudio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export const soundUrl = (file: string) => `/api/focus/sounds/${encodeURIComponent(file)}`;

/**
 * Play a sound, looping for up to `seconds`. Returns a function that stops it.
 * Built-in patterns are scheduled on the audio clock up front, so they keep ringing in a background tab.
 */
export function playSound(id: string, volume: number, seconds = ALARM_SECONDS): () => void {
  const v = Math.min(1, Math.max(0, volume));
  if (id.startsWith('file:')) {
    const audio = new Audio(soundUrl(id.slice(5)));
    audio.loop = true;
    audio.volume = v;
    let fallback: (() => void) | null = null;
    let stopped = false;
    const startedAt = Date.now();
    // File missing or unplayable: ring with the built-in chime for the rest of the time instead of staying silent.
    const useFallback = () => {
      if (fallback || stopped) return;
      const left = seconds - (Date.now() - startedAt) / 1000;
      if (left > 0.5) fallback = playSound(DEFAULT_SOUND, v, left);
    };
    audio.addEventListener('error', useFallback);
    void audio.play().catch(useFallback);
    const timer = setTimeout(() => audio.pause(), seconds * 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      audio.pause();
      fallback?.();
    };
  }
  const c = unlockAudio();
  const sound = BUILTIN_SOUNDS[id.replace('builtin:', '')] ?? BUILTIN_SOUNDS.chime;
  if (!c) return () => {};
  const master = c.createGain();
  master.gain.value = v;
  master.connect(c.destination);
  const t0 = c.currentTime + 0.05;
  for (let t = 0; t < seconds; t += sound.period) sound.play(c, master, t0 + t);
  return () => {
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(0, c.currentTime);
    setTimeout(() => master.disconnect(), 100);
  };
}

/** One short play for the "Test" button. */
export function previewSound(id: string, volume: number): () => void {
  const builtin = BUILTIN_SOUNDS[id.replace('builtin:', '')];
  return playSound(id, volume, builtin ? builtin.period : 4);
}

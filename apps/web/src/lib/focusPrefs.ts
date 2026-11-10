import { useSyncExternalStore } from 'react';
import { DEFAULT_SOUND } from './sounds';

/** Per-browser focus-timer preferences (last durations, sound, volume). Safe if storage is unavailable. */
export interface FocusPrefs {
  focusMinutes: number;
  breakMinutes: number;
  topicId: string | null;
  sound: string;
  volume: number;
}

const KEY = 'focus.prefs';
const DEFAULTS: FocusPrefs = { focusMinutes: 30, breakMinutes: 10, topicId: null, sound: DEFAULT_SOUND, volume: 0.8 };
const listeners = new Set<() => void>();

function read(): FocusPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let cache = read();

export function setFocusPrefs(patch: Partial<FocusPrefs>) {
  cache = { ...cache, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: keep in memory only */
  }
  listeners.forEach((l) => l());
}

export function getFocusPrefs() {
  return cache;
}

export function useFocusPrefs(): FocusPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
}

/** "01:05:09" for an hour or more, otherwise "25:00". Rounds up so 0 shows only when time is really up. */
export function fmtCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const p = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const mm = p(Math.floor((s % 3600) / 60));
  return h ? `${h}:${mm}:${p(s % 60)}` : `${mm}:${p(s % 60)}`;
}

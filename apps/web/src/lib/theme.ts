import { useEffect, useState } from 'react';

/**
 * F-28: per-browser display preference (not study data, so it lives in localStorage).
 * With nothing saved yet, the first visit matches the operating system's appearance.
 */
export type Theme = 'light' | 'dark';

const KEY = 'theme';

export function initialTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* theme still applies for this session */
    }
  }, [theme]);

  return [theme, setTheme];
}

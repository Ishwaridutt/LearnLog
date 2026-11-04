import { useTheme } from '../lib/theme';

/** F-28: one-click Light ⇄ Dark switch for the header. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-base text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
    >
      <span aria-hidden>{dark ? '☀' : '☾'}</span>
    </button>
  );
}

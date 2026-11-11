import { useTheme } from '../lib/theme';
import { headerChip } from './ui';

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
      className={`grid w-9 place-items-center text-base ${headerChip}`}
    >
      <span aria-hidden>{dark ? '☀' : '☾'}</span>
    </button>
  );
}

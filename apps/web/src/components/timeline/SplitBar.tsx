import { FOCUS_FILL, FOCUS_LABEL, fmtSpent } from './useTimeline';

export interface SplitPart {
  key: string;
  label: string;
  seconds: number;
  /** Subject colour; null = the hatched "focus with no topic" fill. */
  color: string | null;
}

/** One horizontal bar split by subject, with 2px gaps between parts. */
export function SplitBar({ parts, className = 'h-3' }: { parts: SplitPart[]; className?: string }) {
  const total = parts.reduce((n, p) => n + p.seconds, 0);
  if (!total) return <div className={`${className} rounded-full bg-slate-100`} />;
  return (
    <div className={`${className} flex gap-[2px] overflow-hidden rounded-full`} role="img" aria-label={parts.map((p) => `${p.label} ${fmtSpent(p.seconds)}`).join(', ')}>
      {parts
        .filter((p) => p.seconds > 0)
        .map((p) => (
          <span
            key={p.key}
            title={`${p.label}: ${fmtSpent(p.seconds)}`}
            className="h-full min-w-[3px]"
            style={{ flexGrow: p.seconds, background: p.color ?? FOCUS_FILL }}
          />
        ))}
    </div>
  );
}

export function Swatch({ color }: { color: string | null }) {
  return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color ?? FOCUS_FILL }} />;
}

export const focusPart = (seconds: number): SplitPart => ({ key: 'focus', label: FOCUS_LABEL, seconds, color: null });

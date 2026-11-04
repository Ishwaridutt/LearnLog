import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ghostDanger' | 'danger' | 'success';

/**
 * F-27: every variant has a clearly visible hover (colour change, not just a darker grey)
 * and a press state. Hovers only apply to enabled buttons.
 */
const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white shadow-sm enabled:hover:bg-indigo-500 enabled:hover:shadow disabled:bg-indigo-300',
  secondary:
    'bg-surface text-slate-700 border border-slate-300 enabled:hover:border-indigo-400 enabled:hover:bg-indigo-50 enabled:hover:text-indigo-700 disabled:text-slate-400',
  ghost: 'text-slate-600 enabled:hover:bg-indigo-50 enabled:hover:text-indigo-700 disabled:text-slate-300',
  ghostDanger: 'text-rose-600 enabled:hover:bg-rose-50 enabled:hover:text-rose-700 disabled:text-slate-300',
  danger: 'bg-rose-600 text-white shadow-sm enabled:hover:bg-rose-500 enabled:hover:shadow disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white shadow-sm enabled:hover:bg-emerald-500 enabled:hover:shadow disabled:bg-emerald-300',
};

/** Shared hover for whole clickable rows (topic, revision, history rows). */
export const rowHover = 'transition-colors hover:bg-indigo-50';

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 enabled:active:scale-[0.97] disabled:cursor-not-allowed ${sz} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'violet' | 'sky';
const tones: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-rose-100 text-rose-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  violet: 'bg-violet-100 text-violet-800',
  sky: 'bg-sky-100 text-sky-800',
};

export function Badge({ tone = 'slate', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${width} rounded-2xl bg-surface shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Input styling without a width, for toolbars and fixed-width inputs. */
export const inputBase =
  'rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
export const inputCls = `${inputBase} w-full`;

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error instanceof Error ? error.message : String(error)}</p>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-surface px-6 py-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

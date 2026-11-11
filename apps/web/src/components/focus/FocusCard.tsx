import { Link, NavLink } from 'react-router-dom';
import { fmtDuration } from '../../lib/format';
import { fmtCountdown } from '../../lib/focusPrefs';
import { Badge, Button, headerChip, headerChipActive } from '../ui';
import { KIND_LABEL, useFocusActions, useFocusClock, useFocusCurrent } from './useFocus';

/** Dashboard card for the running or paused countdown; renders nothing when idle. */
export function FocusCard() {
  const current = useFocusCurrent();
  const s = current.data?.active ?? null;
  const clock = useFocusClock(s);
  const actions = useFocusActions();
  if (!s || !clock) return null;
  const running = s.status === 'RUNNING';
  const focus = s.kind === 'FOCUS';

  return (
    <section
      className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${focus ? 'border-indigo-200 bg-indigo-50' : 'border-emerald-200 bg-emerald-50'}`}
      aria-label="Focus timer"
    >
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 sm:hidden">
        <div className={`h-full ${focus ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${clock.progress * 100}%` }} />
      </div>
      <p className={`font-mono text-3xl font-semibold tabular-nums ${running ? 'text-slate-900' : 'text-slate-400'}`}>{fmtCountdown(clock.remaining)}</p>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={focus ? 'indigo' : 'green'}>{KIND_LABEL[s.kind]}</Badge>
          {!running && <Badge tone="amber">Paused</Badge>}
          <span className="text-xs text-slate-500">of {fmtDuration(s.plannedSeconds)}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-600">
          {s.topicName ? (
            <Link to={`/fields/${s.fieldId}?topic=${s.topicId}`} className="hover:text-indigo-700">
              {s.topicName} <span className="text-slate-400">· {s.fieldName}</span>
            </Link>
          ) : focus ? (
            'Focus countdown'
          ) : (
            'Break time'
          )}
        </p>
      </div>
      <div className="flex gap-2">
        {running ? (
          <Button size="sm" disabled={actions.pending} onClick={() => actions.pause(s.id)}>
            ⏸ Pause
          </Button>
        ) : (
          <Button size="sm" variant="primary" disabled={actions.pending} onClick={() => actions.resume(s.id)}>
            ▶ Resume
          </Button>
        )}
        <Link to="/focus" className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
          Open timer →
        </Link>
      </div>
    </section>
  );
}

/** Header link to the Focus page, showing the live countdown while a session is active. */
export function FocusNavLink() {
  const current = useFocusCurrent();
  const s = current.data?.active ?? null;
  const clock = useFocusClock(s);
  // Colour shows the state at a glance on every screen: running focus / running break / paused / idle.
  const state = !s ? 'idle' : s.status === 'PAUSED' ? 'paused' : s.kind === 'BREAK' ? 'break' : 'focus';
  const tone = {
    focus: 'h-9 rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-500',
    break: 'h-9 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-500',
    paused: 'h-9 rounded-full bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 shadow-sm hover:bg-amber-200',
    idle: '',
  }[state];
  const label = { focus: 'Focus running', break: 'Break running', paused: 'Focus paused', idle: 'Focus timer' }[state];
  return (
    <NavLink
      to="/focus"
      title={label}
      aria-label={s && clock ? `${label}, ${fmtCountdown(clock.remaining)} left` : label}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-3.5 text-sm font-medium transition-colors ${tone || (isActive ? headerChipActive : headerChip)}`
      }
    >
      <span aria-hidden className={state === 'focus' || state === 'break' ? 'animate-pulse' : ''}>
        {state === 'paused' ? '⏸' : state === 'idle' ? '⏱' : '●'}
      </span>
      {s && clock ? <span className="font-mono tabular-nums">{fmtCountdown(clock.remaining)}</span> : 'Focus'}
    </NavLink>
  );
}

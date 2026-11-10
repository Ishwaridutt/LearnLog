import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FOCUS_MAX_SECONDS, type FocusKind, type FocusSession } from '@study/shared';
import { api } from '../../api/client';
import { fmtDuration, fmtTime } from '../../lib/format';
import { fmtCountdown, setFocusPrefs, useFocusPrefs } from '../../lib/focusPrefs';
import { Badge, Button, inputBase, Modal, Spinner } from '../ui';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, useFocusActions, useFocusClock, useFocusCurrent } from './useFocus';

const PRESETS: Record<FocusKind, number[]> = {
  FOCUS: [25, 30, 45, 55, 60, 75, 90],
  BREAK: [5, 10, 15, 20, 30],
};

/** The countdown card on the Focus page: a setup form when idle, controls when a session is active. */
export function FocusTimer() {
  const current = useFocusCurrent();
  if (current.isPending) return <Spinner />;
  return current.data?.active ? <ActiveTimer session={current.data.active} /> : <StartForm />;
}

/** Countdown digits sized so "1:15:00" fits inside the ring as well as "25:00". */
function Digits({ seconds, dim = false }: { seconds: number; dim?: boolean }) {
  const text = fmtCountdown(seconds);
  return (
    <p
      className={`font-mono font-semibold tracking-tight tabular-nums ${text.length > 5 ? 'text-[2.6rem] sm:text-5xl' : 'text-5xl sm:text-6xl'} ${
        dim ? 'text-slate-400' : 'text-slate-900'
      }`}
    >
      {text}
    </p>
  );
}

function Ring({ progress, kind, children }: { progress: number; kind: FocusKind; children: React.ReactNode }) {
  const r = 90;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[17rem] place-items-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="8" className="stroke-slate-200" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * progress}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${kind === 'FOCUS' ? 'stroke-indigo-500' : 'stroke-emerald-500'}`}
        />
      </svg>
      <div className="relative px-6 text-center">{children}</div>
    </div>
  );
}

function ActiveTimer({ session: s }: { session: FocusSession }) {
  const actions = useFocusActions();
  const clock = useFocusClock(s)!;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const running = s.status === 'RUNNING';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone={s.kind === 'FOCUS' ? 'indigo' : 'green'}>{KIND_LABEL[s.kind]}</Badge>
        <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
      </div>

      <Ring progress={clock.progress} kind={s.kind}>
        <Digits seconds={clock.remaining} dim={!running} />
        <p className="mt-1 text-xs text-slate-500">
          of {fmtDuration(s.plannedSeconds)}
          {running && clock.endsAt && <> · ends {fmtTime(clock.endsAt.toISOString())}</>}
        </p>
      </Ring>

      {s.topicName ? (
        <p className="text-center text-sm text-slate-600">
          Studying{' '}
          <Link to={`/fields/${s.fieldId}?topic=${s.topicId}`} className="font-medium text-indigo-700 hover:underline">
            {s.topicName}
          </Link>
          <span className="text-slate-400"> · {s.fieldName}</span>
        </p>
      ) : (
        <p className="text-center text-sm text-slate-500">{s.kind === 'BREAK' ? 'Step away from the screen.' : 'Not linked to a topic.'}</p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {running ? (
          <Button variant="primary" disabled={actions.pending} onClick={() => actions.pause(s.id)}>
            ⏸ Pause
          </Button>
        ) : (
          <Button variant="primary" disabled={actions.pending} onClick={() => actions.resume(s.id)}>
            ▶ Resume
          </Button>
        )}
        <Button disabled={actions.pending} onClick={() => actions.stop(s.id)} title="End now and keep the time used">
          ■ Stop
        </Button>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          ✎ Edit
        </Button>
        <Button variant="ghostDanger" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      {editing && <EditDuration session={s} used={clock.used} onClose={() => setEditing(false)} />}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this session?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false);
                void actions.remove(s.id);
              }}
            >
              Delete session
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          The countdown is discarded and won't appear in history.
          {s.topicName && ' Study time already logged on the topic is kept, and its timer is paused.'} Use Stop instead to keep a record.
        </p>
      </Modal>
    </div>
  );
}

function EditDuration({ session: s, used, onClose }: { session: FocusSession; used: number; onClose: () => void }) {
  const actions = useFocusActions();
  const [h, setH] = useState(String(Math.floor(s.plannedSeconds / 3600)));
  const [m, setM] = useState(String(Math.round((s.plannedSeconds % 3600) / 60)));
  const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60;
  const error = total <= used ? `Must be more than the ${fmtDuration(used + 59)} already used` : total > FOCUS_MAX_SECONDS ? 'At most 8 hours' : null;
  const save = async (seconds: number) => {
    await actions.edit(s.id, seconds);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Change duration"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!!error || actions.pending} onClick={() => save(total)}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          {fmtDuration(used)} used so far. Set the new total length of this {KIND_LABEL[s.kind].toLowerCase()} session.
        </p>
        <DurationInputs h={h} m={m} setH={setH} setM={setM} />
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15].map((add) => (
            <Button key={add} size="sm" disabled={actions.pending || s.plannedSeconds + add * 60 > FOCUS_MAX_SECONDS} onClick={() => save(s.plannedSeconds + add * 60)}>
              +{add} min
            </Button>
          ))}
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

function DurationInputs({ h, m, setH, setM }: { h: string; m: string; setH: (v: string) => void; setM: (v: string) => void }) {
  return (
    <div className="flex items-end gap-2">
      <label className="text-xs text-slate-500">
        Hours
        <input type="number" min={0} max={8} className={`${inputBase} mt-0.5 block w-20`} value={h} onChange={(e) => setH(e.target.value)} />
      </label>
      <label className="text-xs text-slate-500">
        Minutes
        <input type="number" min={0} max={59} className={`${inputBase} mt-0.5 block w-20`} value={m} onChange={(e) => setM(e.target.value)} />
      </label>
    </div>
  );
}

function StartForm() {
  const prefs = useFocusPrefs();
  const actions = useFocusActions();
  const topics = useQuery({ queryKey: ['focus-topics'], queryFn: api.focusTopics });
  const [kind, setKind] = useState<FocusKind>('FOCUS');
  const minutes = kind === 'FOCUS' ? prefs.focusMinutes : prefs.breakMinutes;
  const [h, setH] = useState(String(Math.floor(minutes / 60)));
  const [m, setM] = useState(String(minutes % 60));
  const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60;
  const error = total < 60 ? 'Set at least 1 minute' : total > FOCUS_MAX_SECONDS ? 'At most 8 hours' : null;
  // Drop a remembered topic that was deleted, archived or moved into an archived subject.
  const topicId = topics.data?.some((t) => t.id === prefs.topicId) ? prefs.topicId : null;

  const setMinutes = (min: number) => {
    setH(String(Math.floor(min / 60)));
    setM(String(min % 60));
  };
  const switchKind = (k: FocusKind) => {
    setKind(k);
    setMinutes(k === 'FOCUS' ? prefs.focusMinutes : prefs.breakMinutes);
  };
  const start = () => {
    const min = Math.round(total / 60);
    setFocusPrefs(kind === 'FOCUS' ? { focusMinutes: min } : { breakMinutes: min });
    void actions.start({ kind, plannedSeconds: total, topicId: kind === 'FOCUS' ? topicId : null });
  };

  // Subject first, then its topics. Until the user picks a subject, it follows the remembered topic.
  const [pickedField, setPickedField] = useState<string | null>(null);
  const fieldId = pickedField ?? topics.data?.find((t) => t.id === topicId)?.fieldId ?? '';
  const subjects = [...new Map((topics.data ?? []).map((t) => [t.fieldId, t.fieldName])).entries()];
  const fieldTopics = (topics.data ?? []).filter((t) => t.fieldId === fieldId);
  const chooseSubject = (id: string) => {
    setPickedField(id);
    setFocusPrefs({ topicId: null });
  };

  return (
    <div className="space-y-5">
      <div className="mx-auto flex w-fit rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Session type">
        {(['FOCUS', 'BREAK'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => switchKind(k)}
            className={`rounded-lg px-5 py-1.5 text-sm font-medium transition-colors ${
              kind === k ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-500 hover:text-indigo-700'
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <Ring progress={0} kind={kind}>
        <Digits seconds={total} />
        <p className="mt-1 text-xs text-slate-500">{kind === 'FOCUS' ? 'focus' : 'break'}</p>
      </Ring>

      <div className="space-y-3">
        <div className="flex flex-wrap justify-center gap-1.5">
          {PRESETS[kind].map((p) => (
            <button
              key={p}
              onClick={() => setMinutes(p)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                total === p * 60
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              {p >= 60 ? `${Math.floor(p / 60)}h${p % 60 ? ` ${p % 60}m` : ''}` : `${p} min`}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          <DurationInputs h={h} m={m} setH={setH} setM={setM} />
        </div>
        {error && <p className="text-center text-xs text-rose-600">{error}</p>}
      </div>

      {kind === 'FOCUS' && (
        <div className="mx-auto max-w-lg space-y-1.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Subject (optional)
              <select className={`${inputBase} mt-0.5 block w-full`} value={fieldId} onChange={(e) => chooseSubject(e.target.value)}>
                <option value="">No topic, just a countdown</option>
                {subjects.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Topic
              <select
                className={`${inputBase} mt-0.5 block w-full`}
                value={topicId ?? ''}
                disabled={!fieldId}
                onChange={(e) => setFocusPrefs({ topicId: e.target.value || null })}
              >
                <option value="">{fieldId ? (fieldTopics.length ? 'Choose a topic…' : 'No topics in this subject') : 'Pick a subject first'}</option>
                {fieldTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.status === 'IN_PROGRESS' ? ' · in progress' : t.status === 'COMPLETED' || t.status === 'MASTERED' ? ' · revise' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-center text-xs text-slate-400">
            {topicId ? "The topic's study timer starts, pauses and stops with this countdown." : 'Pick a topic to log this time as study time.'}
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <Button variant={kind === 'FOCUS' ? 'primary' : 'success'} disabled={!!error || actions.pending} onClick={start} className="px-8">
          ▶ Start {kind === 'FOCUS' ? 'focus' : 'break'}
        </Button>
      </div>
    </div>
  );
}

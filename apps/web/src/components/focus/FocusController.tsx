import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { focusEndsAt, type FocusSession } from '@study/shared';
import { api } from '../../api/client';
import { fmtDuration, fmtTime } from '../../lib/format';
import { fmtCountdown, getFocusPrefs, useFocusPrefs } from '../../lib/focusPrefs';
import { playSound, unlockAudio } from '../../lib/sounds';
import { useNow } from '../../lib/useNow';
import { Button, Modal } from '../ui';
import { KIND_LABEL, useFocusActions, useFocusClock, useFocusCurrent } from './useFocus';

const ACK_KEY = 'focus.ack';
/** Prompt for sessions that ended up to an hour ago; ring only if it ended in the last 2 minutes. */
const PROMPT_WINDOW_MS = 60 * 60_000;
const RING_WINDOW_MS = 2 * 60_000;
const ALARM_SECONDS = 60;
const BASE_TITLE = typeof document !== 'undefined' ? document.title : 'LearnLog';

function readAck(): string | null {
  try {
    return localStorage.getItem(ACK_KEY);
  } catch {
    return null;
  }
}
function writeAck(id: string) {
  try {
    localStorage.setItem(ACK_KEY, id);
  } catch {
    /* ignore */
  }
}

function notify(s: FocusSession) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    new Notification(s.kind === 'FOCUS' ? 'Focus session complete' : "Break's over", {
      body: `${fmtDuration(s.plannedSeconds)} ${KIND_LABEL[s.kind].toLowerCase()}${s.topicName ? ` · ${s.topicName}` : ''} finished.`,
      tag: 'learnlog-focus',
    });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

/**
 * Mounted once in the layout, so the alarm fires on every page: schedules a refetch for the moment
 * the countdown ends, rings + prompts when a session completes, and shows the countdown in the tab title.
 */
export function FocusController() {
  const qc = useQueryClient();
  const current = useFocusCurrent();
  const prefs = useFocusPrefs();
  const actions = useFocusActions();
  const active = current.data?.active ?? null;
  const last = current.data?.last ?? null;
  const clock = useFocusClock(active);

  // Ask the server for fresh state right when the running countdown reaches 0; it closes the session.
  const endsAt = active ? focusEndsAt(active)?.getTime() : undefined;
  useEffect(() => {
    if (!endsAt) return;
    const id = setTimeout(() => void qc.invalidateQueries(), Math.max(0, endsAt - Date.now()) + 300);
    return () => clearTimeout(id);
  }, [endsAt, qc]);

  // Browsers only allow sound after a user gesture; resume audio on the first click after a reload.
  useEffect(() => {
    const on = () => unlockAudio();
    window.addEventListener('pointerdown', on, { once: true });
    return () => window.removeEventListener('pointerdown', on);
  }, []);

  const [ack, setAck] = useState(readAck);
  const [ringUntil, setRingUntil] = useState<number | null>(null);
  const ringNow = useNow(ringUntil !== null);
  const ringLeft = ringUntil === null ? 0 : Math.max(0, Math.ceil((ringUntil - ringNow) / 1000));
  const ringing = ringLeft > 0;
  const stopRef = useRef<(() => void) | null>(null);
  const playedRef = useRef<string | null>(null);

  const due =
    !active && last?.status === 'COMPLETED' && last.endedAt && last.id !== ack && Date.now() - Date.parse(last.endedAt) < PROMPT_WINDOW_MS
      ? last
      : null;

  const silence = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setRingUntil(null);
  }, []);

  const dueRef = useRef(due);
  dueRef.current = due;
  const dueId = due?.id ?? null;
  useEffect(() => {
    const d = dueRef.current;
    if (!d || playedRef.current === d.id) return;
    playedRef.current = d.id;
    if (Date.now() - Date.parse(d.endedAt!) > RING_WINDOW_MS) return;
    const { sound, volume } = getFocusPrefs();
    // Rings for ALARM_SECONDS unless dismissed; the sound engine stops itself at the same moment.
    stopRef.current = playSound(sound, volume, ALARM_SECONDS);
    setRingUntil(Date.now() + ALARM_SECONDS * 1000);
    notify(d);
  }, [dueId]);

  // Nothing due any more (new session started, or acknowledged elsewhere): stop ringing.
  useEffect(() => {
    if (!dueId) silence();
  }, [dueId, silence]);

  // Another tab acknowledged the alarm.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== ACK_KEY) return;
      silence();
      setAck(e.newValue);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, [silence]);

  useEffect(() => () => stopRef.current?.(), []);

  // Countdown in the browser tab title.
  const remaining = clock ? Math.ceil(clock.remaining) : null;
  useEffect(() => {
    if (active && remaining !== null) {
      document.title = `${active.status === 'PAUSED' ? '⏸ ' : ''}${fmtCountdown(remaining)} · ${KIND_LABEL[active.kind]} · LearnLog`;
    } else if (due) {
      document.title = "⏰ Time's up · LearnLog";
    } else {
      document.title = BASE_TITLE;
    }
  }, [active, remaining, due]);

  // For "start focus" after a break: reuse the last linked topic if it can still be linked.
  const topics = useQuery({ queryKey: ['focus-topics'], queryFn: api.focusTopics, enabled: due?.kind === 'BREAK' });

  if (!due) return null;

  const acknowledge = () => {
    silence();
    writeAck(due.id);
    setAck(due.id);
  };
  const next = due.kind === 'FOCUS' ? { kind: 'BREAK' as const, minutes: prefs.breakMinutes } : { kind: 'FOCUS' as const, minutes: prefs.focusMinutes };
  const nextTopic = next.kind === 'FOCUS' ? (topics.data?.find((t) => t.id === prefs.topicId) ?? null) : null;

  return (
    <Modal
      open
      closeOnBackdrop={false}
      onClose={acknowledge}
      title={due.kind === 'FOCUS' ? '⏰ Focus session complete' : "⏰ Break's over"}
      footer={
        <>
          <Button onClick={acknowledge}>Close</Button>
          <Button
            variant={next.kind === 'BREAK' ? 'success' : 'primary'}
            disabled={actions.pending}
            onClick={() => {
              acknowledge();
              void actions.start({ kind: next.kind, plannedSeconds: next.minutes * 60, topicId: nextTopic?.id ?? null });
            }}
          >
            Start {next.minutes} min {next.kind === 'BREAK' ? 'break' : 'focus'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Your {fmtDuration(due.plannedSeconds)} {KIND_LABEL[due.kind].toLowerCase()}
          {due.topicName && (
            <>
              {' '}
              on <strong>{due.topicName}</strong>
            </>
          )}{' '}
          finished at {fmtTime(due.endedAt)}.
          {due.topicName && ' Its study timer is paused; end the topic from its page when you are done with it.'}
        </p>
        {nextTopic && <p className="text-slate-500">The next focus session continues on {nextTopic.name}.</p>}
        {ringing && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            <span className="animate-pulse">🔔 Alarm ringing · stops by itself in {ringLeft}s</span>
            <Button size="sm" onClick={silence}>
              Stop alarm
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

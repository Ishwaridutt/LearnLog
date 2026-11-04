import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Grade, TopicDetail } from '@study/shared';
import { api } from '../api/client';
import { fmtClock, fmtDate, fmtDateTime, fmtDay, fmtDuration, fmtTime, liveSeconds, relDay } from '../lib/format';
import { useNow } from '../lib/useNow';
import { LinkList } from './LinkList';
import { StatusBadge } from './StatusBadge';
import { TopicActions } from './TopicActions';
import { toTopicInput, TopicFormFields, type TopicFormValue } from './TopicForm';
import { useToast } from './Toasts';
import { Badge, Button, ErrorText, Modal, Spinner } from './ui';

export const GRADE_TONE: Record<Grade, 'red' | 'amber' | 'green'> = { FORGOT: 'red', HARD: 'amber', GOOD: 'green' };
export const GRADE_LABEL: Record<Grade, string> = { FORGOT: 'Forgot', HARD: 'Hard', GOOD: 'Good' };

/** F-12: topic detail side panel, with editing and the activity timeline. */
export function TopicDrawer({ topicId, today, onClose }: { topicId: string; today: string; onClose: () => void }) {
  const topic = useQuery({ queryKey: ['topic', topicId], queryFn: () => api.topic(topicId) });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !editing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);
  useEffect(() => setEditing(false), [topicId]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onMouseDown={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Topic details"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">{topic.data?.fieldName ?? 'Topic'}</span>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
        {topic.isPending || !settings.data ? (
          <Spinner />
        ) : topic.error ? (
          <div className="p-5">
            <ErrorText error={topic.error} />
          </div>
        ) : editing ? (
          <EditTopic topic={topic.data} onDone={() => setEditing(false)} />
        ) : (
          <TopicView topic={topic.data} today={today} steps={settings.data.revisionIntervals.length} onEdit={() => setEditing(true)} onDeleted={onClose} />
        )}
      </aside>
    </div>
  );
}

function TopicView({
  topic: t,
  today,
  steps,
  onEdit,
  onDeleted,
}: {
  topic: TopicDetail;
  today: string;
  steps: number;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow(!!t.liveSince);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutate = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <div className="space-y-6 p-5">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">{t.name}</h2>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            ✎ Edit
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          {t.archivedAt && <Badge>Archived</Badge>}
          <span className="text-sm text-slate-500">{fmtDuration(liveSeconds(t.timeSeconds, t.liveSince, now))} total</span>
        </div>
        {t.description && <p className="text-sm whitespace-pre-wrap text-slate-700">{t.description}</p>}
        <LinkList links={t.links} />
        {t.recallPrompt && (
          <details className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-indigo-800">Recall prompt</summary>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{t.recallPrompt}</p>
          </details>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
        <Info label="Added" value={fmtDate(t.createdAt)} />
        <Info label="Completed" value={fmtDate(t.completedAt)} />
        <Info label="Last revised" value={t.status === 'NOT_STARTED' || t.status === 'IN_PROGRESS' ? '—' : t.lastRevisedAt ? fmtDate(t.lastRevisedAt) : 'Not yet'} />
        <Info
          label="Next revision"
          value={t.status === 'MASTERED' ? 'Mastered' : t.nextDueDay ? `${fmtDay(t.nextDueDay)} (${relDay(t.nextDueDay, today)})` : '—'}
        />
        {t.reviewStep !== null && <Info label="Step" value={`${Math.min(t.reviewStep, steps)}/${steps}`} />}
        <Info label="Revisions" value={String(t.revisionCount)} />
        <Info label="Forgot" value={String(t.forgotCount)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TopicActions topic={t} size="md" />
        {t.status === 'MASTERED' && !t.openActivity && (
          <Button onClick={() => mutate.mutate(() => api.pullBack(t.id))}>Pull back into revisions</Button>
        )}
        <Button variant="ghost" onClick={() => mutate.mutate(() => api.archiveTopic(t.id, !t.archivedAt))}>
          {t.archivedAt ? 'Unarchive' : 'Archive'}
        </Button>
        <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <Timeline topic={t} now={now} />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete topic?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() =>
                mutate.mutate(async () => {
                  await api.deleteTopic(t.id);
                  onDeleted();
                })
              }
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          This removes <strong>{t.name}</strong> and its {t.activities.length} logged sessions, and its time leaves your totals. Archive it instead if you only want it out of the way.
        </p>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Timeline({ topic, now }: { topic: TopicDetail; now: number }) {
  if (!topic.activities.length) return <p className="text-sm text-slate-500">No sessions yet. Press Start when you begin studying.</p>;
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Timeline</h3>
      <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
        {topic.activities.map((a) => {
          const learning = a.type === 'LEARNING';
          return (
            <li key={a.id} className="relative">
              <span className={`absolute top-1.5 -left-[27px] h-3 w-3 rounded-full ring-4 ring-white ${learning ? 'bg-indigo-500' : 'bg-violet-500'}`} />
              <details className="rounded-lg border border-slate-200 px-3 py-2">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                  <Badge tone={learning ? 'indigo' : 'violet'}>{learning ? 'Learned' : 'Revised'}</Badge>
                  <span className="text-slate-700">{fmtDateTime(a.completedAt ?? a.startedAt)}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {a.status === 'IN_PROGRESS' ? fmtClock(liveSeconds(a.totalSeconds, a.liveSince, now)) : fmtDuration(a.totalSeconds)}
                  </span>
                  {a.status === 'IN_PROGRESS' && <Badge tone={a.liveSince ? 'green' : 'amber'}>{a.liveSince ? 'Running' : 'Paused'}</Badge>}
                  {a.grade && <Badge tone={GRADE_TONE[a.grade]}>{GRADE_LABEL[a.grade]}</Badge>}
                  {a.isEarly && <Badge>Early</Badge>}
                  {!learning && a.stepAtStart !== null && <span className="text-xs text-slate-400">step {a.stepAtStart + 1}</span>}
                </summary>
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                  {a.segments.map((s) => (
                    <li key={s.id} className="font-mono">
                      {fmtDateTime(s.startedAt)} → {s.endedAt ? fmtTime(s.endedAt) : 'now'}
                      {s.edited && <span className="ml-1 font-sans text-amber-700">(edited)</span>}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EditTopic({ topic, onDone }: { topic: TopicDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<TopicFormValue>({
    name: topic.name,
    description: topic.description ?? '',
    recallPrompt: topic.recallPrompt ?? '',
    links: topic.links.map((l) => ({ label: l.label, url: l.url })),
  });
  const save = useMutation({
    mutationFn: () => api.updateTopic(topic.id, toTopicInput(value)),
    onSuccess: () => {
      qc.invalidateQueries();
      onDone();
    },
  });
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-lg font-semibold text-slate-900">Edit topic</h2>
      <TopicFormFields value={value} onChange={setValue} />
      <ErrorText error={save.error} />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!value.name.trim() || save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

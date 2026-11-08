import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { FieldSummary } from '@study/shared';
import { api } from '../api/client';
import { FieldForm } from '../components/FieldForm';
import { HistoryTab } from '../components/HistoryTab';
import { PaceCard } from '../components/Pace';
import { WeakTab } from '../components/WeakTab';
import { RevisionsTab } from '../components/RevisionsTab';
import { TopicDrawer } from '../components/TopicDrawer';
import { emptyTopic, toTopicInput, TopicFormFields } from '../components/TopicForm';
import { ReadOnlyContext } from '../components/TopicActions';
import { TopicsTab } from '../components/TopicsTab';
import { useToast } from '../components/Toasts';
import { Badge, Button, ErrorText, inputCls, Modal, Spinner } from '../components/ui';
import { fmtDuration, liveSeconds } from '../lib/format';
import { useNow } from '../lib/useNow';

const TABS = ['ongoing', 'all', 'completed', 'revised', 'revisions', 'weak', 'history'] as const;
type Tab = (typeof TABS)[number];

export function FieldPage() {
  const { fieldId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'all';
  const topicId = params.get('topic');
  const summary = useQuery({ queryKey: ['field', fieldId], queryFn: () => api.fieldSummary(fieldId) });
  const [adding, setAdding] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === 'topic' });
  };

  if (summary.isPending) return <Spinner />;
  if (summary.error)
    return (
      <div className="space-y-3">
        <ErrorText error={summary.error} />
        <Link to="/" className="text-sm text-indigo-700">
          ← Back to subjects
        </Link>
      </div>
    );
  const s = summary.data;
  const archived = !!s.field.archivedAt;
  const openTopic = (id: string) => setParam('topic', id);

  const tabLabel: Record<Tab, [string, number | null, boolean?]> = {
    ongoing: ['Ongoing', s.tabs.ongoing],
    all: ['All topics', s.tabs.all],
    completed: ['Completed', s.tabs.completed],
    revised: ['Revised', s.tabs.revised],
    revisions: ['Revisions', s.tabs.due, s.tabs.due > 0],
    weak: ['Weak spots', s.tabs.weak],
    history: ['History', null],
  };

  return (
    <ReadOnlyContext.Provider value={archived}>
    <div className="space-y-6">
      <FieldHeader summary={s} onAdd={() => setAdding(true)} />
      {archived && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This subject is archived. Its history and time still count, but timers and revisions are paused. Unarchive it to continue studying.
        </p>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => {
          const [label, count, alert] = tabLabel[t];
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setParam('tab', t)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap ${
                active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-indigo-700'
              }`}
            >
              {label}
              {count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    alert ? 'bg-rose-500 text-white' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
              {t === 'revisions' && s.tabs.upcoming > 0 && <span className="text-xs font-normal text-slate-400">+{s.tabs.upcoming} soon</span>}
            </button>
          );
        })}
      </nav>

      {tab === 'ongoing' && <TopicsTab fieldId={fieldId} tab="ongoing" today={s.today} onOpen={openTopic} />}
      {tab === 'all' && (
        <TopicsTab fieldId={fieldId} tab="all" today={s.today} onOpen={openTopic} onAdd={archived ? undefined : () => setAdding(true)} />
      )}
      {tab === 'completed' && <TopicsTab fieldId={fieldId} tab="completed" today={s.today} onOpen={openTopic} />}
      {tab === 'revised' && <TopicsTab fieldId={fieldId} tab="revised" today={s.today} onOpen={openTopic} />}
      {tab === 'revisions' && <RevisionsTab fieldId={fieldId} onOpen={openTopic} />}
      {tab === 'weak' && <WeakTab fieldId={fieldId} today={s.today} onOpen={openTopic} />}
      {tab === 'history' && <HistoryTab fieldId={fieldId} onOpen={openTopic} />}

      {adding && <AddTopic fieldId={fieldId} onClose={() => setAdding(false)} onCreated={openTopic} />}
      {topicId && <TopicDrawer topicId={topicId} today={s.today} onClose={() => setParam('topic', null)} />}
    </div>
    </ReadOnlyContext.Provider>
  );
}

function FieldHeader({ summary: s, onAdd }: { summary: FieldSummary; onAdd: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(!!s.field.liveSince);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const archived = !!s.field.archivedAt;

  const archive = useMutation({
    mutationFn: () => api.archiveField(s.field.id, !archived),
    onSuccess: () => {
      qc.invalidateQueries();
      toast(archived ? 'Subject restored' : 'Subject archived. Find it under “Show archived” on the home page.');
    },
  });
  const del = useMutation({
    mutationFn: () => api.deleteField(s.field.id),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate('/');
      toast(`Deleted “${s.field.name}”`);
    },
  });

  const learning = liveSeconds(s.learningSeconds, s.learningLiveSince, now);
  const revision = liveSeconds(s.revisionSeconds, s.revisionLiveSince, now);

  return (
    <header className="space-y-4">
      <Link to="/" className="rounded text-sm text-slate-500 transition-colors hover:text-indigo-700">
        ← All subjects
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-4 w-4 shrink-0 rounded-full" style={{ background: s.field.color }} />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              {s.field.name}
              {archived && <Badge>Archived</Badge>}
            </h1>
            {s.field.description && <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{s.field.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!archived && (
            <Button variant="primary" onClick={onAdd}>
              + Add topic
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => archive.mutate()} disabled={archive.isPending}>
            {archived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button variant="ghostDanger" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatChip label="Total time" value={fmtDuration(learning + revision)} strong />
        <StatChip label="First-time learning" value={fmtDuration(learning)} />
        <StatChip label="Revision" value={fmtDuration(revision)} />
        <StatChip label="Completed" value={`${s.counts.completed}`} sub={`of ${s.tabs.all} topics`} />
        <StatChip label="In progress / Mastered" value={`${s.counts.inProgress} / ${s.counts.mastered}`} />
        <StatChip
          label="Recall rate"
          value={s.recallRate === null ? '–' : `${Math.round(s.recallRate * 100)}%`}
          sub="Good on scheduled revisions"
        />
      </div>

      {s.field.pace && <PaceCard pace={s.field.pace} />}
      {s.field.customIntervals && (
        <p className="text-xs text-slate-500">
          Revision ladder for this subject: <span className="font-medium text-slate-700">{s.field.customIntervals.join(' → ')} days</span>
        </p>
      )}

      {editing && <FieldForm open onClose={() => setEditing(false)} initial={s.field} />}
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete subject?"
        footer={
          <>
            <Button onClick={() => setDeleting(false)}>Cancel</Button>
            <Button variant="danger" disabled={confirmName !== s.field.name || del.isPending} onClick={() => del.mutate()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            This permanently deletes <strong>{s.field.name}</strong>, all {s.tabs.all} topics and every logged session. It can't be undone. Archive it instead to keep its history.
          </p>
          <label className="block">
            Type <strong>{s.field.name}</strong> to confirm
            <input className={`${inputCls} mt-1`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </label>
          <ErrorText error={del.error} />
        </div>
      </Modal>
    </header>
  );
}

function StatChip({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${strong ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-surface'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${strong ? 'text-indigo-900' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function AddTopic({ fieldId, onClose, onCreated }: { fieldId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState(emptyTopic);
  const create = useMutation({
    mutationFn: () => api.createTopic(fieldId, toTopicInput(value)),
    onSuccess: (t) => {
      qc.invalidateQueries();
      toast(`Added “${t.name}”. Press Start when you begin.`, 'success');
      onClose();
      onCreated(t.id);
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Add topic"
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!value.name.trim() || create.isPending} onClick={() => create.mutate()}>
            Add topic
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.name.trim()) create.mutate();
        }}
        className="space-y-3"
      >
        <TopicFormFields value={value} onChange={setValue} />
        <ErrorText error={create.error} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FOCUS_STATUSES, focusUsed, type FocusHistoryQuery, type FocusKind, type FocusSession, type FocusStatus } from '@study/shared';
import { api } from '../../api/client';
import { fmtDateTime, fmtDuration, fmtTime } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { Badge, Button, Empty, inputBase, Spinner } from '../ui';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, useFocusActions } from './useFocus';

/** Every focus and break session: set vs used time, start/end and status. */
export function FocusHistory() {
  const [kind, setKind] = useState<FocusKind | ''>('');
  const [status, setStatus] = useState<FocusStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query: FocusHistoryQuery = { kind: kind || undefined, status: status || undefined, from: from || undefined, to: to || undefined };
  const rows = useQuery({ queryKey: ['focus-history', query], queryFn: () => api.focusHistory(query), placeholderData: keepPreviousData });
  const now = useNow(!!rows.data?.some((r) => r.status === 'RUNNING'));
  const filtered = !!(kind || status || from || to);
  const sum = (k: FocusKind) => rows.data?.filter((r) => r.kind === k).reduce((s, r) => s + focusUsed(r, now), 0) ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <select className={inputBase} value={kind} onChange={(e) => setKind(e.target.value as FocusKind | '')} aria-label="Type">
          <option value="">Focus and breaks</option>
          <option value="FOCUS">Focus</option>
          <option value="BREAK">Break</option>
        </select>
        <select className={inputBase} value={status} onChange={(e) => setStatus(e.target.value as FocusStatus | '')} aria-label="Status">
          <option value="">Any status</option>
          {FOCUS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="text-xs text-slate-500">
          From
          <input type="date" className={`${inputBase} mt-0.5 block`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-slate-500">
          To
          <input type="date" className={`${inputBase} mt-0.5 block`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setKind('');
              setStatus('');
              setFrom('');
              setTo('');
            }}
          >
            ✕ Clear filters
          </Button>
        )}
      </div>

      {rows.isPending ? (
        <Spinner />
      ) : !rows.data?.length ? (
        <Empty title={filtered ? 'No sessions match your filters' : 'No focus sessions yet'}>
          {filtered ? null : 'Start a countdown on the Timer tab and it is recorded here.'}
        </Empty>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {rows.data.length} session{rows.data.length === 1 ? '' : 's'} · focus {fmtDuration(sum('FOCUS'))} · breaks {fmtDuration(sum('BREAK'))}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Started</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Topic</th>
                  <th className="px-4 py-2 font-medium">Set</th>
                  <th className="px-4 py-2 font-medium">Used</th>
                  <th className="px-4 py-2 font-medium">Ended</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.data.map((r) => (
                  <Row key={r.id} row={r} now={now} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Like fmtDuration, but keeps seconds for sessions under a minute. */
const fmtUsed = (secs: number) => (secs < 60 ? `${Math.floor(secs)}s` : fmtDuration(secs));

function Row({ row: r, now }: { row: FocusSession; now: number }) {
  const actions = useFocusActions();
  const used = focusUsed(r, now);
  const sameDay = r.endedAt && new Date(r.endedAt).toDateString() === new Date(r.startedAt).toDateString();
  return (
    <tr className="transition-colors hover:bg-indigo-50">
      <td className="px-4 py-2 whitespace-nowrap text-slate-700">{fmtDateTime(r.startedAt)}</td>
      <td className="px-4 py-2">
        <Badge tone={r.kind === 'FOCUS' ? 'indigo' : 'green'}>{KIND_LABEL[r.kind]}</Badge>
      </td>
      <td className="max-w-[16rem] truncate px-4 py-2">
        {r.topicName ? (
          <Link to={`/fields/${r.fieldId}?topic=${r.topicId}`} className="text-slate-700 hover:text-indigo-700" title={`${r.topicName} · ${r.fieldName}`}>
            {r.topicName}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-slate-600">{fmtDuration(r.plannedSeconds)}</td>
      <td className="px-4 py-2 font-mono text-xs text-slate-900">
        {fmtUsed(used)}
        <span className="ml-1 text-slate-400">({Math.min(100, Math.round((used / r.plannedSeconds) * 100))}%)</span>
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-slate-600">{r.endedAt ? (sameDay ? fmtTime(r.endedAt) : fmtDateTime(r.endedAt)) : '—'}</td>
      <td className="px-4 py-2">
        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-xs text-rose-700 hover:bg-rose-50"
          disabled={actions.pending}
          onClick={() => window.confirm('Delete this session from history? Topic study time is not affected.') && actions.remove(r.id)}
          aria-label="Delete session"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

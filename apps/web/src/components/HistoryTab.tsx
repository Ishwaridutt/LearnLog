import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { GRADES, type Grade, type HistoryQuery } from '@study/shared';
import { api } from '../api/client';
import { fmtDateTime, fmtDuration, liveSeconds } from '../lib/format';
import { useNow } from '../lib/useNow';
import { GRADE_LABEL, GRADE_TONE } from './TopicDrawer';
import { Badge, Button, Empty, inputBase, inputCls, Spinner } from './ui';

/** F-13: every learning and revision session in this field, filterable. */
export function HistoryTab({ fieldId, onOpen }: { fieldId: string; onOpen: (id: string) => void }) {
  const [type, setType] = useState<HistoryQuery['type'] | ''>('');
  const [grade, setGrade] = useState<Grade | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 200);
    return () => clearTimeout(id);
  }, [search]);

  const query: HistoryQuery = {
    type: type || undefined,
    grade: grade || undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };
  const rows = useQuery({
    queryKey: ['history', fieldId, query],
    queryFn: () => api.history(fieldId, query),
    placeholderData: keepPreviousData,
  });
  const now = useNow(!!rows.data?.some((r) => r.liveSince));
  const filtered = !!(type || grade || from || to || q);
  const totalSecs = rows.data?.reduce((s, r) => s + liveSeconds(r.totalSeconds, r.liveSince, now), 0) ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <input type="search" className={`${inputCls} max-w-[14rem]`} placeholder="Topic name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Topic name" />
        <select className={`${inputBase}`} value={type} onChange={(e) => setType(e.target.value as HistoryQuery['type'] | '')} aria-label="Type">
          <option value="">All activity</option>
          <option value="LEARNING">Learning</option>
          <option value="REVISION">Revision</option>
        </select>
        <select className={`${inputBase}`} value={grade} onChange={(e) => setGrade(e.target.value as Grade | '')} aria-label="Grade">
          <option value="">Any grade</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {GRADE_LABEL[g]}
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
              setType('');
              setGrade('');
              setFrom('');
              setTo('');
              setSearch('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {rows.isPending ? (
        <Spinner />
      ) : !rows.data?.length ? (
        <Empty title={filtered ? 'No activity matches these filters' : 'No activity yet'} />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {rows.data.length} session{rows.data.length === 1 ? '' : 's'} · {fmtDuration(totalSecs)}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Topic</th>
                  <th className="px-4 py-2 font-medium">Activity</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.data.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(r.topicId)}>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">{fmtDateTime(r.completedAt ?? r.startedAt)}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {r.topicName}
                      {r.topicArchived && <span className="ml-1 text-xs font-normal text-slate-400">(archived)</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={r.type === 'LEARNING' ? 'indigo' : 'violet'}>{r.type === 'LEARNING' ? 'Learned' : 'Revised'}</Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{fmtDuration(liveSeconds(r.totalSeconds, r.liveSince, now))}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {r.status === 'IN_PROGRESS' && <Badge tone={r.liveSince ? 'green' : 'amber'}>{r.liveSince ? 'Running' : 'Paused'}</Badge>}
                        {r.grade && <Badge tone={GRADE_TONE[r.grade]}>{GRADE_LABEL[r.grade]}</Badge>}
                        {r.isEarly && <Badge>Early</Badge>}
                        {r.type === 'LEARNING' && r.status === 'COMPLETED' && <Badge tone="green">Completed</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

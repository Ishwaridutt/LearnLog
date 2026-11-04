import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { TOPIC_STATUSES, type Topic, type TopicListQuery, type TopicStatus } from '@study/shared';
import { api } from '../api/client';
import { fmtClock, fmtDate, fmtDay, fmtDuration, liveSeconds, relDay } from '../lib/format';
import { useNow } from '../lib/useNow';
import { StatusBadge } from './StatusBadge';
import { TopicActions } from './TopicActions';
import { Badge, Button, Empty, inputBase, inputCls, Spinner } from './ui';

const STATUS_LABEL: Record<TopicStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  MASTERED: 'Mastered',
};

/** Ongoing / All topics / Revised tabs (F-10, F-11). */
export function TopicsTab({
  fieldId,
  tab,
  today,
  onOpen,
  onAdd,
}: {
  fieldId: string;
  tab: 'all' | 'ongoing' | 'revised';
  today: string;
  onOpen: (id: string) => void;
  onAdd?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<TopicListQuery['sort']>('createdAt');
  const [order, setOrder] = useState<TopicListQuery['order']>('desc');
  const [status, setStatus] = useState<TopicStatus | ''>('');

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 200);
    return () => clearTimeout(id);
  }, [search]);

  const query = { tab, q, sort, order, status: status || undefined };
  const topics = useQuery({
    queryKey: ['topics', fieldId, query],
    queryFn: () => api.topics(fieldId, query),
    placeholderData: keepPreviousData,
  });
  const anyLive = !!topics.data?.some((t) => t.liveSince);
  const now = useNow(anyLive);

  return (
    <div className="space-y-3">
      {tab !== 'ongoing' && (
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            className={`${inputCls} max-w-xs`}
            placeholder="Search topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search topics"
          />
          <select className={`${inputBase}`} value={sort} onChange={(e) => setSort(e.target.value as TopicListQuery['sort'])} aria-label="Sort by">
            <option value="createdAt">Sort: date added</option>
            <option value="completedAt">Sort: date completed</option>
          </select>
          <select className={`${inputBase}`} value={order} onChange={(e) => setOrder(e.target.value as TopicListQuery['order'])} aria-label="Order">
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          {tab === 'all' && (
            <select className={`${inputBase}`} value={status} onChange={(e) => setStatus(e.target.value as TopicStatus | '')} aria-label="Status">
              <option value="">All statuses</option>
              {TOPIC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {topics.isPending ? (
        <Spinner />
      ) : !topics.data?.length ? (
        q || status ? (
          <Empty title="No topics match your filters" />
        ) : tab === 'ongoing' ? (
          <Empty title="Nothing in progress">Start a topic or a revision and it shows up here until you end it.</Empty>
        ) : tab === 'revised' ? (
          <Empty title="No revisions yet">Completed topics come up for revision the next day.</Empty>
        ) : (
          <Empty title="No topics yet">
            Add the topic you're about to study, then press Start.
            {onAdd && (
              <div className="mt-3">
                <Button variant="primary" onClick={onAdd}>
                  + Add topic
                </Button>
              </div>
            )}
          </Empty>
        )
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {topics.data.map((t) => (
            <TopicRow key={t.id} topic={t} tab={tab} today={today} now={now} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TopicRow({
  topic: t,
  tab,
  today,
  now,
  onOpen,
}: {
  topic: Topic;
  tab: 'all' | 'ongoing' | 'revised';
  today: string;
  now: number;
  onOpen: (id: string) => void;
}) {
  const done = t.status === 'COMPLETED' || t.status === 'MASTERED';
  const open = t.openActivity;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-slate-50">
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900 hover:text-indigo-700">{t.name}</span>
          {open ? (
            <>
              <Badge tone={open.type === 'LEARNING' ? 'indigo' : 'violet'}>{open.type === 'LEARNING' ? 'Learning' : 'Revision'}</Badge>
              <Badge tone={open.liveSince ? 'green' : 'amber'}>{open.liveSince ? '● Running' : '⏸ Paused'}</Badge>
            </>
          ) : (
            <StatusBadge status={t.status} />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-slate-500">
          {tab === 'ongoing' && open ? (
            <span className="font-mono">
              {open.type === 'REVISION' ? 'This revision' : 'Session'}: {fmtClock(liveSeconds(open.totalSeconds, open.liveSince, now))}
            </span>
          ) : (
            <span>Time {fmtDuration(liveSeconds(t.timeSeconds, t.liveSince, now))}</span>
          )}
          <span>Added {fmtDate(t.createdAt)}</span>
          {done && <span>Completed {fmtDate(t.completedAt)}</span>}
          {done && <span>Last revised {t.lastRevisedAt ? fmtDate(t.lastRevisedAt) : 'not yet'}</span>}
          {t.status === 'COMPLETED' && t.nextDueDay && (
            <span className={t.nextDueDay <= today ? 'font-medium text-rose-600' : ''}>
              Next {fmtDay(t.nextDueDay)} ({relDay(t.nextDueDay, today)})
            </span>
          )}
          {tab === 'revised' && (
            <span>
              {t.revisionCount} revision{t.revisionCount === 1 ? '' : 's'}
              {t.forgotCount ? ` · forgot ${t.forgotCount}×` : ''}
            </span>
          )}
        </div>
      </button>
      <TopicActions topic={t} />
    </li>
  );
}

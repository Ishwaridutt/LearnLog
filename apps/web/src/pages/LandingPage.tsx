import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FieldTile as Tile } from '@study/shared';
import { api } from '../api/client';
import { FieldForm } from '../components/FieldForm';
import { FocusCard } from '../components/focus/FocusCard';
import { PaceBadge } from '../components/Pace';
import { StreakCard } from '../components/StreakCard';
import { Badge, Button, Empty, Spinner } from '../components/ui';
import { fmtDuration, liveSeconds } from '../lib/format';
import { useNow } from '../lib/useNow';

export function LandingPage({ name }: { name: string }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const fields = useQuery({ queryKey: ['fields', false], queryFn: () => api.fields(false) });
  const archived = useQuery({ queryKey: ['fields', true], queryFn: () => api.fields(true), enabled: showArchived });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dueTotal = fields.data?.reduce((s, f) => s + f.dueCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {greeting}, {name}
        </h1>
        <p className="text-sm text-slate-500">
          {dueTotal > 0 ? `${dueTotal} revision${dueTotal === 1 ? '' : 's'} due across your subjects.` : 'No revisions due right now. Keep learning.'}
        </p>
      </div>

      <FocusCard />

      <StreakCard />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Subjects</h2>
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Add subject
          </Button>
        </div>
        {fields.isPending ? (
          <Spinner />
        ) : !fields.data?.length ? (
          <Empty title="Add your first subject">
            A subject is what you're studying, like “DSA 2026” or “System Design”. Add topics inside it as you study them.
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.data.map((f) => (
              <FieldTile key={f.id} field={f} />
            ))}
          </div>
        )}
      </section>

      <section>
        <button className="rounded text-sm text-slate-500 transition-colors hover:text-indigo-700" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? '▾ Hide archived' : '▸ Show archived'}
        </button>
        {showArchived && (
          <div className="mt-3 space-y-2">
            {archived.isPending ? (
              <Spinner />
            ) : !archived.data?.length ? (
              <p className="text-sm text-slate-500">No archived subjects.</p>
            ) : (
              archived.data.map((f) => <ArchivedRow key={f.id} field={f} />)
            )}
          </div>
        )}
      </section>

      <FieldForm open={creating} onClose={() => setCreating(false)} onSaved={(s) => navigate(`/fields/${s.field.id}`)} />
    </div>
  );
}

function FieldTile({ field: f }: { field: Tile }) {
  const now = useNow(f.running);
  const state = f.running
    ? 'ring-2 ring-emerald-500 bg-emerald-50/40'
    : f.paused
      ? 'ring-2 ring-amber-300 bg-amber-50/40'
      : 'bg-surface hover:border-indigo-300';
  return (
    <Link
      to={`/fields/${f.id}`}
      className={`group relative block overflow-hidden rounded-2xl border border-slate-200 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 active:translate-y-0 ${state}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: f.color }} />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">{f.name}</h3>
        <div className="flex flex-wrap justify-end gap-1">
          {f.running && (
            <Badge tone="green">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" /> Running
            </Badge>
          )}
          {f.paused && <Badge tone="amber">⏸ Paused</Badge>}
        </div>
      </div>
      {f.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{f.description}</p>}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums">{fmtDuration(liveSeconds(f.totalSeconds, f.liveSince, now))}</p>
          <p className="text-xs text-slate-500">
            {f.completedCount}/{f.topicCount} topics done{f.masteredCount ? ` · ${f.masteredCount} mastered` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {f.pace && <PaceBadge pace={f.pace} />}
          {f.dueCount > 0 && <Badge tone="red">{f.dueCount} due</Badge>}
          {f.weakCount > 0 && <Badge tone="amber">{f.weakCount} weak</Badge>}
          {f.upcomingCount > 0 && <Badge>{f.upcomingCount} upcoming</Badge>}
        </div>
      </div>
    </Link>
  );
}

function ArchivedRow({ field }: { field: Tile }) {
  const qc = useQueryClient();
  const unarchive = useMutation({
    mutationFn: () => api.archiveField(field.id, false),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-surface px-4 py-3 transition-colors hover:border-indigo-300">
      <Link to={`/fields/${field.id}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-indigo-700">
        <span className="h-3 w-3 rounded-full" style={{ background: field.color }} />
        {field.name}
        <span className="text-xs font-normal text-slate-500">{fmtDuration(field.totalSeconds)}</span>
      </Link>
      <Button size="sm" onClick={() => unarchive.mutate()} disabled={unarchive.isPending}>
        Unarchive
      </Button>
    </div>
  );
}

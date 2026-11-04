import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { Button, ErrorText, FormField, inputCls, Spinner } from '../components/ui';
import { useToast } from '../components/Toasts';
import { fmtDate, fmtDuration } from '../lib/format';

/** F-01 / F-17: profile and data export. Settings editing arrives in Phase 2. */
export function ProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const streak = useQuery({ queryKey: ['streak'], queryFn: api.streak });
  const [name, setName] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.saveProfile(name ?? ''),
    onSuccess: (p) => {
      qc.setQueryData(['profile'], p);
      setName(null);
      toast('Profile saved', 'success');
    },
  });

  if (!profile.data) return <Spinner />;
  const p = profile.data;
  const s = settings.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700">
            {p.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">{p.name}</p>
            <p className="text-sm text-slate-500">Learning since {fmtDate(p.createdAt)}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Mini label="Total study time" value={fmtDuration(p.totalSeconds)} />
          <Mini label="Current streak" value={`${streak.data?.current ?? '–'} days`} />
          <Mini label="Longest streak" value={`${streak.data?.longest ?? '–'} days`} />
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name?.trim()) save.mutate();
          }}
        >
          <div className="flex-1">
            <FormField label="Display name">
              <input className={inputCls} value={name ?? p.name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </div>
          <Button type="submit" variant="primary" disabled={!name?.trim() || name === p.name || save.isPending}>
            Save
          </Button>
        </form>
        <ErrorText error={save.error} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Your data</h2>
        <p className="text-sm text-slate-600">
          Everything is stored locally in <code className="rounded bg-slate-100 px-1">data/study.db</code> on this computer. It never
          leaves your machine and is excluded from git. Export a JSON backup any time.
        </p>
        <a href="/api/export" download className="inline-flex rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          ⬇ Export all data (JSON)
        </a>
      </section>

      {s && (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Revision settings</h2>
          <Row label="Revision intervals" value={`${s.revisionIntervals.join(' → ')} days, then Mastered`} />
          <Row label="Daily revision cap" value={`${s.dailyRevisionCap} shown first`} />
          <Row label="Day starts at" value={`${String(s.dayStartHour).padStart(2, '0')}:00`} />
          <Row label="Long-session check" value={`after ${s.longSessionMinutes} min`} />
          <p className="pt-1 text-xs text-slate-400">Editable settings arrive in Phase 2.</p>
        </section>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

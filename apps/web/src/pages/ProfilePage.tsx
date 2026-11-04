import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { DEFAULT_INTERVALS, type Settings } from '@study/shared';
import { api } from '../api/client';
import { Button, ErrorText, FormField, inputCls, Modal, Spinner } from '../components/ui';
import { useToast } from '../components/Toasts';
import { fmtDate, fmtDuration } from '../lib/format';

/** F-01 profile, F-17/F-22 export + import, F-21 settings. */
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5">
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

      {settings.data && <SettingsForm key={JSON.stringify(settings.data)} settings={settings.data} />}

      <DataSection />
    </div>
  );
}

/** F-21: revision and timer settings. */
function SettingsForm({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [intervals, setIntervals] = useState(settings.revisionIntervals.join(', '));
  const [dayStartHour, setDayStartHour] = useState(settings.dayStartHour);
  const [cap, setCap] = useState(String(settings.dailyRevisionCap));
  const [longMin, setLongMin] = useState(String(settings.longSessionMinutes));

  const parsed = intervals
    .split(/[\s,→>-]+/)
    .filter(Boolean)
    .map(Number);
  const intervalsError =
    !parsed.length || parsed.some((n) => !Number.isInteger(n) || n < 1)
      ? 'Use whole numbers of days, e.g. 1, 3, 7, 16'
      : parsed.some((n, i) => i > 0 && n <= parsed[i - 1])
        ? 'Each interval must be longer than the previous one'
        : null;

  const save = useMutation({
    mutationFn: () =>
      api.saveSettings({
        revisionIntervals: parsed,
        dayStartHour,
        dailyRevisionCap: Number(cap),
        longSessionMinutes: Number(longMin),
      }),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      qc.invalidateQueries();
      toast('Settings saved', 'success');
    },
  });

  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5">
      <div>
        <h2 className="font-semibold text-slate-900">Revision settings</h2>
        <p className="text-sm text-slate-500">Changes apply to the next revision of each topic; past history is not rewritten.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!intervalsError) save.mutate();
        }}
      >
        <FormField label="Revision intervals (days)" hint={intervalsError ?? `${parsed.join(' → ')} days, then Mastered`}>
          <div className="flex gap-2">
            <input className={inputCls} value={intervals} onChange={(e) => setIntervals(e.target.value)} aria-invalid={!!intervalsError} />
            <Button onClick={() => setIntervals(DEFAULT_INTERVALS.join(', '))}>Default</Button>
          </div>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Day starts at" hint="Late-night study before this hour counts for the previous day.">
            <select className={inputCls} value={dayStartHour} onChange={(e) => setDayStartHour(Number(e.target.value))}>
              {hours.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00{h === 0 ? ' (midnight)' : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Daily revision cap" hint="Due revisions shown before “+N more”.">
            <input type="number" min={1} max={100} className={inputCls} value={cap} onChange={(e) => setCap(e.target.value)} />
          </FormField>
          <FormField label="Long-session check (min)" hint="Ask if a timer runs longer than this.">
            <input type="number" min={30} max={1440} step={15} className={inputCls} value={longMin} onChange={(e) => setLongMin(e.target.value)} />
          </FormField>
        </div>
        <ErrorText error={save.error} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={!!intervalsError || save.isPending}>
            Save settings
          </Button>
        </div>
      </form>
    </section>
  );
}

/** F-17 export + F-22 import. */
function DataSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown; summary: string } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const doImport = useMutation({
    mutationFn: () => api.importData(pending!.data),
    onSuccess: (r) => {
      setPending(null);
      qc.invalidateQueries();
      toast(`Imported ${r.imported.fields} subjects, ${r.imported.topics} topics, ${r.imported.activities} sessions`, 'success');
    },
  });

  const onFile = async (file: File) => {
    setReadError(null);
    try {
      const data = JSON.parse(await file.text());
      const d = data?.data;
      if (data?.app !== 'study-tracker' || !d) throw new Error('This is not a LearnLog export file.');
      setPending({
        name: file.name,
        data,
        summary: `${d.fields?.length ?? 0} subjects, ${d.topics?.length ?? 0} topics, ${d.activities?.length ?? 0} sessions${
          data.exportedAt ? `, exported ${fmtDate(data.exportedAt)}` : ''
        }`,
      });
    } catch (e) {
      setReadError(e instanceof SyntaxError ? 'That file is not valid JSON.' : (e as Error).message);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-5">
      <h2 className="font-semibold text-slate-900">Your data</h2>
      <p className="text-sm text-slate-600">
        Everything is stored locally in <code className="rounded bg-slate-100 px-1">data/study.db</code> on this computer. It never leaves your
        machine and is excluded from git.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/export" download className="inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:scale-[0.98]">
          ⬇ Export all data (JSON)
        </a>
        <Button onClick={() => fileInput.current?.click()}>⬆ Import from JSON…</Button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      <ErrorText error={readError} />

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Replace all data?"
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="danger" disabled={doImport.isPending} onClick={() => doImport.mutate()}>
              Replace everything
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Importing <strong>{pending?.name}</strong> ({pending?.summary}) will <strong>delete all current subjects, topics and history</strong> and
            replace them with the file's contents. This can't be undone.
          </p>
          <p>
            Tip: <a href="/api/export" download className="font-medium text-indigo-700 underline hover:text-indigo-500">export your current data</a> first.
          </p>
          <ErrorText error={doImport.error} />
        </div>
      </Modal>
    </section>
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

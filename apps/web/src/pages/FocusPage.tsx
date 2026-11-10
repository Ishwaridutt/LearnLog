import { useSearchParams } from 'react-router-dom';
import { FocusHistory } from '../components/focus/FocusHistory';
import { FocusTimer } from '../components/focus/FocusTimer';
import { SoundSettings } from '../components/focus/SoundSettings';

const TABS = [
  ['timer', 'Timer'],
  ['history', 'History'],
] as const;

/** Countdown (pomodoro) timer with alarm, plus a history of every session. */
export function FocusPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'timer';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Focus timer</h1>
        <p className="text-sm text-slate-500">Set a countdown, work until the alarm, then take a break.</p>
      </div>

      <nav className="flex gap-1 border-b border-slate-200" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'timer' ? {} : { tab: id }, { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-indigo-700'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'timer' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-surface p-6 lg:col-span-2">
            <FocusTimer />
          </section>
          <SoundSettings />
        </div>
      ) : (
        <FocusHistory />
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyRevision, diffDays, studyDay, type Grade, type TopicDetail } from '@study/shared';
import { api } from '../api/client';
import { fmtClock, fmtDay, liveSeconds } from '../lib/format';
import { useNow } from '../lib/useNow';
import { Button, Modal, Spinner } from './ui';
import { LinkList } from './LinkList';

const GRADE_META: Record<Grade, { label: string; hint: string; cls: string }> = {
  FORGOT: { label: 'Forgot', hint: 'Back to step 1', cls: 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800' },
  HARD: { label: 'Hard', hint: 'Repeat this step', cls: 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800' },
  GOOD: { label: 'Good', hint: 'Next step', cls: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800' },
};

export function RevisionModal({
  mode,
  topicId,
  onClose,
  onRequestGrade,
  onPause,
  onGrade,
  onCancel,
  grading,
}: {
  mode: 'recall' | 'grade';
  topicId: string;
  onClose: () => void;
  onRequestGrade: (activityId: string) => void;
  onPause: (activityId: string) => void;
  onGrade: (activityId: string, grade: Grade) => void;
  onCancel: (activityId: string) => void;
  grading: boolean;
}) {
  const topic = useQuery({ queryKey: ['topic', topicId], queryFn: () => api.topic(topicId) });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [revealed, setRevealed] = useState(false);
  const act = topic.data?.openActivity;
  const now = useNow(!!act?.liveSince);

  const t = topic.data;
  const title = mode === 'grade' ? 'How well did you recall it?' : 'Revision: answer from memory first';

  return (
    <Modal open onClose={onClose} title={title} width="max-w-xl">
      {!t || !settings.data ? (
        <Spinner />
      ) : mode === 'recall' ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{t.fieldName}</p>
            <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
          </div>
          {t.recallPrompt ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="mb-1 text-xs font-semibold text-indigo-700 uppercase">Recall prompt</p>
              <p className="whitespace-pre-wrap text-slate-800">{t.recallPrompt}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No recall prompt. Try to explain this topic out loud before looking at your notes.</p>
          )}
          {revealed ? (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              {t.description && <p className="text-sm whitespace-pre-wrap text-slate-700">{t.description}</p>}
              <LinkList links={t.links} />
              {!t.description && !t.links.length && <p className="text-sm text-slate-500">No notes or links saved.</p>}
            </div>
          ) : (
            <Button onClick={() => setRevealed(true)}>Reveal notes &amp; links</Button>
          )}
          {act && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="font-mono text-sm text-slate-600">
                {act.liveSince ? '● ' : '⏸ '}
                {fmtClock(liveSeconds(act.totalSeconds, act.liveSince, now))}
              </span>
              <div className="flex gap-2">
                <DiscardButton onConfirm={() => onCancel(act.id)} />
                {act.liveSince && <Button onClick={() => onPause(act.id)}>Pause</Button>}
                <Button variant="primary" onClick={() => onRequestGrade(act.id)}>
                  End &amp; grade
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <GradePicker topic={t} intervals={settings.data.revisionIntervals} dayStartHour={settings.data.dayStartHour} grading={grading} onGrade={onGrade} />
          {t.openActivity && (
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <DiscardButton onConfirm={() => onCancel(t.openActivity!.id)} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function GradePicker({
  topic,
  intervals,
  dayStartHour,
  grading,
  onGrade,
}: {
  topic: TopicDetail;
  intervals: number[];
  dayStartHour: number;
  grading: boolean;
  onGrade: (activityId: string, grade: Grade) => void;
}) {
  const act = topic.openActivity;
  if (!act) return <p className="text-sm text-slate-500">This revision is no longer in progress.</p>;
  const today = studyDay(new Date(), dayStartHour);
  const state = {
    status: topic.status,
    reviewStep: topic.reviewStep,
    nextDueDay: topic.nextDueDay,
    forgotCount: topic.forgotCount,
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-900">{topic.name}</span>
        {act.isEarly && <span className="ml-2 text-amber-700">Early revision: only “Forgot” changes the schedule.</span>}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {(['FORGOT', 'HARD', 'GOOD'] as const).map((g) => {
          const next = applyRevision(state, { grade: g, isEarly: act.isEarly, completedDay: today, intervals });
          const outcome =
            next.status === 'MASTERED'
              ? 'Mastered 🎉'
              : next.nextDueDay
                ? `${fmtDay(next.nextDueDay)} (+${diffDays(next.nextDueDay, today)}d)`
                : '—';
          return (
            <button
              key={g}
              disabled={grading}
              onClick={() => onGrade(act.id, g)}
              className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${GRADE_META[g].cls}`}
            >
              <span className="block text-base font-semibold">{GRADE_META[g].label}</span>
              <span className="block text-xs opacity-80">{act.isEarly && g !== 'FORGOT' ? 'Schedule unchanged' : GRADE_META[g].hint}</span>
              <span className="mt-2 block text-xs font-medium">Next: {outcome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Two-step discard so a stray click can't throw away a revision. */
function DiscardButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <Button variant={armed ? 'danger' : 'ghost'} title="Discard this revision without recording it" onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? 'Click again to discard' : 'Discard revision'}
    </Button>
  );
}

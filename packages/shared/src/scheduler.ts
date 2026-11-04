import { addDays, Day } from './days';

/** Spaced-repetition scheduler. Every rule here mirrors REQUIREMENTS §6. */

export const DEFAULT_INTERVALS = [1, 3, 7, 16, 35, 90, 180];

export const GRADES = ['FORGOT', 'HARD', 'GOOD'] as const;
export type Grade = (typeof GRADES)[number];

export const TOPIC_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'MASTERED'] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export interface ScheduleState {
  status: TopicStatus;
  /** Index into the interval ladder; `intervals.length` once Mastered. */
  reviewStep: number | null;
  nextDueDay: Day | null;
  forgotCount: number;
}

/** §6.2: learning finished on `completedDay` → first revision one interval later. */
export function scheduleAfterLearning(completedDay: Day, intervals: number[] = DEFAULT_INTERVALS) {
  return {
    status: 'COMPLETED' as TopicStatus,
    reviewStep: 0,
    nextDueDay: addDays(completedDay, intervals[0]),
  };
}

/** §6.3: a revision is early if the topic is Mastered or not yet due. */
export function isEarlyRevision(state: Pick<ScheduleState, 'status' | 'nextDueDay'>, today: Day): boolean {
  if (state.status === 'MASTERED') return true;
  return state.nextDueDay != null && today < state.nextDueDay;
}

/** §6.4: new schedule after a revision graded `grade`, finished on `completedDay`. */
export function applyRevision(
  state: ScheduleState,
  opts: { grade: Grade; isEarly: boolean; completedDay: Day; intervals?: number[] },
): ScheduleState {
  const intervals = opts.intervals ?? DEFAULT_INTERVALS;
  const L = intervals.length;
  const d = opts.completedDay;

  const reset = (): ScheduleState => ({
    status: 'COMPLETED',
    reviewStep: 0,
    nextDueDay: addDays(d, intervals[0]),
    forgotCount: state.forgotCount + 1,
  });

  if (opts.isEarly) {
    return opts.grade === 'FORGOT' ? reset() : { ...state };
  }

  const step = Math.min(state.reviewStep ?? 0, L - 1);
  switch (opts.grade) {
    case 'GOOD': {
      const s = step + 1;
      if (s >= L) return { ...state, status: 'MASTERED', reviewStep: L, nextDueDay: null };
      return { ...state, status: 'COMPLETED', reviewStep: s, nextDueDay: addDays(d, intervals[s]) };
    }
    case 'HARD':
      return { ...state, status: 'COMPLETED', reviewStep: step, nextDueDay: addDays(d, intervals[step]) };
    case 'FORGOT':
      return reset();
  }
}

/** §6.5: bring a Mastered topic back into the queue, due tomorrow. */
export function pullBack(state: ScheduleState, today: Day, intervals: number[] = DEFAULT_INTERVALS): ScheduleState {
  return { ...state, status: 'COMPLETED', reviewStep: 0, nextDueDay: addDays(today, intervals[0]) };
}

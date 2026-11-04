import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyRevision,
  computeStreaks,
  DEFAULT_INTERVALS,
  diffDays,
  heatLevel,
  isEarlyRevision,
  pullBack,
  scheduleAfterLearning,
  ScheduleState,
  studyDay,
} from '../src';

const DAY0 = '2026-01-01';
const day = (n: number) => addDays(DAY0, n);

const state = (over: Partial<ScheduleState> = {}): ScheduleState => ({
  status: 'COMPLETED',
  reviewStep: 0,
  nextDueDay: day(1),
  forgotCount: 0,
  ...over,
});

describe('days', () => {
  it('adds days across month/year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2027-01-02', '2026-12-30')).toBe(3);
  });

  it('studyDay honours the day-start hour', () => {
    const lateNight = new Date(2026, 0, 10, 1, 30); // 01:30 local on Jan 10
    expect(studyDay(lateNight, 0)).toBe('2026-01-10');
    expect(studyDay(lateNight, 4)).toBe('2026-01-09');
    expect(studyDay(new Date(2026, 0, 10, 4, 0), 4)).toBe('2026-01-10');
  });
});

describe('scheduler', () => {
  it('learning completion schedules the first revision tomorrow', () => {
    expect(scheduleAfterLearning(day(0))).toEqual({ status: 'COMPLETED', reviewStep: 0, nextDueDay: day(1) });
  });

  it("brief example: due day 10 at step 1, revised day 14 Good → next due day 21", () => {
    const s = state({ reviewStep: 1, nextDueDay: day(10) });
    const next = applyRevision(s, { grade: 'GOOD', isEarly: false, completedDay: day(14) });
    expect(next.reviewStep).toBe(2);
    expect(next.nextDueDay).toBe(day(21));
  });

  it('all-Good lifecycle follows 1,3,7,16,35,90,180 then Mastered', () => {
    const learned = scheduleAfterLearning(day(0));
    let s: ScheduleState = { ...learned, forgotCount: 0 };
    const gaps: number[] = [];
    let cursor = day(0);
    while (s.status !== 'MASTERED') {
      gaps.push(diffDays(s.nextDueDay!, cursor));
      cursor = s.nextDueDay!;
      s = applyRevision(s, { grade: 'GOOD', isEarly: false, completedDay: cursor });
    }
    expect(gaps).toEqual(DEFAULT_INTERVALS);
    expect(s).toMatchObject({ status: 'MASTERED', reviewStep: 7, nextDueDay: null });
  });

  it('Good never removes a topic before the final step', () => {
    let s = state({ reviewStep: 2, nextDueDay: day(5) });
    s = applyRevision(s, { grade: 'GOOD', isEarly: false, completedDay: day(5) });
    expect(s.status).toBe('COMPLETED');
    expect(s.nextDueDay).toBe(day(5 + 16));
  });

  it('Hard repeats the same step from the actual day', () => {
    const s = applyRevision(state({ reviewStep: 3, nextDueDay: day(20) }), {
      grade: 'HARD',
      isEarly: false,
      completedDay: day(25),
    });
    expect(s.reviewStep).toBe(3);
    expect(s.nextDueDay).toBe(day(25 + 16));
  });

  it('Forgot resets to step 0 and counts the lapse', () => {
    const s = applyRevision(state({ reviewStep: 4, nextDueDay: day(30), forgotCount: 1 }), {
      grade: 'FORGOT',
      isEarly: false,
      completedDay: day(40),
    });
    expect(s).toMatchObject({ reviewStep: 0, nextDueDay: day(41), forgotCount: 2, status: 'COMPLETED' });
  });

  it('early Good/Hard do not change the schedule', () => {
    const s = state({ reviewStep: 2, nextDueDay: day(10) });
    for (const grade of ['GOOD', 'HARD'] as const) {
      expect(applyRevision(s, { grade, isEarly: true, completedDay: day(4) })).toEqual(s);
    }
  });

  it('early Forgot resets, including from Mastered', () => {
    const mastered = state({ status: 'MASTERED', reviewStep: 7, nextDueDay: null });
    const s = applyRevision(mastered, { grade: 'FORGOT', isEarly: true, completedDay: day(3) });
    expect(s).toMatchObject({ status: 'COMPLETED', reviewStep: 0, nextDueDay: day(4), forgotCount: 1 });
  });

  it('isEarlyRevision', () => {
    expect(isEarlyRevision({ status: 'COMPLETED', nextDueDay: day(5) }, day(4))).toBe(true);
    expect(isEarlyRevision({ status: 'COMPLETED', nextDueDay: day(5) }, day(5))).toBe(false);
    expect(isEarlyRevision({ status: 'COMPLETED', nextDueDay: day(5) }, day(9))).toBe(false);
    expect(isEarlyRevision({ status: 'MASTERED', nextDueDay: null }, day(9))).toBe(true);
  });

  it('pull back restarts a Mastered topic tomorrow', () => {
    const s = pullBack(state({ status: 'MASTERED', reviewStep: 7, nextDueDay: null }), day(100));
    expect(s).toMatchObject({ status: 'COMPLETED', reviewStep: 0, nextDueDay: day(101) });
  });

  it('respects custom intervals', () => {
    const s = applyRevision(state({ reviewStep: 0 }), {
      grade: 'GOOD',
      isEarly: false,
      completedDay: day(1),
      intervals: [2, 5],
    });
    expect(s.nextDueDay).toBe(day(6));
    const done = applyRevision(s, { grade: 'GOOD', isEarly: false, completedDay: day(6), intervals: [2, 5] });
    expect(done.status).toBe('MASTERED');
  });
});

describe('streaks', () => {
  it('today not yet qualifying keeps the streak alive', () => {
    expect(computeStreaks([day(1), day(2), day(3)], day(4))).toEqual({
      current: 3,
      longest: 3,
      todayQualified: false,
    });
  });

  it('counts today when it qualifies', () => {
    expect(computeStreaks([day(2), day(3), day(4)], day(4)).current).toBe(3);
  });

  it('breaks when yesterday did not qualify', () => {
    expect(computeStreaks([day(1), day(2)], day(4)).current).toBe(0);
  });

  it('finds the longest run across gaps', () => {
    const days = [day(1), day(2), day(3), day(4), day(5), day(8), day(9)];
    expect(computeStreaks(days, day(9))).toEqual({ current: 2, longest: 5, todayQualified: true });
  });

  it('empty history', () => {
    expect(computeStreaks([], day(0))).toEqual({ current: 0, longest: 0, todayQualified: false });
  });

  it('heat levels', () => {
    expect([0, 1, 29, 30, 89, 90, 179, 180].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

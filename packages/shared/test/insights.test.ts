import { describe, expect, it } from 'vitest';
import { computePace, splitByStudyDay, weakness } from '../src';

describe('weakness (F-24)', () => {
  it('two Forgots in the last five graded revisions is weak', () => {
    expect(weakness(['GOOD', 'FORGOT', 'HARD', 'FORGOT'])).toEqual({ recentForgots: 2, recentGraded: 4, weak: true });
  });
  it('old Forgots age out after five newer grades', () => {
    expect(weakness(['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'FORGOT', 'FORGOT']).weak).toBe(false);
  });
  it('a single Forgot is not weak', () => {
    expect(weakness(['FORGOT']).weak).toBe(false);
  });
});

describe('computePace (F-25)', () => {
  const base = { target: 30, startDay: '2026-11-01', targetDate: '2026-11-30', baseline: 0 };
  it('on track along the straight line', () => {
    const p = computePace({ ...base, completed: 15, today: '2026-11-15' });
    expect(p.status).toBe('on_track');
    expect(p.expected).toBeCloseTo(14.5, 1);
  });
  it('behind and ahead with one topic of slack', () => {
    expect(computePace({ ...base, completed: 10, today: '2026-11-15' }).status).toBe('behind');
    expect(computePace({ ...base, completed: 20, today: '2026-11-15' }).status).toBe('ahead');
  });
  it('starts from the baseline, not zero', () => {
    const p = computePace({ ...base, baseline: 10, completed: 10, today: '2026-11-01' });
    expect(p.expected).toBe(10);
    expect(p.status).toBe('on_track');
  });
  it('per-day need counts today', () => {
    expect(computePace({ ...base, completed: 20, today: '2026-11-21' }).perDayNeeded).toBe(1);
  });
  it('done and overdue', () => {
    expect(computePace({ ...base, completed: 30, today: '2026-11-10' }).status).toBe('done');
    const late = computePace({ ...base, completed: 5, today: '2026-12-02' });
    expect(late.status).toBe('overdue');
    expect(late.perDayNeeded).toBeNull();
  });
});

describe('splitByStudyDay (midnight fix)', () => {
  it('splits a session that crosses midnight', () => {
    const parts = splitByStudyDay(new Date(2026, 10, 4, 23, 30), new Date(2026, 10, 5, 1, 0));
    expect(parts).toEqual([
      { day: '2026-11-04', seconds: 30 * 60 },
      { day: '2026-11-05', seconds: 60 * 60 },
    ]);
  });
  it('uses the day-start hour as the boundary', () => {
    const parts = splitByStudyDay(new Date(2026, 10, 4, 23, 30), new Date(2026, 10, 5, 1, 0), 4);
    expect(parts).toEqual([{ day: '2026-11-04', seconds: 90 * 60 }]);
    const late = splitByStudyDay(new Date(2026, 10, 5, 3, 0), new Date(2026, 10, 5, 5, 0), 4);
    expect(late).toEqual([
      { day: '2026-11-04', seconds: 60 * 60 },
      { day: '2026-11-05', seconds: 60 * 60 },
    ]);
  });
  it('a multi-day span covers every day in between', () => {
    const parts = splitByStudyDay(new Date(2026, 10, 1, 12), new Date(2026, 10, 3, 12));
    expect(parts.map((p) => [p.day, p.seconds / 3600])).toEqual([
      ['2026-11-01', 12],
      ['2026-11-02', 24],
      ['2026-11-03', 12],
    ]);
  });
  it('empty span', () => {
    expect(splitByStudyDay(new Date(2026, 0, 1), new Date(2026, 0, 1))).toEqual([]);
  });
});

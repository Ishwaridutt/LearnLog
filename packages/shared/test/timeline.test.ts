import { describe, expect, it } from 'vitest';
import { focusSpan, timelineQuerySchema } from '../src';

const at = (hm: string) => new Date(`2026-11-12T${hm}:00`);

describe('focusSpan', () => {
  it('places a finished unpaused session on its real span', () => {
    const s = focusSpan({ status: 'COMPLETED', usedSeconds: 1800, plannedSeconds: 1800, runningSince: null, startedAt: at('09:00'), endedAt: at('09:30') }, at('12:00'));
    expect(s).toEqual({ start: at('09:00'), end: at('09:30') });
  });

  it('lays used time back from the end when the session was paused', () => {
    // Started 09:00, stopped 10:00, but only 20 min actually used.
    const s = focusSpan({ status: 'STOPPED', usedSeconds: 1200, plannedSeconds: 3600, runningSince: null, startedAt: at('09:00'), endedAt: at('10:00') }, at('12:00'));
    expect(s).toEqual({ start: at('09:40'), end: at('10:00') });
  });

  it('runs to now while running, and never past the countdown end', () => {
    const base = { status: 'RUNNING', usedSeconds: 600, plannedSeconds: 1800, runningSince: at('09:10'), startedAt: at('09:00'), endedAt: null };
    expect(focusSpan(base, at('09:20'))).toEqual({ start: at('09:00'), end: at('09:20') });
    // Countdown ends 09:30 (20 min left at 09:10) even if nobody has settled it yet.
    expect(focusSpan(base, at('11:00'))).toEqual({ start: at('09:00'), end: at('09:30') });
  });

  it('puts a paused session at its start', () => {
    const s = focusSpan({ status: 'PAUSED', usedSeconds: 300, plannedSeconds: 1800, runningSince: null, startedAt: at('09:00'), endedAt: null }, at('12:00'));
    expect(s).toEqual({ start: at('09:00'), end: at('09:05') });
  });

  it('returns null when nothing was used', () => {
    expect(focusSpan({ status: 'STOPPED', usedSeconds: 0, plannedSeconds: 60, runningSince: null, startedAt: at('09:00'), endedAt: at('09:00') }, at('12:00'))).toBeNull();
  });
});

describe('timelineQuerySchema', () => {
  it('rejects reversed or oversized ranges', () => {
    expect(timelineQuerySchema.safeParse({ from: '2026-11-12', to: '2026-11-01' }).success).toBe(false);
    expect(timelineQuerySchema.safeParse({ from: '2024-01-01', to: '2026-11-01' }).success).toBe(false);
    expect(timelineQuerySchema.safeParse({ from: '2026-10-01', to: '2026-11-01' }).success).toBe(true);
  });
});

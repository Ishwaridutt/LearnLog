import { describe, expect, it } from 'vitest';
import { focusEndsAt, focusRemaining, focusUsed } from '../src';

const start = new Date('2026-11-11T10:00:00Z');
const at = (min: number) => new Date(start.getTime() + min * 60_000);

describe('focus countdown maths', () => {
  it('counts live time while running', () => {
    const s = { plannedSeconds: 30 * 60, usedSeconds: 0, runningSince: start };
    expect(focusUsed(s, at(10))).toBe(600);
    expect(focusRemaining(s, at(10))).toBe(1200);
    expect(focusEndsAt(s)).toEqual(at(30));
  });

  it('adds earlier stretches after a pause and resume', () => {
    const s = { plannedSeconds: 30 * 60, usedSeconds: 600, runningSince: at(20) };
    expect(focusRemaining(s, at(25))).toBe(900);
    expect(focusEndsAt(s)).toEqual(at(40));
  });

  it('freezes while paused and never goes below zero', () => {
    const paused = { plannedSeconds: 600, usedSeconds: 300, runningSince: null };
    expect(focusRemaining(paused, at(500))).toBe(300);
    expect(focusEndsAt(paused)).toBeNull();
    expect(focusRemaining({ plannedSeconds: 60, usedSeconds: 0, runningSince: start }, at(5))).toBe(0);
  });
});

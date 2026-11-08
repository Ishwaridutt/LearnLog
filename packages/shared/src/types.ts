import type { Day } from './days';
import type { Pace } from './insights';
import type { Grade, TopicStatus } from './scheduler';

/** API response shapes. Timestamps are ISO strings. */

export type ActivityType = 'LEARNING' | 'REVISION';
export type ActivityStatus = 'IN_PROGRESS' | 'COMPLETED';
export type CalendarView = 'HEATMAP' | 'TICKS';

export interface Profile {
  name: string;
  createdAt: string;
  totalSeconds: number;
}

export interface Settings {
  revisionIntervals: number[];
  dayStartHour: number;
  dailyRevisionCap: number;
  longSessionMinutes: number;
  calendarView: CalendarView;
}

export interface FieldTile {
  id: string;
  name: string;
  description: string | null;
  color: string;
  archivedAt: string | null;
  createdAt: string;
  /** Closed seconds; add live time from `liveSince` on the client. */
  totalSeconds: number;
  liveSince: string | null;
  topicCount: number;
  completedCount: number;
  masteredCount: number;
  running: boolean;
  paused: boolean;
  dueCount: number;
  upcomingCount: number;
  /** F-24: topics currently weak (≥2 Forgot in their last 5 graded revisions). */
  weakCount: number;
  /** F-25: null when no target is set. */
  pace: Pace | null;
  targetTopicCount: number | null;
  targetDate: Day | null;
  /** F-26: this field's own ladder, or null when it uses the global one. */
  customIntervals: number[] | null;
}

export interface FieldSummary {
  field: FieldTile;
  today: Day;
  learningSeconds: number;
  revisionSeconds: number;
  learningLiveSince: string | null;
  revisionLiveSince: string | null;
  counts: { notStarted: number; inProgress: number; completed: number; mastered: number };
  /** Good ÷ graded on-schedule revisions, 0–1; null if none. */
  recallRate: number | null;
  tabs: { ongoing: number; all: number; completed: number; revised: number; due: number; upcoming: number; weak: number };
  /** Effective revision ladder for this field (custom or global). */
  intervals: number[];
}

export interface Link {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
}

export interface Activity {
  id: string;
  topicId: string;
  type: ActivityType;
  status: ActivityStatus;
  grade: Grade | null;
  isEarly: boolean;
  stepAtStart: number | null;
  dueDayAtStart: Day | null;
  startedAt: string;
  completedAt: string | null;
  completedDay: Day | null;
  totalSeconds: number;
  /** Start of the running segment if this activity is the one running. */
  liveSince: string | null;
}

export interface Segment {
  id: string;
  startedAt: string;
  endedAt: string | null;
  edited: boolean;
}

export interface Topic {
  id: string;
  fieldId: string;
  name: string;
  description: string | null;
  recallPrompt: string | null;
  status: TopicStatus;
  reviewStep: number | null;
  nextDueDay: Day | null;
  startedAt: string | null;
  completedAt: string | null;
  lastRevisedAt: string | null;
  revisionCount: number;
  forgotCount: number;
  /** "No revision needed": completed but never scheduled for revision. */
  skipRevision: boolean;
  archivedAt: string | null;
  createdAt: string;
  links: Link[];
  timeSeconds: number;
  liveSince: string | null;
  openActivity: Activity | null;
}

export interface TopicDetail extends Topic {
  fieldName: string;
  /** Effective revision ladder for this topic's field. */
  intervals: number[];
  activities: (Activity & { segments: Segment[] })[];
}

export interface RevisionLists {
  today: Day;
  cap: number;
  intervals: number[];
  dueNow: Topic[];
  upcoming: Topic[];
}

/** F-24 */
export interface WeakTopic extends Topic {
  recentForgots: number;
  recentGraded: number;
  lastForgotAt: string | null;
  /** Good ÷ all graded revisions of this topic, 0–1. */
  recallRate: number | null;
}

export interface HistoryRow extends Activity {
  topicName: string;
  topicArchived: boolean;
}

export interface TimerActivity extends Activity {
  topicName: string;
  fieldId: string;
  fieldName: string;
  segmentId: string | null;
}

export interface TimerState {
  running: TimerActivity | null;
  paused: TimerActivity[];
}

export interface ActionResult {
  autoPaused: { topicName: string; totalSeconds: number } | null;
}

export interface StreakInfo {
  today: Day;
  current: number;
  longest: number;
  todayQualified: boolean;
}

export interface CalendarDay {
  day: Day;
  minutes: number;
  learnings: number;
  revisions: number;
}

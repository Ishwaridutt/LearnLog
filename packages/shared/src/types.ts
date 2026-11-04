import type { Day } from './days';
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
  tabs: { ongoing: number; all: number; revised: number; due: number; upcoming: number };
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
  archivedAt: string | null;
  createdAt: string;
  links: Link[];
  timeSeconds: number;
  liveSince: string | null;
  openActivity: Activity | null;
}

export interface TopicDetail extends Topic {
  fieldName: string;
  activities: (Activity & { segments: Segment[] })[];
}

export interface RevisionLists {
  today: Day;
  cap: number;
  dueNow: Topic[];
  upcoming: Topic[];
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

import type { Activity as DbActivity, Topic as DbTopic, TopicLink, TimeSegment } from '@prisma/client';
import type { Activity, Grade, Link, Segment, Topic, TopicStatus } from '@study/shared';

/** The single open segment, if any, in the shape mappers need. */
export interface OpenSegment {
  id: string;
  activityId: string;
  startedAt: Date;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toActivity(a: DbActivity, open: OpenSegment | null): Activity {
  return {
    id: a.id,
    topicId: a.topicId,
    type: a.type as Activity['type'],
    status: a.status as Activity['status'],
    grade: (a.grade as Grade | null) ?? null,
    isEarly: a.isEarly,
    stepAtStart: a.stepAtStart,
    dueDayAtStart: a.dueDayAtStart,
    startedAt: a.startedAt.toISOString(),
    completedAt: iso(a.completedAt),
    completedDay: a.completedDay,
    totalSeconds: a.totalSeconds,
    liveSince: open && open.activityId === a.id ? open.startedAt.toISOString() : null,
  };
}

export function toSegment(s: TimeSegment): Segment {
  return { id: s.id, startedAt: s.startedAt.toISOString(), endedAt: iso(s.endedAt), edited: s.edited };
}

export function toLink(l: TopicLink): Link {
  return { id: l.id, label: l.label, url: l.url, sortOrder: l.sortOrder };
}

export type TopicWithRelations = DbTopic & { links: TopicLink[]; activities: DbActivity[] };

export function toTopic(t: TopicWithRelations, open: OpenSegment | null): Topic {
  const openAct = t.activities.find((a) => a.status === 'IN_PROGRESS') ?? null;
  const live = open && t.activities.some((a) => a.id === open.activityId) ? open.startedAt.toISOString() : null;
  return {
    id: t.id,
    fieldId: t.fieldId,
    name: t.name,
    description: t.description,
    recallPrompt: t.recallPrompt,
    status: t.status as TopicStatus,
    reviewStep: t.reviewStep,
    nextDueDay: t.nextDueDay,
    startedAt: iso(t.startedAt),
    completedAt: iso(t.completedAt),
    lastRevisedAt: iso(t.lastRevisedAt),
    revisionCount: t.revisionCount,
    forgotCount: t.forgotCount,
    skipRevision: t.skipRevision,
    archivedAt: iso(t.archivedAt),
    createdAt: t.createdAt.toISOString(),
    links: [...t.links].sort((a, b) => a.sortOrder - b.sortOrder).map(toLink),
    timeSeconds: t.activities.reduce((s, a) => s + a.totalSeconds, 0),
    liveSince: live,
    openActivity: openAct ? toActivity(openAct, open) : null,
  };
}

/** Prisma include for topics rendered with `toTopic`. */
export const topicInclude = { links: true, activities: true } as const;

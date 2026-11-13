import { z } from 'zod';
import { GRADES, TOPIC_STATUSES } from './scheduler';

/** Request validation schemas, shared by the API (validation) and the web app (forms). */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Preset subject colours, in hue order. Any #rrggbb is accepted; these are the quick picks. */
export const FIELD_PALETTE: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Sky', hex: '#0ea5e9' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Brown', hex: '#a16207' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Stone', hex: '#78716c' },
];
export const FIELD_COLORS = FIELD_PALETTE.map((c) => c.hex);

export const profileSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(60) });
export type ProfileInput = z.infer<typeof profileSchema>;

/** A revision ladder: 1–20 whole days, strictly increasing. */
export const intervalsSchema = z
  .array(z.number().int().min(1).max(3650))
  .min(1)
  .max(20)
  .refine((a) => a.every((v, i) => i === 0 || v > a[i - 1]), 'Intervals must increase');

const dayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const settingsSchema = z
  .object({
    revisionIntervals: intervalsSchema,
    dayStartHour: z.number().int().min(0).max(23),
    dailyRevisionCap: z.number().int().min(1).max(100),
    longSessionMinutes: z.number().int().min(30).max(1440),
    calendarView: z.enum(['HEATMAP', 'TICKS']),
  })
  .partial();
export type SettingsInput = z.infer<typeof settingsSchema>;

export const fieldCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: optionalText(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid colour'),
  /** F-26: custom ladder for this field; null = use the global setting. */
  revisionIntervals: intervalsSchema.nullish(),
  /** F-25: optional target; both or neither (checked by the API). null clears it. */
  targetTopicCount: z.number().int().min(1).max(100_000).nullish(),
  targetDate: dayStr.nullish(),
});
export const fieldUpdateSchema = fieldCreateSchema.partial();
export type FieldCreateInput = z.input<typeof fieldCreateSchema>;
export type FieldUpdateInput = z.input<typeof fieldUpdateSchema>;

export const linkSchema = z.object({
  label: z.string().trim().min(1, 'Link label is required').max(40),
  url: z.url({ protocol: /^https?$/, message: 'Link must be a valid http(s) URL' }),
});
export type LinkInput = z.infer<typeof linkSchema>;

export const topicCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: optionalText(10_000),
  recallPrompt: optionalText(2000),
  links: z.array(linkSchema).max(30).optional(),
  /** "No revision needed": the topic never enters the revision queue. */
  skipRevision: z.boolean().optional(),
});
export const topicUpdateSchema = topicCreateSchema.partial();
export type TopicCreateInput = z.input<typeof topicCreateSchema>;
export type TopicUpdateInput = z.input<typeof topicUpdateSchema>;

/** Move a topic (with all its sessions and schedule) to another subject. */
export const topicMoveSchema = z.object({ fieldId: z.string().min(1) });
export type TopicMoveInput = z.infer<typeof topicMoveSchema>;

export const endActivitySchema = z.object({ grade: z.enum(GRADES).optional() });

export const segmentEndSchema = z.object({ endedAt: z.iso.datetime({ offset: true }) });

export const segmentEditSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
});

/** F-22: shape of an export file accepted by import. Row contents are checked by the database. */
export const importSchema = z.object({
  app: z.literal('study-tracker', { message: 'Not a LearnLog export file' }),
  schemaVersion: z.literal(1, { message: 'Unsupported export version' }),
  data: z.object({
    profile: z.array(z.record(z.string(), z.unknown())).max(1),
    settings: z.array(z.record(z.string(), z.unknown())).max(1),
    fields: z.array(z.record(z.string(), z.unknown())),
    topics: z.array(z.record(z.string(), z.unknown())),
    links: z.array(z.record(z.string(), z.unknown())),
    activities: z.array(z.record(z.string(), z.unknown())),
    segments: z.array(z.record(z.string(), z.unknown())),
    // Added with the focus timer; older backups have none.
    focusSessions: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});
export type ImportFile = z.infer<typeof importSchema>;

export const topicListQuerySchema = z.object({
  tab: z.enum(['all', 'ongoing', 'completed', 'revised']).default('all'),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['createdAt', 'completedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(TOPIC_STATUSES).optional(),
});
export type TopicListQuery = z.infer<typeof topicListQuerySchema>;

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const historyQuerySchema = z.object({
  type: z.enum(['LEARNING', 'REVISION']).optional(),
  grade: z.enum(GRADES).optional(),
  from: dayString.optional(),
  to: dayString.optional(),
  q: z.string().trim().max(200).optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const calendarQuerySchema = z.object({ from: dayString.optional(), to: dayString.optional() });

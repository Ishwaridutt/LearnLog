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

export const FIELD_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

export const profileSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(60) });
export type ProfileInput = z.infer<typeof profileSchema>;

export const settingsSchema = z
  .object({
    revisionIntervals: z
      .array(z.number().int().min(1).max(3650))
      .min(1)
      .max(20)
      .refine((a) => a.every((v, i) => i === 0 || v > a[i - 1]), 'Intervals must increase'),
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
});
export const topicUpdateSchema = topicCreateSchema.partial();
export type TopicCreateInput = z.input<typeof topicCreateSchema>;
export type TopicUpdateInput = z.input<typeof topicUpdateSchema>;

export const endActivitySchema = z.object({ grade: z.enum(GRADES).optional() });

export const segmentEndSchema = z.object({ endedAt: z.iso.datetime({ offset: true }) });

export const topicListQuerySchema = z.object({
  tab: z.enum(['all', 'ongoing', 'revised']).default('all'),
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

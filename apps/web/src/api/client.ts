import type {
  ActionResult,
  CalendarDay,
  FieldCreateInput,
  FieldSummary,
  FieldTile,
  FieldUpdateInput,
  Grade,
  HistoryQuery,
  HistoryRow,
  Profile,
  RevisionLists,
  Settings,
  SettingsInput,
  StreakInfo,
  TimerState,
  Topic,
  TopicCreateInput,
  TopicDetail,
  TopicListQuery,
  TopicUpdateInput,
} from '@study/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = data?.message ?? res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return data as T;
}

const qs = (params: object) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  profile: () => req<Profile>('GET', '/profile'),
  saveProfile: (name: string) => req<Profile>('PUT', '/profile', { name }),
  settings: () => req<Settings>('GET', '/settings'),
  saveSettings: (s: SettingsInput) => req<Settings>('PUT', '/settings', s),

  fields: (archived = false) => req<FieldTile[]>('GET', `/fields${archived ? '?archived=true' : ''}`),
  createField: (input: FieldCreateInput) => req<FieldSummary>('POST', '/fields', input),
  fieldSummary: (id: string) => req<FieldSummary>('GET', `/fields/${id}/summary`),
  updateField: (id: string, input: FieldUpdateInput) => req<FieldSummary>('PATCH', `/fields/${id}`, input),
  archiveField: (id: string, archived: boolean) =>
    req<FieldSummary>('POST', `/fields/${id}/${archived ? 'archive' : 'unarchive'}`),
  deleteField: (id: string) => req<void>('DELETE', `/fields/${id}`),

  topics: (fieldId: string, q: Partial<TopicListQuery>) => req<Topic[]>('GET', `/fields/${fieldId}/topics${qs(q)}`),
  revisions: (fieldId: string) => req<RevisionLists>('GET', `/fields/${fieldId}/revisions`),
  history: (fieldId: string, q: HistoryQuery) => req<HistoryRow[]>('GET', `/fields/${fieldId}/history${qs(q)}`),
  createTopic: (fieldId: string, input: TopicCreateInput) => req<TopicDetail>('POST', `/fields/${fieldId}/topics`, input),
  topic: (id: string) => req<TopicDetail>('GET', `/topics/${id}`),
  updateTopic: (id: string, input: TopicUpdateInput) => req<TopicDetail>('PATCH', `/topics/${id}`, input),
  archiveTopic: (id: string, archived: boolean) =>
    req<TopicDetail>('POST', `/topics/${id}/${archived ? 'archive' : 'unarchive'}`),
  pullBack: (id: string) => req<TopicDetail>('POST', `/topics/${id}/pull-back`),
  deleteTopic: (id: string) => req<void>('DELETE', `/topics/${id}`),

  timer: () => req<TimerState>('GET', '/timer/current'),
  startLearning: (topicId: string) => req<ActionResult>('POST', `/topics/${topicId}/learning/start`),
  startRevision: (topicId: string) =>
    req<ActionResult & { activityId: string }>('POST', `/topics/${topicId}/revisions/start`),
  pause: (activityId: string) => req<ActionResult>('POST', `/activities/${activityId}/pause`),
  resume: (activityId: string) => req<ActionResult>('POST', `/activities/${activityId}/resume`),
  end: (activityId: string, grade?: Grade) => req<ActionResult>('POST', `/activities/${activityId}/end`, { grade }),
  endSegment: (segmentId: string, endedAt: string) =>
    req<ActionResult>('POST', `/segments/${segmentId}/end`, { endedAt }),
  editSegment: (segmentId: string, startedAt: string, endedAt: string) =>
    req<ActionResult>('PATCH', `/segments/${segmentId}`, { startedAt, endedAt }),
  deleteSegment: (segmentId: string) => req<ActionResult>('DELETE', `/segments/${segmentId}`),
  cancelRevision: (activityId: string) => req<ActionResult>('DELETE', `/activities/${activityId}`),
  importData: (file: unknown) =>
    req<{ imported: { fields: number; topics: number; activities: number } }>('POST', '/import', file),

  streak: () => req<StreakInfo>('GET', '/stats/streak'),
  calendar: () => req<CalendarDay[]>('GET', '/stats/calendar'),
};

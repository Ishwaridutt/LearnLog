import type { TopicStatus } from '@study/shared';
import { Badge } from './ui';

const META: Record<TopicStatus, { label: string; tone: 'slate' | 'sky' | 'green' | 'violet' }> = {
  NOT_STARTED: { label: 'Not started', tone: 'slate' },
  IN_PROGRESS: { label: 'In progress', tone: 'sky' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  MASTERED: { label: 'Mastered ★', tone: 'violet' },
};

export function StatusBadge({ status }: { status: TopicStatus }) {
  return <Badge tone={META[status].tone}>{META[status].label}</Badge>;
}

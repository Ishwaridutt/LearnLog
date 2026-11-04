import { useQuery } from '@tanstack/react-query';
import { DEFAULT_INTERVALS } from '@study/shared';
import { api } from '../api/client';

/** Number of steps in the revision ladder. */
export function useSettingsSteps(): number {
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  return settings.data?.revisionIntervals.length ?? DEFAULT_INTERVALS.length;
}

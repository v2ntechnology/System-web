import type { ChecklistSummary } from '@/management/types';

import { mockChecklistSummary } from '@/management/mocks/checklists';

/** Fronteira única de checklists. */
export function getChecklistSummary(): Promise<ChecklistSummary> {
  return mockChecklistSummary();
}

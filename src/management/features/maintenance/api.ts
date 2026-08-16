import type { MaintenanceSummary } from '@/management/types';

import { mockMaintenanceSummary } from '@/management/mocks/maintenance';

/** Fronteira única de manutenção. */
export function getMaintenanceSummary(): Promise<MaintenanceSummary> {
  return mockMaintenanceSummary();
}

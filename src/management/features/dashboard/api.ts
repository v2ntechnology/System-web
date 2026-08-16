import type { DashboardSummary } from '@/management/types';

import { mockDashboardSummary } from '@/management/mocks/dashboard';

/**
 * Fronteira única entre as telas do dashboard e o transporte de dados.
 * Ver `features/auth/api.ts` para a nota sobre a troca pelo cliente do OpenAPI.
 */
export function getDashboardSummary(): Promise<DashboardSummary> {
  return mockDashboardSummary();
}

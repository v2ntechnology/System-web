import type { AnalyticsPeriod, CostsSummary } from '@/management/types';

import { mockCostsSummary } from '@/management/mocks/costs';

/**
 * Fronteira única de custos.
 *
 * No backend, estas agregações NUNCA são calculadas em tempo de requisição:
 * vêm das tabelas de sumário e dos continuous aggregates (DAT-06), porque o
 * RNF-001 (< 2s no p95) não sobrevive a um cálculo ao vivo.
 */
export function getCostsSummary(period: AnalyticsPeriod): Promise<CostsSummary> {
  return mockCostsSummary(period);
}

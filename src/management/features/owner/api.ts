import type {
  AnalyticsPeriod,
  DriverHighlight,
  FleetProfitability,
  IncomeStatement,
  OwnerApproval,
  OwnerSummary,
  RankingPeriod,
} from '@/management/types';

import {
  mockDecideApproval,
  mockDriverHighlights,
  mockFleetProfitability,
  mockIncomeStatement,
  mockOwnerApprovals,
  mockOwnerSummary,
  type DecisionPayload,
} from '@/management/mocks/owner';

/**
 * Fronteira única entre as telas da visão do dono e o transporte de dados.
 *
 * Na integração com o backend Java/Spring só o corpo destas funções muda —
 * nenhuma tela é tocada. Ver `features/auth/api.ts` para a nota completa.
 */

export function getOwnerSummary(period: AnalyticsPeriod): Promise<OwnerSummary> {
  return mockOwnerSummary(period);
}

export function getIncomeStatement(period: AnalyticsPeriod): Promise<IncomeStatement> {
  return mockIncomeStatement(period);
}

export function getFleetProfitability(period: AnalyticsPeriod): Promise<FleetProfitability[]> {
  return mockFleetProfitability(period);
}

export function getDriverHighlights(period: RankingPeriod): Promise<DriverHighlight[]> {
  return mockDriverHighlights(period);
}

export function getOwnerApprovals(): Promise<OwnerApproval[]> {
  return mockOwnerApprovals();
}

export function decideApproval(payload: DecisionPayload): Promise<OwnerApproval> {
  return mockDecideApproval(payload);
}

export type { DecisionPayload };

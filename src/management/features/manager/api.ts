import type {
  AnalyticsPeriod,
  Anomaly,
  Diagnosis,
  ManagerOverview,
  ReleaseRequest,
} from '@/management/types';

import { env } from '@/app/environment';
import { fetchOperations } from '@/management/lib/fleet-api';

import {
  mockAnomalies,
  mockDecideRelease,
  mockDiagnoses,
  mockManagerOverview,
  mockReleases,
  mockSaveDiagnosis,
  type DiagnosisPayload,
  type ReleaseDecisionPayload,
} from '@/management/mocks/manager';

/**
 * Fronteira única entre as telas do gestor e o transporte de dados.
 *
 * Na integração com o backend Java/Spring só o corpo destas funções muda —
 * nenhuma tela é tocada. Ver `features/auth/api.ts` para a nota completa.
 */

/**
 * Prontidão da operação.
 *
 * O período do seletor vira janela em dias: o gestor pensa em semana e mês, e o
 * backend só entende dias.
 */
const DIAS_POR_PERIODO: Record<AnalyticsPeriod, number> = {
  '30D': 30,
  '3M': 90,
  '6M': 180,
  '12M': 365,
};

export function getManagerOverview(period: AnalyticsPeriod): Promise<ManagerOverview> {
  return env.enableMocks
    ? mockManagerOverview(period)
    : fetchOperations(DIAS_POR_PERIODO[period] ?? 7);
}

export function getReleases(): Promise<ReleaseRequest[]> {
  return mockReleases();
}

export function decideRelease(payload: ReleaseDecisionPayload): Promise<ReleaseRequest> {
  return mockDecideRelease(payload);
}

export function getAnomalies(): Promise<Anomaly[]> {
  return mockAnomalies();
}

export function getDiagnoses(): Promise<Diagnosis[]> {
  return mockDiagnoses();
}

export function saveDiagnosis(payload: DiagnosisPayload): Promise<Diagnosis> {
  return mockSaveDiagnosis(payload);
}

export type { DiagnosisPayload, ReleaseDecisionPayload };

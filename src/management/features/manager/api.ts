import type {
  AnalyticsPeriod,
  Anomaly,
  Diagnosis,
  ManagerOverview,
  ReleaseRequest,
} from '@/management/types';

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

export function getManagerOverview(period: AnalyticsPeriod): Promise<ManagerOverview> {
  return mockManagerOverview(period);
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

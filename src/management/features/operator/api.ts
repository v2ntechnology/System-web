import type {
  AnalyticsPeriod,
  LaunchEntry,
  OperatorOverview,
  TriageFill,
  YardVehicle,
} from '@/management/types';

import {
  mockCreateEntry,
  mockEntries,
  mockOperatorOverview,
  mockTriage,
  mockTriageDecision,
  mockYard,
  type EntryPayload,
  type TriagePayload,
} from '@/management/mocks/operator';

/**
 * Fronteira única entre as telas do operador e o transporte de dados.
 *
 * Na integração com o backend Java/Spring só o corpo destas funções muda —
 * nenhuma tela é tocada. Ver `features/auth/api.ts` para a nota completa.
 */

export function getOperatorOverview(
  period: AnalyticsPeriod,
  canSeeFinancials: boolean,
): Promise<OperatorOverview> {
  return mockOperatorOverview(period, canSeeFinancials);
}

export function getEntries(): Promise<LaunchEntry[]> {
  return mockEntries();
}

export function createEntry(payload: EntryPayload): Promise<LaunchEntry> {
  return mockCreateEntry(payload);
}

export function getTriage(): Promise<TriageFill[]> {
  return mockTriage();
}

export function decideTriage(payload: TriagePayload): Promise<TriageFill> {
  return mockTriageDecision(payload);
}

export function getYard(): Promise<YardVehicle[]> {
  return mockYard();
}

export type { EntryPayload, TriagePayload };

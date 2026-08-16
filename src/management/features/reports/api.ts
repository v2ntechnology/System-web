import type {
  ReportDefinition,
  AnalyticsPeriod,
  ReportPreview,
  ReportRun,
  ReportSchedule,
} from '@/management/types';

import {
  mockReportIndicators,
  mockReportPreview,
  mockReportRuns,
  mockReportSchedules,
  mockReports,
} from '@/management/mocks/reports';

/** Fronteira única dos relatórios. */
export function getReports(): Promise<ReportDefinition[]> {
  return mockReports();
}

/** `GET /v1/reports/indicators?period=` — agregação pré-calculada (DAT-06). */
export function getReportIndicators(period: AnalyticsPeriod) {
  return mockReportIndicators(period);
}

/** `GET /v1/reports/{id}/preview?period=` — só as primeiras linhas. */
export function getReportPreview(
  reportId: string,
  period: AnalyticsPeriod,
): Promise<ReportPreview> {
  return mockReportPreview(reportId, period);
}

/** `GET /v1/reports/runs` — histórico de gerações do tenant. */
export function getReportRuns(): Promise<ReportRun[]> {
  return mockReportRuns();
}

/** `GET /v1/reports/schedules` — envios recorrentes configurados. */
export function getReportSchedules(): Promise<ReportSchedule[]> {
  return mockReportSchedules();
}

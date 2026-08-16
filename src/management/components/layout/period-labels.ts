import type { AnalyticsPeriod } from '@/management/types';

/**
 * Rótulo por extenso de cada recorte.
 *
 * Vive no layout, e não numa feature, porque o período é compartilhado por
 * relatórios, custos, segurança e manutenção — e o rótulo viaja junto com o
 * número em toda declaração de procedência (RN-121).
 */
export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  '30D': 'Últimos 30 dias',
  '3M': 'Últimos 3 meses',
  '6M': 'Últimos 6 meses',
  '12M': 'Últimos 12 meses',
};

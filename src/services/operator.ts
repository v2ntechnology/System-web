import {
  createEntry,
  decideTriage,
  getEntries,
  getOperatorOverview,
  getTriage,
  getYard,
  type EntryPayload,
  type TriagePayload,
} from '@/management/features/operator/api';

/**
 * Rotina de pátio do operador — lançamentos, triagem e situação dos veículos.
 *
 * ⚠️ Os dados vivem em `src/management/mocks/operator.ts`, junto com o resto do
 * painel de gestão, e não em `src/mocks/`. Não é descuido: escalar um checklist
 * da triagem **entra na fila de Liberações do gestor**, que é uma tela do painel
 * de gestão. Duplicar o mock aqui quebraria esse encadeamento — o operador
 * escalaria para uma fila que ninguém abre.
 *
 * Quando o backend existir, os dois lados passam a falar com o mesmo endpoint e
 * esta observação deixa de importar.
 */
export const operatorService = {
  getOverview: getOperatorOverview,
  getEntries,
  createEntry,
  getTriage,
  decideTriage,
  getYard,
};

export type { EntryPayload, TriagePayload };
export type {
  AnalyticsPeriod,
  EntryKind,
  LaunchEntry,
  OperatorOverview,
  TriageFill,
  TriageItem,
  YardVehicle,
} from '@/management/types';

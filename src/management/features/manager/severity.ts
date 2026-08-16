import type { ReleaseStatus, WarningSeverity } from '@/management/types';
import type { StatusTone } from '@/management/ui';

/**
 * A escada de risco do RookHub, num lugar só.
 *
 * Leve, média e grave não são só rótulos de cor: cada degrau muda **quem pode
 * decidir**. Deixar essa regra espalhada pelos componentes é o caminho mais
 * curto para uma tela oferecer "Liberar" num caso grave.
 */
export const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  LEVE: 'Leve',
  MEDIA: 'Média',
  GRAVE: 'Grave',
};

export const SEVERITY_TONE: Record<WarningSeverity, StatusTone> = {
  LEVE: 'neutral',
  MEDIA: 'attention',
  GRAVE: 'critical',
};

/** O que cada degrau exige de quem decide. */
export const SEVERITY_RULE: Record<WarningSeverity, string> = {
  LEVE: 'Liberação direta do gestor, com justificativa registrada.',
  MEDIA: 'Exige plano de ação do gestor antes de liberar.',
  /* "Saída" e não "veículo": a mesma regra vale para o motorista impedido. */
  GRAVE: 'Saída bloqueada. Só o proprietário libera, em aprovação formal.',
};

/** O gestor pode liberar por conta própria? Grave nunca é da alçada dele. */
export function managerCanRelease(severity: WarningSeverity) {
  return severity !== 'GRAVE';
}

/** Ocorrência média não é liberada sem plano de ação. */
export function requiresActionPlan(severity: WarningSeverity) {
  return severity === 'MEDIA';
}

export const RELEASE_STATUS_META: Record<ReleaseStatus, { label: string; tone: StatusTone }> = {
  PENDENTE: { label: 'Aguardando decisão', tone: 'attention' },
  LIBERADO: { label: 'Liberado', tone: 'positive' },
  AGUARDANDO_DONO: { label: 'Com o proprietário', tone: 'info' },
  RECUSADO: { label: 'Recusado', tone: 'critical' },
};

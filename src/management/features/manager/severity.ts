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

/**
 * Faixa vertical da linha na fila, no mesmo desenho da fila de aprovações e da
 * de impedimentos.
 *
 * ⚠️ Faixa usa a família de PREENCHIMENTO (`error`, `warning`), e não a `-on-light`.
 *
 * Relatado pelo usuário em 08/09/2026: não dava para distinguir os degraus. A
 * `-on-light` existe para TEXTO sobre a matiz diluída, e por isso é escurecida
 * até passar 4,5:1. Como tinta chapada ela vira #9F1239 (vinho) e #6B3F0A
 * (marrom oliva): duas cores escuras e dessaturadas que não leem como perigo
 * nem como atenção, e que não se separam uma da outra.
 *
 * Faixa é elemento gráfico: pede 3:1, não 4,5:1, e precisa ser reconhecida pela
 * MATIZ. `#E11D48` e `#B45309` resolvem as duas coisas. No tema escuro as duas
 * famílias têm o mesmo valor, então lá nada muda.
 *
 * A cor continua repetindo um rótulo escrito, e nunca é o único portador.
 */
export const SEVERITY_RAIL: Record<WarningSeverity, string> = {
  LEVE: 'bg-on-light-muted',
  MEDIA: 'bg-warning',
  GRAVE: 'bg-error',
};

/**
 * Peso do degrau para ordenar fila: mais grave primeiro.
 *
 * ⚠️ Existe um gêmeo local em `owner-approvals-page.tsx`. Não é descuido: o
 * painel do dono tem o próprio `approval-meta`, e importar de dentro da feature
 * do gestor acoplaria as duas. Mexeu na escada, confira os dois.
 */
export const SEVERITY_RANK: Record<WarningSeverity, number> = { GRAVE: 0, MEDIA: 1, LEVE: 2 };

/**
 * O rótulo de severidade escrito, na cor do degrau.
 *
 * Par do `SEVERITY_RAIL`: onde a faixa não cabe (dentro da linha, ao lado do
 * texto), o próprio rótulo carrega a cor. Substituiu o `StatusChip` na lista de
 * pendências, que empilhava uma pastilha com fundo dentro de um bloco que já
 * tinha fundo, e disputava peso com o nome da pendência.
 */
export const SEVERITY_TEXT: Record<WarningSeverity, string> = {
  LEVE: 'text-on-light-muted',
  MEDIA: 'text-warning-on-light',
  GRAVE: 'text-error-on-light',
};

/**
 * A partir de quantas horas a espera vira problema, e não estado.
 *
 * Existia como `6` solto dentro do `ReleaseDetailPanel`. Virou constante quando
 * a fila passou a marcar o mesmo limite: o número tem de ser o mesmo nos dois,
 * senão a linha diz que está tudo bem e o painel aberto diz que não.
 */
export const LONG_WAIT_HOURS = 6;

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

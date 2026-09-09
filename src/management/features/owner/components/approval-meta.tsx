import { FileIcon, MoneyIcon, UnlockIcon } from '@/components/icons';
import type { IconType } from '@/components/icons';
import type { OwnerApprovalKind, OwnerApprovalStatus, WarningSeverity } from '@/management/types';
import type { StatusTone } from '@/management/ui';

/**
 * Rótulos, ícones e tons das decisões do dono.
 *
 * Separado dos componentes porque a lista, o painel de detalhe e a contagem da
 * visão geral precisam dos mesmos rótulos — três cópias divergiriam na primeira
 * mudança de texto.
 */

export const KIND_META: Record<OwnerApprovalKind, { label: string; icon: IconType; hint: string }> =
  {
    LIBERACAO_VEICULO: {
      label: 'Liberação de veículo',
      icon: UnlockIcon,
      hint: 'Ocorrência grave bloqueou o veículo e a saída exige aprovação formal do proprietário.',
    },
    LIBERACAO_MOTORISTA: {
      label: 'Liberação de motorista',
      icon: UnlockIcon,
      hint: 'Ocorrência grave impediu o motorista de rodar e a liberação exige aprovação formal do proprietário.',
    },
    PARECER_CRITICO: {
      label: 'Parecer do gestor',
      icon: FileIcon,
      hint: 'Síntese analítica enviada pelo gestor para aprovação.',
    },
    INVESTIMENTO: {
      label: 'Investimento',
      icon: MoneyIcon,
      hint: 'Gasto acima da alçada do gestor.',
    },
  };

/**
 * Severidade da ocorrência que originou o pedido.
 *
 * Leve libera no gestor, média exige plano de ação, grave bloqueia o veículo e
 * sobe para o dono — por isso "grave" é sempre crítico aqui.
 */
export const SEVERITY_TONE: Record<WarningSeverity, StatusTone> = {
  LEVE: 'neutral',
  MEDIA: 'attention',
  GRAVE: 'critical',
};

export const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  LEVE: 'Leve',
  MEDIA: 'Média',
  GRAVE: 'Grave',
};

/**
 * Faixa vertical da linha na fila, como na fila de impedimentos.
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

export const STATUS_META: Record<OwnerApprovalStatus, { label: string; tone: StatusTone }> = {
  PENDENTE: { label: 'Aguardando você', tone: 'attention' },
  APROVADA: { label: 'Aprovada', tone: 'positive' },
  RECUSADA: { label: 'Recusada', tone: 'critical' },
};

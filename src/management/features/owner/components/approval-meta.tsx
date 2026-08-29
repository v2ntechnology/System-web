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

export const STATUS_META: Record<OwnerApprovalStatus, { label: string; tone: StatusTone }> = {
  PENDENTE: { label: 'Aguardando você', tone: 'attention' },
  APROVADA: { label: 'Aprovada', tone: 'positive' },
  RECUSADA: { label: 'Recusada', tone: 'critical' },
};

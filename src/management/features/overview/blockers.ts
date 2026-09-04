import {
  ApprovalIcon,
  CalendarCheckIcon,
  ChecklistIcon,
  FileIcon,
  IdCardIcon,
  MaintenanceIcon,
  ParkingIcon,
  RadarIcon,
  SatelliteIcon,
  type IconType,
} from '@/components/icons';
import type { StatusTone } from '@/management/ui';

import type { Blocker, BlockerKind, BlockerSeverity } from './types';

/**
 * A escada de impedimento num lugar só.
 *
 * A ordem é a da fila, e é ela que decide o peso visual de cada linha. Deixar
 * isso espalhado pelos componentes é o caminho curto para a tela mostrar uma
 * CNH vencida com a mesma tinta de um checklist atrasado.
 */
export const SEVERITY_ORDER: BlockerSeverity[] = [
  'BLOQUEIA_AGORA',
  'BLOQUEIA_EM_BREVE',
  'SEM_VISIBILIDADE',
];

interface SeverityMeta {
  label: string;
  /** O que a linha significa para quem despacha. */
  hint: string;
  tone: StatusTone;
  /** Faixa vertical da linha. Tokens `on-light`: a fila mora num painel claro. */
  rail: string;
}

export const SEVERITY_META: Record<BlockerSeverity, SeverityMeta> = {
  BLOQUEIA_AGORA: {
    label: 'Bloqueia agora',
    hint: 'o caminhão não pode sair',
    tone: 'critical',
    rail: 'bg-error-on-light',
  },
  BLOQUEIA_EM_BREVE: {
    label: 'Bloqueia em breve',
    hint: 'ainda dá tempo de resolver',
    tone: 'attention',
    rail: 'bg-warning-on-light',
  },
  /*
   * Não é "o degrau leve": é o que não dá para afirmar. Fica em cinza porque
   * não há fato confirmado ali, e não porque possa esperar.
   */
  SEM_VISIBILIDADE: {
    label: 'Sem visibilidade',
    hint: 'falta informação para decidir',
    tone: 'neutral',
    rail: 'bg-on-light-muted',
  },
};

export const KIND_META: Record<BlockerKind, { label: string; icon: IconType }> = {
  CHECKLIST_REPROVADO: { label: 'Checklist reprovado', icon: ChecklistIcon },
  DOCUMENTO_VEICULO: { label: 'Documento do veículo', icon: FileIcon },
  CNH_VENCIDA: { label: 'CNH vencida', icon: IdCardIcon },
  MANUTENCAO_VENCENDO: { label: 'Manutenção vencendo', icon: MaintenanceIcon },
  LICENCIAMENTO: { label: 'Licenciamento', icon: CalendarCheckIcon },
  MULTA: { label: 'Multa', icon: ApprovalIcon },
  CHECKLIST_PENDENTE: { label: 'Checklist não realizado', icon: ChecklistIcon },
  PARADO_SEM_JUSTIFICATIVA: { label: 'Parado sem justificativa', icon: ParkingIcon },
  VIAGEM_SEM_ATUALIZACAO: { label: 'Viagem sem atualização', icon: SatelliteIcon },
  RASTREADOR_SEM_SINAL: { label: 'Rastreador sem sinal', icon: RadarIcon },
};

/**
 * A ordem dos tipos nos filtros.
 *
 * Não é alfabética: começa no que trava a saída (checklist, documento, CNH) e
 * termina no que só falta informação. Assim a fileira de ícones lê na mesma
 * direção da fila abaixo dela.
 */
export const KIND_ORDER: BlockerKind[] = [
  'CHECKLIST_REPROVADO',
  'DOCUMENTO_VEICULO',
  'CNH_VENCIDA',
  'MANUTENCAO_VENCENDO',
  'LICENCIAMENTO',
  'MULTA',
  'CHECKLIST_PENDENTE',
  'PARADO_SEM_JUSTIFICATIVA',
  'VIAGEM_SEM_ATUALIZACAO',
  'RASTREADOR_SEM_SINAL',
];

/** Fila única, do que trava agora para o que só está sem resposta. */
export function sortBySeverity(blockers: Blocker[]): Blocker[] {
  return [...blockers].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

export function countByKind(blockers: Blocker[]): Record<BlockerKind, number> {
  const empty = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0])) as Record<
    BlockerKind,
    number
  >;

  return blockers.reduce((total, blocker) => {
    total[blocker.kind] += 1;
    return total;
  }, empty);
}

export function countBySeverity(blockers: Blocker[]): Record<BlockerSeverity, number> {
  return {
    BLOQUEIA_AGORA: blockers.filter((b) => b.severity === 'BLOQUEIA_AGORA').length,
    BLOQUEIA_EM_BREVE: blockers.filter((b) => b.severity === 'BLOQUEIA_EM_BREVE').length,
    SEM_VISIBILIDADE: blockers.filter((b) => b.severity === 'SEM_VISIBILIDADE').length,
  };
}

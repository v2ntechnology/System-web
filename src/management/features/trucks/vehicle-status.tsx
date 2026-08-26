import {
  BlockedIcon,
  CheckCircleIcon,
  MaintenanceIcon,
  SteeringWheelIcon,
  WarningIcon,
} from '@/components/icons';
import type { VehicleStatus } from '@/management/types';
import { StatusChip, type StatusTone } from '@/management/ui';
import type { ComponentType } from 'react';

const STATUS: Record<
  VehicleStatus,
  { label: string; tone: StatusTone; icon: ComponentType<{ size?: number; weight?: 'fill' }> }
> = {
  EM_VIAGEM: { label: 'Em viagem', tone: 'info', icon: SteeringWheelIcon },
  DISPONIVEL: { label: 'Disponível', tone: 'positive', icon: CheckCircleIcon },
  MANUTENCAO: { label: 'Manutenção', tone: 'attention', icon: MaintenanceIcon },
  /* Bloqueio por pendência de checklist (RF-016): impede a saída do veículo. */
  BLOQUEADO: { label: 'Bloqueado', tone: 'critical', icon: BlockedIcon },
  /*
   * Sem leitura do rastreador há mais de 24 horas.
   *
   * Tom de atenção, e não crítico: pode ser veículo em pátio ou rastreador
   * desligado, o que não é emergência. Mas também não pode aparecer como
   * disponível, senão alguém escala um caminhão que ninguém sabe onde está.
   */
  SEM_SINAL: { label: 'Sem sinal', tone: 'attention', icon: WarningIcon },
};

export const VEHICLE_STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS).map(([key, value]) => [key, value.label]),
) as Record<VehicleStatus, string>;

export function VehicleStatusChip({
  status,
  surface = 'light',
}: {
  status: VehicleStatus;
  surface?: 'light' | 'dark' | undefined;
}) {
  const config = STATUS[status];
  const Icon = config.icon;

  return (
    <StatusChip tone={config.tone} surface={surface} icon={<Icon size={14} />}>
      {config.label}
    </StatusChip>
  );
}

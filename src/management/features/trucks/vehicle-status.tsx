import {
  CheckCircleIcon,
  ProhibitIcon,
  SteeringWheelIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import type { VehicleStatus } from '@/management/types';
import { StatusChip, type StatusTone } from '@/management/ui';
import type { ComponentType } from 'react';

const STATUS: Record<
  VehicleStatus,
  { label: string; tone: StatusTone; icon: ComponentType<{ size?: number; weight?: 'fill' }> }
> = {
  EM_VIAGEM: { label: 'Em viagem', tone: 'info', icon: SteeringWheelIcon },
  DISPONIVEL: { label: 'Disponível', tone: 'positive', icon: CheckCircleIcon },
  MANUTENCAO: { label: 'Manutenção', tone: 'attention', icon: WrenchIcon },
  /* Bloqueio por pendência de checklist (RF-016) — impede a saída do veículo. */
  BLOQUEADO: { label: 'Bloqueado', tone: 'critical', icon: ProhibitIcon },
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
    <StatusChip tone={config.tone} surface={surface} icon={<Icon size={14} weight="fill" />}>
      {config.label}
    </StatusChip>
  );
}

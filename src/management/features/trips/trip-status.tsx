import {
  CheckCircleIcon,
  PackageIcon,
  ProhibitIcon,
  TruckIcon,
  WarehouseIcon,
  ClockIcon,
} from '@phosphor-icons/react';
import type { Trip, TripStatus } from '@/management/types';
import { StatusChip, type StatusTone } from '@/management/ui';
import type { ComponentType } from 'react';

type IconType = ComponentType<{ size?: number; weight?: 'fill' | 'duotone' }>;

export const TRIP_STATUS: Record<TripStatus, { label: string; tone: StatusTone; icon: IconType }> =
  {
    PLANEJADA: { label: 'Planejada', tone: 'neutral', icon: ClockIcon },
    EM_CARREGAMENTO: { label: 'Em carregamento', tone: 'info', icon: PackageIcon },
    EM_TRANSITO: { label: 'Em trânsito', tone: 'info', icon: TruckIcon },
    EM_DESCARGA: { label: 'Em descarga', tone: 'info', icon: WarehouseIcon },
    CONCLUIDA: { label: 'Concluída', tone: 'positive', icon: CheckCircleIcon },
    CANCELADA: { label: 'Cancelada', tone: 'critical', icon: ProhibitIcon },
  };

/**
 * Viagem em curso que já passou do prazo.
 *
 * Uma viagem concluída depois do prazo não entra aqui — ela já foi entregue, e o
 * que interessa nela é o histórico, não a urgência.
 */
export function isLate(trip: Trip) {
  const open = trip.status !== 'CONCLUIDA' && trip.status !== 'CANCELADA';
  return open && new Date(trip.dueAt).getTime() < Date.now();
}

/** Concluída fora do prazo — usado no histórico. */
export function finishedLate(trip: Trip) {
  return Boolean(
    trip.finishedAt && new Date(trip.finishedAt).getTime() > new Date(trip.dueAt).getTime(),
  );
}

export function TripStatusChip({
  status,
  surface = 'dark',
}: {
  status: TripStatus;
  surface?: 'dark' | 'light' | undefined;
}) {
  const config = TRIP_STATUS[status];
  const Icon = config.icon;
  return (
    <StatusChip tone={config.tone} surface={surface} icon={<Icon size={14} weight="fill" />}>
      {config.label}
    </StatusChip>
  );
}

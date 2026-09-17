import {
  BlockedIcon,
  CheckCircleIcon,
  MaintenanceIcon,
  RadarIcon,
  RouteIcon,
  type IconType,
} from '@/components/icons';
import type { VehicleStatus } from '@/management/types';

/** Sem sinal não confirma avaria; bloqueio mantém o significado do contrato da API. */
export const YARD_STATUS: Record<
  VehicleStatus,
  {
    label: string;
    plural: string;
    tone: string;
    icon: IconType;
  }
> = {
  DISPONIVEL: {
    label: 'Disponível',
    plural: 'Disponíveis',
    tone: 'neutral',
    icon: CheckCircleIcon,
  },
  EM_VIAGEM: { label: 'Em viagem', plural: 'Em viagem', tone: 'info', icon: RouteIcon },
  MANUTENCAO: {
    label: 'Manutenção',
    plural: 'Em manutenção',
    tone: 'warning',
    icon: MaintenanceIcon,
  },
  BLOQUEADO: { label: 'Bloqueado', plural: 'Bloqueados', tone: 'error', icon: BlockedIcon },
  SEM_SINAL: { label: 'Sem sinal', plural: 'Sem sinal', tone: 'warning', icon: RadarIcon },
};

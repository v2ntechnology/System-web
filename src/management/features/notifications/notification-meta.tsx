import {
  AlertCircleIcon,
  ChecklistIcon,
  DropletIcon,
  InfoIcon,
  IntegrationIcon,
  MaintenanceIcon,
  RouteIcon,
  ShieldAlertIcon,
  WarningIcon,
} from '@/components/icons';
import type { NotificationSeverity, NotificationSource } from '@/management/types';
import type { StatusTone } from '@/management/ui';
import type { ComponentType } from 'react';

type IconType = ComponentType<{ size?: number; weight?: 'fill' | 'duotone'; className?: string }>;

/** Severidade sempre acompanhada de ícone e texto, nunca só cor (RNF-028). */
export const SEVERITY: Record<
  NotificationSeverity,
  { label: string; tone: StatusTone; icon: IconType; color: string }
> = {
  CRITICO: { label: 'Crítico', tone: 'critical', icon: AlertCircleIcon, color: 'text-error' },
  ATENCAO: { label: 'Atenção', tone: 'attention', icon: WarningIcon, color: 'text-warning' },
  INFO: { label: 'Informativo', tone: 'info', icon: InfoIcon, color: 'text-info' },
};

export const SOURCE: Record<NotificationSource, { label: string; icon: IconType }> = {
  SAFETY: { label: 'Segurança', icon: ShieldAlertIcon },
  MAINTENANCE: { label: 'Manutenção', icon: MaintenanceIcon },
  CHECKLIST: { label: 'Checklist', icon: ChecklistIcon },
  TRIPS: { label: 'Viagens', icon: RouteIcon },
  COSTS: { label: 'Custos', icon: DropletIcon },
  /*
   * A chave continua `INTEGRATIONS` porque é o contrato do backend, mas o nome
   * na tela é "Telemetria": todo aviso desta origem fala do rastreador ou do
   * cadastro que ele entrega (sem sinal, nunca reportou, conta que não é
   * pessoa, motorista desligado que continua rodando). "Integrações" descreve
   * o encanamento; quem lê a central quer saber de que assunto se trata.
   */
  INTEGRATIONS: { label: 'Telemetria', icon: IntegrationIcon },
};

/** "há 4 min", "há 2 h", "há 3 d". O absoluto fica no title do elemento. */
export function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export const absoluteTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

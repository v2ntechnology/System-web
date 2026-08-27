import type { AppNotification, NotificationSeverity, NotificationSource } from '@/management/types';

import { env } from '@/app/environment';
import { mockNotifications } from '@/management/mocks/notifications';
import { httpRequest } from '@/services/http';

/**
 * Fronteira única da Central de Notificações (RF-038).
 *
 * ⚠️ **O alerta não é gravado no banco.** Ele é derivado do estado atual a cada
 * consulta: um caminhão que voltou a reportar deixa de estar sem sinal, e um
 * alerta gravado continuaria na lista, mentindo, até alguém apagar.
 *
 * O que persiste é só a marcação de leitura, por usuário. Sem ela o sino volta a
 * piscar a cada F5 e as pessoas param de olhar em dois dias, que é o fim útil de
 * qualquer central de notificação.
 *
 * Com WebSocket (FE-11) as novas passam a chegar por `/topic/tenant.{id}
 * .notifications`; a assinatura entra aqui e nenhum componente muda.
 */

interface NotificationDto {
  id: string;
  title: string;
  description: string;
  severity: string;
  source: string;
  at: string;
  read: boolean;
  actionLabel: string | null;
  actionTo: string | null;
}

const SEVERITIES: NotificationSeverity[] = ['CRITICO', 'ATENCAO', 'INFO'];
const SOURCES: NotificationSource[] = [
  'SAFETY',
  'MAINTENANCE',
  'CHECKLIST',
  'TRIPS',
  'COSTS',
  'INTEGRATIONS',
];

export async function getNotifications(): Promise<AppNotification[]> {
  if (env.enableMocks) return mockNotifications();

  const rows = await httpRequest<NotificationDto[]>('/v1/notifications');

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    /* Valor desconhecido cai em INFO, nunca em CRITICO: inventar urgência é
       pior que perder um destaque. */
    severity: SEVERITIES.includes(row.severity as NotificationSeverity)
      ? (row.severity as NotificationSeverity)
      : 'INFO',
    source: SOURCES.includes(row.source as NotificationSource)
      ? (row.source as NotificationSource)
      : 'INTEGRATIONS',
    at: row.at,
    read: row.read,
    actionLabel: row.actionLabel ?? undefined,
    actionTo: row.actionTo ?? undefined,
  }));
}

/**
 * Marca alertas como lidos.
 *
 * O identificador é determinístico e carrega o dia: o mesmo alerta gera a mesma
 * chave entre recarregamentos, e o alerta de amanhã é outro alerta e volta a
 * aparecer. É de propósito: uma jornada excedida hoje não deixa de importar
 * porque alguém leu a de ontem.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (env.enableMocks || ids.length === 0) return;

  await httpRequest<{ marked: number }>('/v1/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

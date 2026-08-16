import type { AppNotification } from '@/management/types';

import { mockNotifications } from '@/management/mocks/notifications';

/**
 * Fronteira única da Central de Notificações (RF-038).
 *
 * Hoje é uma leitura só. Com o backend, a carga inicial continua vindo por
 * `GET /v1/notifications` e as novas chegam pelo WebSocket em
 * `/topic/tenant.{id}.notifications` (FE-11) — a assinatura entra aqui, e
 * nenhum componente precisa mudar.
 */
export function getNotifications(): Promise<AppNotification[]> {
  return mockNotifications();
}

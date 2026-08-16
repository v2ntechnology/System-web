import type { VehiclePosition } from '@/management/types';

import { mockVehiclePositions } from '@/management/mocks/live-map';

/**
 * Fronteira única do mapa ao vivo.
 *
 * Com o backend, as posições chegam pelo WebSocket em
 * `/topic/tenant.{id}.fleet.status` (FE-11). O polling de agora existe só porque
 * não há servidor; quando houver, a assinatura entra aqui e o componente do mapa
 * continua igual — ele já consome uma lista e chama `setData`.
 */
export function getVehiclePositions(): Promise<VehiclePosition[]> {
  return mockVehiclePositions();
}

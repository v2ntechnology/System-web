import type { FleetOverview } from './types';

import { mockFleetOverview } from '@/management/mocks/overview';

/**
 * Fronteira única entre a visão geral 2 e o transporte de dados.
 *
 * Na integração com o backend só o corpo desta função muda: a tela e os
 * componentes não sabem de onde o dado vem.
 */
export function getFleetOverview(): Promise<FleetOverview> {
  return mockFleetOverview();
}

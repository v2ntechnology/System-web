import type { Trip } from '@/management/types';

import { mockTrips } from '@/management/mocks/trips';

/** Fronteira única de viagens. Vira `GET /v1/trips` com paginação por cursor. */
export function getTrips(): Promise<Trip[]> {
  return mockTrips();
}

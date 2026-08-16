import type {
  Driver,
  DriverProfile,
  DriverRankEntry,
  EventMedia,
  RankingPeriod,
} from '@/management/types';

import {
  mockDriverProfile,
  mockDriverRanking,
  mockDrivers,
  mockWarningMedia,
} from '@/management/mocks/drivers';

/** Fronteira única dos motoristas. Vira `GET /v1/drivers`. */
export function getDrivers(): Promise<Driver[]> {
  return mockDrivers();
}

/** `GET /v1/drivers/{id}/profile` — carregado sob demanda ao selecionar. */
export function getDriverProfile(driverId: string): Promise<DriverProfile> {
  return mockDriverProfile(driverId);
}

/** `GET /v1/drivers/ranking?period=` — agregação pré-calculada (DAT-06). */
export function getDriverRanking(period: RankingPeriod): Promise<DriverRankEntry[]> {
  return mockDriverRanking(period);
}

/**
 * `POST /v1/safety/events/{id}/media` — pede a URL assinada ao fornecedor.
 *
 * Chamada só quando o usuário aperta "assistir": a URL vive 15 minutos (RNF-022)
 * e o backend valida tenant, papel e entitlement antes de emiti-la.
 */
export function getWarningMedia(warningId: string): Promise<EventMedia> {
  return mockWarningMedia(warningId);
}

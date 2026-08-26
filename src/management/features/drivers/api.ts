import type {
  Driver,
  DriverProfile,
  DriverRankEntry,
  EventMedia,
  RankingPeriod,
} from '@/management/types';

import { env } from '@/app/environment';
import {
  fetchDriverHours,
  fetchDriverProfile,
  fetchDriverRanking,
  fetchDrivers,
  type DriverHours,
} from '@/management/lib/fleet-api';
import {
  mockDriverProfile,
  mockDriverRanking,
  mockDrivers,
  mockWarningMedia,
} from '@/management/mocks/drivers';

/**
 * Fronteira única dos motoristas.
 *
 * ⚠️ Contas de sistema não chegam aqui. O fornecedor cria motorista automático
 * quando o veículo roda sem identificação de condutor, e na frota real são 17 de
 * 149. Uma delas, "Unknown", recebe metade das viagens: sem o filtro do backend,
 * o primeiro lugar do ranking seria um fantasma com o dobro de quilômetros de
 * qualquer pessoa.
 */
export function getDrivers(): Promise<Driver[]> {
  return env.enableMocks ? mockDrivers() : fetchDrivers();
}

/**
 * Ficha completa do motorista.
 *
 * ⚠️ CPF, CNH, admissão, salário e regime **não vêm da telemetria**: são do RH, e
 * não existe integração com folha. Esses campos chegam vazios e a tela mostra
 * "não informado".
 *
 * O que é real: quilômetros, trechos, tempo dirigindo, consumo, eventos por
 * categoria e a evolução da nota.
 */
export function getDriverProfile(driverId: string): Promise<DriverProfile> {
  return env.enableMocks ? mockDriverProfile(driverId) : fetchDriverProfile(driverId);
}

/** Ranking por nota de condução, calculada sobre eventos e quilômetros reais. */
export function getDriverRanking(period: RankingPeriod): Promise<DriverRankEntry[]> {
  return env.enableMocks ? mockDriverRanking(period) : fetchDriverRanking(period);
}

/**
 * `POST /v1/safety/events/{id}/media` — pede a URL assinada ao fornecedor.
 *
 * Chamada só quando o usuário aperta "assistir": a URL vive 15 minutos (RNF-022)
 * e o backend valida tenant, papel e entitlement antes de emiti-la.
 *
 * ⚠️ Em mock: a rota de mídia da MiX ainda não foi ligada.
 */
export function getWarningMedia(warningId: string): Promise<EventMedia> {
  return mockWarningMedia(warningId);
}

/**
 * Jornada das ultimas horas.
 *
 * Sem caminho de mock: e indicador de risco calculado sobre trechos reais, e uma
 * versao ficticia dele seria pior que nao ter. Alguem poderia ligar para um
 * motorista mandando parar por causa de um numero inventado.
 */
export function getDriverHours(hours = 24): Promise<DriverHours[]> {
  return fetchDriverHours(hours);
}

export type { DriverHours };

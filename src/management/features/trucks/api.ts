import type { ExpenseCategory, Vehicle, VehicleCostRank, VehicleDetail } from '@/management/types';

import { env } from '@/app/environment';
import {
  fetchVehicleDetail,
  fetchVehicleMaintenance,
  fetchVehicleRegistry,
  fetchVehicles,
  fetchVehicleTrack,
  type MaintenanceStatus,
  type TrackPoint,
  type VehicleRegistry,
} from '@/management/lib/fleet-api';
import { demoMaintenance, demoRegistry, demoVehicle } from '@/management/mocks/demo-vehicle';
import { mockFleetExpenses, mockVehicleDetail, mockVehicles } from '@/management/mocks/trucks';

/**
 * Fronteira única da frota.
 *
 * `VITE_ENABLE_MOCKS` decide a origem. Não é fallback automático: se o backend
 * estiver fora, a tela precisa mostrar erro, e não dado de demonstração
 * disfarçado de real. Um gestor decidindo com número inventado é pior que um
 * gestor vendo "não foi possível carregar".
 */
export function getVehicles(): Promise<Vehicle[]> {
  return env.enableMocks ? mockVehicles() : fetchVehicles();
}

/**
 * Despesa por categoria.
 *
 * ⚠️ Combustível, manutenção e multa NÃO vêm da telemetria: dependem de
 * abastecimento, ordem de serviço e órgão de trânsito, que ainda não têm origem
 * no sistema.
 *
 * Com backend real devolve vazio, e a tela diz que a origem não está ligada. O
 * caminho de mock continua servindo à demonstração, mas não pode vazar para o
 * modo real: as placas do mock não existem na frota do cliente, e um card
 * dizendo "RKH1D23 gastou R$ 84.310" ao lado da frota verdadeira é pior que um
 * card vazio. Quem olha não tem como saber que aquele número é enfeite.
 */
export function getFleetExpenses(): Promise<{
  categories: ExpenseCategory[];
  costRank: VehicleCostRank[];
}> {
  return env.enableMocks ? mockFleetExpenses() : Promise.resolve({ categories: [], costRank: [] });
}

/** Ficha do veículo, carregada sob demanda ao selecioná-lo. */
export function getVehicleDetail(vehicleId: string): Promise<VehicleDetail> {
  return env.enableMocks ? mockVehicleDetail(vehicleId) : fetchVehicleDetail(vehicleId);
}

/**
 * O rastro do veículo nas últimas horas.
 *
 * ⚠️ Sem caminho de mock: é dado de posição, e posição inventada num mapa é a
 * pior espécie de número falso, porque parece verificável. Com mocks ligados a
 * ficha do veículo mostra o mapa vazio, dizendo que não há posições.
 */
export function getVehicleTrack(vehicleId: string, hours = 24): Promise<TrackPoint[]> {
  return env.enableMocks ? Promise.resolve([]) : fetchVehicleTrack(vehicleId, hours);
}

/**
 * O cadastro do veículo, que alimenta o Manual.
 *
 * ⚠️ **A placa de demonstração é atendida AQUI, e não com cache plantado na
 * tela.** Plantar com `setQueryData` foi tentado e não resistiu: o diálogo
 * revalida em segundo plano, a requisição de uma placa que não existe falha, e o
 * erro vence o dado do cache. Resolver na fronteira é o que o resto da feature
 * já faz com `VITE_ENABLE_MOCKS`.
 */
export function getVehicleRegistry(vehicleId: string): Promise<VehicleRegistry> {
  if (vehicleId === demoVehicle.id) return Promise.resolve(demoRegistry);
  return fetchVehicleRegistry(vehicleId);
}

/**
 * O plano e o vencimento de cada item de manutenção.
 *
 * ⚠️ A placa de demonstração é atendida aqui, pela mesma razão do manual: ela
 * não existe no servidor, e o `setQueryData` da tela não resiste à revalidação
 * em segundo plano.
 */
export function getVehicleMaintenance(vehicleId: string): Promise<MaintenanceStatus[]> {
  if (vehicleId === demoVehicle.id) return Promise.resolve(demoMaintenance);
  return fetchVehicleMaintenance(vehicleId);
}

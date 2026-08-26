import type { ExpenseCategory, Vehicle, VehicleCostRank, VehicleDetail } from '@/management/types';

import { env } from '@/app/environment';
import { fetchVehicleDetail, fetchVehicles } from '@/management/lib/fleet-api';
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

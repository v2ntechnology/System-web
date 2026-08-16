import type { ExpenseCategory, Vehicle, VehicleCostRank, VehicleDetail } from '@/management/types';

import { mockFleetExpenses, mockVehicleDetail, mockVehicles } from '@/management/mocks/trucks';

/** Fronteira única da frota. Vira `GET /v1/vehicles` com paginação por cursor. */
export function getVehicles(): Promise<Vehicle[]> {
  return mockVehicles();
}

/** `GET /v1/vehicles/expenses` — agregação pré-calculada no backend (DAT-06). */
export function getFleetExpenses(): Promise<{
  categories: ExpenseCategory[];
  costRank: VehicleCostRank[];
}> {
  return mockFleetExpenses();
}

/** `GET /v1/vehicles/{id}/detail` — carregado sob demanda ao selecionar o veículo. */
export function getVehicleDetail(vehicleId: string): Promise<VehicleDetail> {
  return mockVehicleDetail(vehicleId);
}

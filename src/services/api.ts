import { ALERTS } from '@/mocks/intelligence/alerts';
import { buildChecklistDetail, CHECKLISTS } from '@/mocks/costs/checklists';
import { DASHBOARD_DATA } from '@/mocks/dashboard';
import { DRIVERS } from '@/mocks/fleet/drivers';
import { FINES } from '@/mocks/costs/fines';
import { FUEL_RECORDS } from '@/mocks/costs/fuel';
import { MAINTENANCE_ORDERS } from '@/mocks/costs/maintenance';
import { DEMO_TENANT } from '@/mocks/session';
import { TRIPS } from '@/mocks/operations/trips';
import { VEHICLE_TYPE_LABEL, VEHICLES } from '@/mocks/fleet/vehicles';
import type { DashboardData, FleetOverview, Vehicle, VehicleType } from '@/types';

import type {
  AlertService,
  ChecklistService,
  CreateVehicleInput,
  DriverListParams,
  DriverService,
  FineService,
  FleetService,
  FuelService,
  MaintenanceService,
  TripService,
  UpdateVehicleInput,
  VehicleListParams,
  VehicleService,
} from './contracts';
import { ApiError, mockResponse, paginate, sortBy } from './http';

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export interface DashboardService {
  get(): Promise<DashboardData>;
}

export const dashboardService: DashboardService = {
  async get() {
    return mockResponse(DASHBOARD_DATA);
  },
};

/* -------------------------------------------------------------------------- */
/* Frota                                                                       */
/* -------------------------------------------------------------------------- */

export const fleetService: FleetService = {
  async getOverview() {
    const byTypeMap = new Map<VehicleType, number>();
    const byUnitMap = new Map<string, number>();

    for (const v of VEHICLES) {
      byTypeMap.set(v.type, (byTypeMap.get(v.type) ?? 0) + 1);
      byUnitMap.set(v.unit, (byUnitMap.get(v.unit) ?? 0) + 1);
    }

    const overview: FleetOverview = {
      total: VEHICLES.length,
      available: VEHICLES.filter((v) => v.status === 'available').length,
      onTrip: VEHICLES.filter((v) => v.status === 'on_trip').length,
      maintenance: VEHICLES.filter((v) => v.status === 'maintenance').length,
      stopped: VEHICLES.filter((v) => v.status === 'stopped').length,
      withAlerts: VEHICLES.filter((v) => v.status === 'alert').length,
      byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({
        type,
        label: VEHICLE_TYPE_LABEL[type],
        count,
      })),
      byUnit: Array.from(byUnitMap.entries())
        .map(([unit, count]) => ({ unit, count }))
        .sort((a, b) => b.count - a.count),
    };

    return mockResponse(overview);
  },
};

/* -------------------------------------------------------------------------- */
/* Veículos                                                                    */
/* -------------------------------------------------------------------------- */

// Cópia mutável em memória para simular criação/edição durante a sessão.
let store: Vehicle[] = structuredClone(VEHICLES);

function applyFilters(items: Vehicle[], params: VehicleListParams): Vehicle[] {
  let result = items;
  const search = params.search?.trim().toLowerCase();
  if (search) {
    result = result.filter(
      (v) =>
        v.plate.toLowerCase().includes(search) ||
        v.fleetNumber.toLowerCase().includes(search) ||
        v.model.toLowerCase().includes(search) ||
        v.manufacturer.toLowerCase().includes(search),
    );
  }
  if (params.status && params.status !== 'all') {
    result = result.filter((v) => v.status === params.status);
  }
  if (params.type && params.type !== 'all') {
    result = result.filter((v) => v.type === params.type);
  }
  if (params.unit && params.unit !== 'all') {
    result = result.filter((v) => v.unit === params.unit);
  }
  if (params.criticality && params.criticality !== 'all') {
    result = result.filter((v) => v.criticality === params.criticality);
  }
  return result;
}

export const vehicleService: VehicleService = {
  async list(params = {}) {
    const filtered = applyFilters(store, params);
    const sorted = params.sortBy
      ? sortBy(filtered, params.sortBy, params.sortDir ?? 'asc')
      : filtered;
    return mockResponse(paginate(sorted, params.page ?? 1, params.pageSize ?? 8));
  },

  async getById(id) {
    const vehicle = store.find((v) => v.id === id);
    if (!vehicle) throw new ApiError('Veículo não encontrado.', 404);
    return mockResponse(vehicle);
  },

  async create(input: CreateVehicleInput) {
    const vehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      tenantId: DEMO_TENANT.id,
      criticality: 'low',
      updatedAt: new Date().toISOString(),
      ...input,
    };
    store = [vehicle, ...store];
    return mockResponse(vehicle, { min: 400, max: 800 });
  },

  async update(id, input: UpdateVehicleInput) {
    const index = store.findIndex((v) => v.id === id);
    const current = store[index];
    if (!current) throw new ApiError('Veículo não encontrado.', 404);
    const updated: Vehicle = { ...current, ...input, updatedAt: new Date().toISOString() };
    store[index] = updated;
    return mockResponse(updated, { min: 400, max: 800 });
  },

  async units() {
    const units = Array.from(new Set(store.map((v) => v.unit))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
    return mockResponse(units);
  },
};

/* -------------------------------------------------------------------------- */
/* Motoristas                                                                  */
/* -------------------------------------------------------------------------- */

export const driverService: DriverService = {
  async list(params: DriverListParams = {}) {
    let result = DRIVERS;
    const search = params.search?.trim().toLowerCase();
    if (search) {
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(search) || d.registration.toLowerCase().includes(search),
      );
    }
    return mockResponse(paginate(result, params.page ?? 1, params.pageSize ?? 10));
  },

  async getById(id) {
    const driver = DRIVERS.find((d) => d.id === id);
    if (!driver) throw new ApiError('Motorista não encontrado.', 404);
    return mockResponse(driver);
  },
};

/* -------------------------------------------------------------------------- */
/* Operação: viagens, abastecimentos, manutenção, multas, checklists, alertas   */
/* -------------------------------------------------------------------------- */

export const tripService: TripService = {
  async list() {
    return mockResponse(TRIPS);
  },
};

export const fuelService: FuelService = {
  async list(params = {}) {
    let result = FUEL_RECORDS;
    const search = params.search?.trim().toLowerCase();
    if (search) {
      result = result.filter(
        (r) =>
          r.vehiclePlate.toLowerCase().includes(search) ||
          r.driverName.toLowerCase().includes(search) ||
          r.station.toLowerCase().includes(search),
      );
    }
    return mockResponse(result);
  },
};

export const maintenanceService: MaintenanceService = {
  async list() {
    return mockResponse(MAINTENANCE_ORDERS);
  },
};

export const fineService: FineService = {
  async list() {
    return mockResponse(FINES);
  },
};

export const checklistService: ChecklistService = {
  async list() {
    return mockResponse(CHECKLISTS);
  },
  async getById(id) {
    const detail = buildChecklistDetail(id);
    if (!detail) throw new ApiError('Checklist não encontrado.', 404);
    return mockResponse(detail);
  },
};

export const alertService: AlertService = {
  async list() {
    return mockResponse(ALERTS);
  },
};

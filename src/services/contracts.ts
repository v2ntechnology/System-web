import type {
  Checklist,
  ChecklistDetail,
  Criticality,
  Driver,
  Fine,
  FleetOverview,
  FuelRecord,
  MaintenanceOrder,
  OperationAlert,
  PaginatedResponse,
  PaginationParams,
  SortParams,
  Trip,
  Vehicle,
  VehicleStatus,
  VehicleType,
} from '@/types';

export type VehicleSortField = 'plate' | 'model' | 'mileageKm' | 'updatedAt' | 'unit';

export interface VehicleListParams extends PaginationParams, SortParams<VehicleSortField> {
  search?: string;
  status?: VehicleStatus | 'all';
  type?: VehicleType | 'all';
  unit?: string | 'all';
  criticality?: Criticality | 'all';
}

export interface CreateVehicleInput {
  plate: string;
  fleetNumber: string;
  manufacturer: string;
  model: string;
  year: number;
  type: VehicleType;
  unit: string;
  mileageKm: number;
  status: VehicleStatus;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export interface VehicleService {
  list(params?: VehicleListParams): Promise<PaginatedResponse<Vehicle>>;
  getById(id: string): Promise<Vehicle>;
  create(input: CreateVehicleInput): Promise<Vehicle>;
  update(id: string, input: UpdateVehicleInput): Promise<Vehicle>;
  units(): Promise<string[]>;
}

export interface DriverListParams extends PaginationParams {
  search?: string;
}

export interface DriverService {
  list(params?: DriverListParams): Promise<PaginatedResponse<Driver>>;
  getById(id: string): Promise<Driver>;
}

export interface TripService {
  list(): Promise<Trip[]>;
}

export interface FuelService {
  list(params?: { search?: string }): Promise<FuelRecord[]>;
}

export interface MaintenanceService {
  list(): Promise<MaintenanceOrder[]>;
}

export interface FineService {
  list(): Promise<Fine[]>;
}

export interface ChecklistService {
  list(): Promise<Checklist[]>;
  getById(id: string): Promise<ChecklistDetail>;
}

export interface AlertService {
  list(): Promise<OperationAlert[]>;
}

export interface FleetService {
  getOverview(): Promise<FleetOverview>;
}

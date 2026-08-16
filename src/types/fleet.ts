import type { GeoPosition } from './common';

export type VehicleType = 'truck' | 'tractor_unit' | 'trailer' | 'van' | 'light';

export type VehicleStatus = 'on_trip' | 'available' | 'maintenance' | 'stopped' | 'alert';

export type Criticality = 'high' | 'medium' | 'low';

export interface DriverSummary {
  id: string;
  name: string;
  avatarUrl?: string | undefined;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  plate: string;
  fleetNumber: string;
  model: string;
  manufacturer: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  unit: string;
  criticality: Criticality;
  mileageKm: number;
  currentDriver?: DriverSummary | undefined;
  lastPosition?: GeoPosition | undefined;
  nextMaintenanceAtKm?: number | undefined;
  nextMaintenanceDate?: string | undefined;
  updatedAt: string;
}

export interface FleetOverview {
  total: number;
  available: number;
  onTrip: number;
  maintenance: number;
  stopped: number;
  withAlerts: number;
  byType: { type: VehicleType; label: string; count: number }[];
  byUnit: { unit: string; count: number }[];
}

export type DriverStatus = 'driving' | 'resting' | 'off_duty' | 'available';

export interface Driver {
  id: string;
  tenantId: string;
  name: string;
  registration: string;
  cnhCategory: string;
  cnhExpiration: string;
  currentVehiclePlate?: string | undefined;
  drivingScore: number;
  avgConsumptionKmL: number;
  onTimeDeliveryRate: number;
  safetyAlerts: number;
  status: DriverStatus;
  avatarUrl?: string | undefined;
}

export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';

export interface Trip {
  id: string;
  tenantId: string;
  origin: string;
  destination: string;
  vehiclePlate: string;
  driverName: string;
  startDate: string;
  eta: string;
  status: TripStatus;
  progressPercent: number;
  distanceKm: number;
  delayRisk: 'low' | 'medium' | 'high';
}

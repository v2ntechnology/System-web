import type { GeoPosition, Severity, Trend } from './common';
import type { VehicleStatus } from './fleet';

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
  trend: Trend;
}

export interface MapVehicleMarker {
  id: string;
  plate: string;
  status: VehicleStatus;
  position: GeoPosition;
  route?:
    | {
        origin: GeoPosition;
        destination: GeoPosition;
        /** Traçado rodoviário [lng, lat]. Ausente ⇒ o mapa liga origem e destino. */
        path?: [number, number][] | undefined;
        distanceKm?: number | undefined;
      }
    | undefined;
}

export interface ActivityEvent {
  id: string;
  vehiclePlate: string;
  city: string;
  state: string;
  time: string;
  status: string;
  speedKmh?: number | undefined;
  severity: Severity;
}

export interface ChartPoint {
  label: string;
  [series: string]: number | string;
}

export interface DashboardCharts {
  fleetPerformance: ChartPoint[];
  fuelConsumption: ChartPoint[];
  onTimeDeliveries: ChartPoint[];
  costEvolution: ChartPoint[];
}

export interface AiInsight {
  id: string;
  message: string;
  confidence: number;
  sources: string[];
}

export interface DashboardData {
  metrics: DashboardMetric[];
  markers: MapVehicleMarker[];
  activity: ActivityEvent[];
  charts: DashboardCharts;
  insight: AiInsight;
}

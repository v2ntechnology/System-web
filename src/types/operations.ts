import type { Severity } from './common';

export interface FuelRecord {
  id: string;
  tenantId: string;
  date: string;
  vehiclePlate: string;
  driverName: string;
  station: string;
  liters: number;
  totalValue: number;
  pricePerLiter: number;
  odometerKm: number;
  computedConsumptionKmL: number;
  hasAnomaly: boolean;
}

export type MaintenanceStatus =
  'preventive_soon' | 'under_review' | 'waiting_parts' | 'in_progress' | 'completed' | 'overdue';

export type MaintenancePriority = 'high' | 'medium' | 'low';

export interface MaintenanceOrder {
  id: string;
  tenantId: string;
  vehiclePlate: string;
  title: string;
  workshop: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  estimatedCost: number;
  dueDate: string;
}

export type FineStatus = 'pending' | 'under_appeal' | 'paid' | 'assigned' | 'overdue';

export interface Fine {
  id: string;
  tenantId: string;
  vehiclePlate: string;
  driverName: string;
  infractionType: string;
  date: string;
  location: string;
  value: number;
  points: number;
  dueDate: string;
  status: FineStatus;
}

export type ChecklistStatus = 'pending' | 'completed' | 'with_issue' | 'critical';

export interface Checklist {
  id: string;
  tenantId: string;
  vehiclePlate: string;
  driverName: string;
  tripId?: string | undefined;
  date: string;
  status: ChecklistStatus;
  irregularItems: number;
  photosCount: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'ok' | 'attention' | 'critical' | 'not_applicable';
  note?: string | undefined;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistDetail extends Checklist {
  sections: ChecklistSection[];
}

export type AlertCategory = 'delay' | 'speeding' | 'maintenance' | 'fatigue' | 'checklist' | 'fuel';

export type AlertStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

export interface OperationAlert {
  id: string;
  tenantId: string;
  title: string;
  category: AlertCategory;
  severity: Severity;
  vehiclePlate?: string | undefined;
  driverName?: string | undefined;
  date: string;
  source: string;
  status: AlertStatus;
  assignee?: string | undefined;
}

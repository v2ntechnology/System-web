import type { BadgeProps } from '@/components/ui/badge';
import { ALERT_STATUS_LABEL, SEVERITY_LABEL } from '@/mocks/intelligence/alerts';
import { CHECKLIST_STATUS_LABEL } from '@/mocks/costs/checklists';
import { DRIVER_STATUS_LABEL } from '@/mocks/fleet/drivers';
import { FINE_STATUS_LABEL } from '@/mocks/costs/fines';
import { MAINTENANCE_STATUS_LABEL } from '@/mocks/costs/maintenance';
import { TENANT_STATUS_LABEL } from '@/mocks/saas';
import { TRIP_STATUS_LABEL } from '@/mocks/operations/trips';
import { VEHICLE_STATUS_LABEL } from '@/mocks/fleet/vehicles';
import type {
  AlertStatus,
  ChecklistStatus,
  Criticality,
  DriverStatus,
  FineStatus,
  MaintenanceStatus,
  Severity,
  TenantStatus,
  TripStatus,
  VehicleStatus,
} from '@/types';

type Variant = NonNullable<BadgeProps['variant']>;

export interface StatusDescriptor {
  label: string;
  variant: Variant;
}

const VEHICLE_VARIANT: Record<VehicleStatus, Variant> = {
  on_trip: 'info',
  available: 'success',
  maintenance: 'warning',
  stopped: 'muted',
  alert: 'destructive',
};

const TRIP_VARIANT: Record<TripStatus, Variant> = {
  scheduled: 'secondary',
  in_progress: 'info',
  completed: 'success',
  delayed: 'destructive',
  cancelled: 'muted',
};

const FINE_VARIANT: Record<FineStatus, Variant> = {
  pending: 'warning',
  under_appeal: 'info',
  paid: 'success',
  assigned: 'secondary',
  overdue: 'destructive',
};

const ALERT_VARIANT: Record<AlertStatus, Variant> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  ignored: 'muted',
};

const CHECKLIST_VARIANT: Record<ChecklistStatus, Variant> = {
  pending: 'secondary',
  completed: 'success',
  with_issue: 'warning',
  critical: 'destructive',
};

const MAINTENANCE_VARIANT: Record<MaintenanceStatus, Variant> = {
  preventive_soon: 'info',
  under_review: 'secondary',
  waiting_parts: 'warning',
  in_progress: 'info',
  completed: 'success',
  overdue: 'destructive',
};

const SEVERITY_VARIANT: Record<Severity, Variant> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
  info: 'muted',
};

const CRITICALITY_VARIANT: Record<Criticality, Variant> = {
  high: 'destructive',
  medium: 'warning',
  low: 'success',
};

const CRITICALITY_LABEL: Record<Criticality, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const vehicleStatusDescriptor = (s: VehicleStatus): StatusDescriptor => ({
  label: VEHICLE_STATUS_LABEL[s],
  variant: VEHICLE_VARIANT[s],
});

export const tripStatusDescriptor = (s: TripStatus): StatusDescriptor => ({
  label: TRIP_STATUS_LABEL[s],
  variant: TRIP_VARIANT[s],
});

export const fineStatusDescriptor = (s: FineStatus): StatusDescriptor => ({
  label: FINE_STATUS_LABEL[s],
  variant: FINE_VARIANT[s],
});

export const alertStatusDescriptor = (s: AlertStatus): StatusDescriptor => ({
  label: ALERT_STATUS_LABEL[s],
  variant: ALERT_VARIANT[s],
});

export const checklistStatusDescriptor = (s: ChecklistStatus): StatusDescriptor => ({
  label: CHECKLIST_STATUS_LABEL[s],
  variant: CHECKLIST_VARIANT[s],
});

export const maintenanceStatusDescriptor = (s: MaintenanceStatus): StatusDescriptor => ({
  label: MAINTENANCE_STATUS_LABEL[s],
  variant: MAINTENANCE_VARIANT[s],
});

export const severityDescriptor = (s: Severity): StatusDescriptor => ({
  label: SEVERITY_LABEL[s],
  variant: SEVERITY_VARIANT[s],
});

export const criticalityDescriptor = (s: Criticality): StatusDescriptor => ({
  label: CRITICALITY_LABEL[s],
  variant: CRITICALITY_VARIANT[s],
});

const TENANT_VARIANT: Record<TenantStatus, Variant> = {
  active: 'success',
  trial: 'info',
  suspended: 'warning',
  cancelled: 'destructive',
};

export const tenantStatusDescriptor = (s: TenantStatus): StatusDescriptor => ({
  label: TENANT_STATUS_LABEL[s],
  variant: TENANT_VARIANT[s],
});

export const driverStatusDescriptor = (s: DriverStatus): StatusDescriptor => {
  const variant: Record<DriverStatus, Variant> = {
    driving: 'info',
    resting: 'warning',
    off_duty: 'muted',
    available: 'success',
  };
  return { label: DRIVER_STATUS_LABEL[s], variant: variant[s] };
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  alertService,
  checklistService,
  dashboardService,
  driverService,
  fineService,
  fleetService,
  fuelService,
  maintenanceService,
  tripService,
  vehicleService,
  type CreateVehicleInput,
  type UpdateVehicleInput,
  type VehicleListParams,
} from '@/services';
import { operatorService, type EntryPayload, type TriagePayload } from '@/services/operator';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  fleetOverview: ['fleet', 'overview'] as const,
  vehicles: (params: VehicleListParams) => ['vehicles', params] as const,
  vehicle: (id: string) => ['vehicles', 'detail', id] as const,
  vehicleUnits: ['vehicles', 'units'] as const,
  drivers: (search: string) => ['drivers', search] as const,
  driver: (id: string) => ['drivers', 'detail', id] as const,
  trips: ['trips'] as const,
  fuel: (search: string) => ['fuel', search] as const,
  maintenance: ['maintenance'] as const,
  fines: ['fines'] as const,
  checklists: ['checklists'] as const,
  checklist: (id: string) => ['checklists', 'detail', id] as const,
  alerts: ['alerts'] as const,
  operatorOverview: (canSeeFinancials: boolean) =>
    ['operator', 'overview', canSeeFinancials] as const,
  entries: ['operator', 'entries'] as const,
  triage: ['operator', 'triage'] as const,
  yard: ['operator', 'yard'] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => dashboardService.get() });
}

export function useFleetOverview() {
  return useQuery({ queryKey: queryKeys.fleetOverview, queryFn: () => fleetService.getOverview() });
}

export function useVehicles(params: VehicleListParams) {
  return useQuery({
    queryKey: queryKeys.vehicles(params),
    queryFn: () => vehicleService.list(params),
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: queryKeys.vehicle(id),
    queryFn: () => vehicleService.getById(id),
    enabled: Boolean(id),
  });
}

export function useVehicleUnits() {
  return useQuery({ queryKey: queryKeys.vehicleUnits, queryFn: () => vehicleService.units() });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => vehicleService.create(input),
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(`Veículo ${vehicle.plate} cadastrado com sucesso.`);
    },
    onError: () => toast.error('Não foi possível salvar o veículo.'),
  });
}

export function useUpdateVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVehicleInput) => vehicleService.update(id, input),
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(`Veículo ${vehicle.plate} atualizado com sucesso.`);
    },
    onError: () => toast.error('Não foi possível atualizar o veículo.'),
  });
}

export function useDrivers(search: string) {
  return useQuery({
    queryKey: queryKeys.drivers(search),
    queryFn: () => driverService.list({ search }),
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: queryKeys.driver(id),
    queryFn: () => driverService.getById(id),
    enabled: Boolean(id),
  });
}

export function useTrips() {
  return useQuery({ queryKey: queryKeys.trips, queryFn: () => tripService.list() });
}

export function useFuel(search: string) {
  return useQuery({
    queryKey: queryKeys.fuel(search),
    queryFn: () => fuelService.list({ search }),
  });
}

export function useMaintenance() {
  return useQuery({ queryKey: queryKeys.maintenance, queryFn: () => maintenanceService.list() });
}

export function useFines() {
  return useQuery({ queryKey: queryKeys.fines, queryFn: () => fineService.list() });
}

export function useChecklists() {
  return useQuery({ queryKey: queryKeys.checklists, queryFn: () => checklistService.list() });
}

export function useChecklist(id: string) {
  return useQuery({
    queryKey: queryKeys.checklist(id),
    queryFn: () => checklistService.getById(id),
    enabled: Boolean(id),
  });
}

export function useAlerts() {
  return useQuery({ queryKey: queryKeys.alerts, queryFn: () => alertService.list() });
}

/* -------------------------------------------------------------------------- */
/* Rotina do operador — pátio, lançamentos e triagem                           */
/* -------------------------------------------------------------------------- */

/**
 * O resumo do pátio depende da visibilidade financeira (RF-007): quem não pode
 * ver o total do dia recebe a resposta **sem o campo**, e por isso ela entra na
 * chave da query — trocar de perfil não pode servir o valor em cache.
 */
export function useOperatorOverview(canSeeFinancials: boolean) {
  return useQuery({
    queryKey: queryKeys.operatorOverview(canSeeFinancials),
    queryFn: () => operatorService.getOverview('30D', canSeeFinancials),
  });
}

export function useEntries() {
  return useQuery({ queryKey: queryKeys.entries, queryFn: () => operatorService.getEntries() });
}

export function useYard() {
  return useQuery({ queryKey: queryKeys.yard, queryFn: () => operatorService.getYard() });
}

export function useTriage() {
  return useQuery({ queryKey: queryKeys.triage, queryFn: () => operatorService.getTriage() });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EntryPayload) => operatorService.createEntry(input),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['operator'] });
      toast.success(`Lançamento registrado para ${entry.plate}.`);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useDecideTriage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TriagePayload) => operatorService.decideTriage(input),
    onSuccess: (fill) => {
      queryClient.invalidateQueries({ queryKey: ['operator'] });
      toast.success(
        fill.status === 'ESCALADO'
          ? `${fill.plate} escalado para o gestor autorizar a saída.`
          : `Triagem de ${fill.plate} concluída.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });
}

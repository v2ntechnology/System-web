import type { ExpenseCategory, Vehicle, VehicleCostRank, VehicleDetail } from '@/management/types';

import { ApiError, delay } from './latency';

/**
 * Timestamps relativos ao momento da chamada.
 *
 * Datas fixas envelhecem: com o mock parado no tempo, todo veículo acabava
 * "sem sincronizar" e o banner do RN-141 disparava para a frota inteira.
 */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** ⚠️ Frota fictícia. Placas no padrão Mercosul, números coerentes entre si. */
const buildVehicles = (): Vehicle[] => [
  {
    id: 'veh-001',
    plate: 'RKH1D23',
    brand: 'Mercedes-Benz',
    model: 'Arocs 2651',
    year: 2022,
    status: 'MANUTENCAO',
    odometerKm: 218_740,
    costPerKm: 3.18,
    kmToMaintenance: -1_240,
    lastSyncAt: minutesAgo(12),
  },
  {
    id: 'veh-002',
    plate: 'RKH7E45',
    brand: 'Volvo',
    model: 'FH 540',
    year: 2023,
    status: 'EM_VIAGEM',
    driverName: 'Vinícius Vila Nova',
    odometerKm: 164_302,
    costPerKm: 2.61,
    kmToMaintenance: 380,
    lastSyncAt: minutesAgo(2),
  },
  {
    id: 'veh-003',
    plate: 'RKH2B88',
    brand: 'Scania',
    model: 'R 450',
    year: 2021,
    status: 'EM_VIAGEM',
    driverName: 'Marina Cordeiro',
    odometerKm: 291_115,
    costPerKm: 3.42,
    kmToMaintenance: 2_140,
    lastSyncAt: minutesAgo(1),
  },
  {
    id: 'veh-004',
    plate: 'RKH9C10',
    brand: 'DAF',
    model: 'XF 480',
    year: 2020,
    status: 'DISPONIVEL',
    odometerKm: 342_890,
    costPerKm: 3.04,
    kmToMaintenance: 6_500,
    lastSyncAt: minutesAgo(96),
  },
  {
    id: 'veh-005',
    plate: 'RKH4F72',
    brand: 'Volvo',
    model: 'FH 460',
    year: 2024,
    status: 'EM_VIAGEM',
    driverName: 'Edson Bastos',
    odometerKm: 62_410,
    costPerKm: 2.28,
    kmToMaintenance: 8_900,
    lastSyncAt: minutesAgo(3),
  },
  {
    id: 'veh-006',
    plate: 'RKH8H31',
    brand: 'Iveco',
    model: 'S-Way 540',
    year: 2022,
    status: 'BLOQUEADO',
    odometerKm: 187_005,
    costPerKm: 2.94,
    kmToMaintenance: 1_120,
    /* Integração parada há horas — o banner de dado desatualizado (RN-141) usa isto. */
    lastSyncAt: minutesAgo(515),
  },
  {
    id: 'veh-007',
    plate: 'RKH5J19',
    brand: 'Scania',
    model: 'R 500',
    year: 2023,
    status: 'EM_VIAGEM',
    driverName: 'Patrícia Nunes',
    odometerKm: 98_760,
    costPerKm: 2.47,
    kmToMaintenance: 4_300,
    lastSyncAt: minutesAgo(2),
  },
  {
    id: 'veh-008',
    plate: 'RKH3K57',
    brand: 'Mercedes-Benz',
    model: 'Actros 2546',
    year: 2021,
    status: 'DISPONIVEL',
    odometerKm: 254_330,
    costPerKm: 2.87,
    kmToMaintenance: 720,
    lastSyncAt: minutesAgo(7),
  },
];

export async function mockVehicles(): Promise<Vehicle[]> {
  await delay(550);
  return buildVehicles();
}

/* -------------------------------------------------------------------------- */
/* Despesas e detalhamento                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Despesa por categoria no período, com os veículos que mais pesaram.
 *
 * Os totais e os rankings são coerentes: a soma do ranking é uma fração
 * plausível do total, e as placas existem na frota acima.
 */
const EXPENSES: ExpenseCategory[] = [
  {
    id: 'MAINTENANCE',
    label: 'Manutenção',
    total: 418_740,
    deltaPercent: -6.2,
    ranking: [
      { plate: 'RKH1D23', value: 84_310 },
      { plate: 'RKH2B88', value: 61_920 },
      { plate: 'RKH9C10', value: 47_580 },
    ],
  },
  {
    id: 'FUEL',
    label: 'Combustível',
    total: 1_284_500,
    deltaPercent: -3.8,
    ranking: [
      { plate: 'RKH2B88', value: 214_600 },
      { plate: 'RKH1D23', value: 198_120 },
      { plate: 'RKH5J19', value: 176_940 },
    ],
  },
  {
    id: 'FINES',
    label: 'Multas',
    total: 38_260,
    deltaPercent: 12.4,
    ranking: [
      { plate: 'RKH8H31', value: 14_820 },
      { plate: 'RKH2B88', value: 9_640 },
      { plate: 'RKH5J19', value: 6_310 },
    ],
  },
];

/** Custo total acumulado por veículo — o "Top caminhões" do topo. */
const COST_RANK: VehicleCostRank[] = [
  { plate: 'RKH2B88', value: 286_160 },
  { plate: 'RKH1D23', value: 282_430 },
  { plate: 'RKH9C10', value: 214_770 },
];

const DETAILS: Record<string, Omit<VehicleDetail, 'vehicleId'>> = {
  'veh-001': {
    fuelEfficiency: 2.1,
    availability: 74.5,
    openOrders: 2,
    lastMaintenanceAt: '2026-06-18',
    monthlyCost: [
      { month: 'mar', value: 3.31 },
      { month: 'abr', value: 3.28 },
      { month: 'mai', value: 3.24 },
      { month: 'jun', value: 3.19 },
      { month: 'jul', value: 3.22 },
      { month: 'ago', value: 3.18 },
    ],
    recentEvents: [
      {
        id: 'ev-1',
        label: 'Freada brusca na BR-101, km 214',
        at: '2026-08-02',
        severity: 'CRITICO',
      },
      { id: 'ev-2', label: 'Pastilhas de freio vencidas', at: '2026-07-31', severity: 'ATENCAO' },
      {
        id: 'ev-3',
        label: 'Checklist reprovado — iluminação',
        at: '2026-07-28',
        severity: 'ATENCAO',
      },
    ],
  },
  'veh-002': {
    fuelEfficiency: 2.8,
    availability: 96.2,
    openOrders: 0,
    lastMaintenanceAt: '2026-07-22',
    monthlyCost: [
      { month: 'mar', value: 2.78 },
      { month: 'abr', value: 2.74 },
      { month: 'mai', value: 2.69 },
      { month: 'jun', value: 2.66 },
      { month: 'jul', value: 2.63 },
      { month: 'ago', value: 2.61 },
    ],
    recentEvents: [
      { id: 'ev-4', label: 'Revisão preventiva concluída', at: '2026-07-22', severity: 'INFO' },
    ],
  },
};

/** Detalhamento padrão, derivado do veículo — evita mock por veículo da frota inteira. */
function fallbackDetail(vehicle: Vehicle): Omit<VehicleDetail, 'vehicleId'> {
  /* Veículo real vem sem custo por km: ele depende de abastecimento e ordem de
     serviço, que ainda não têm origem no sistema. Este é o caminho de
     demonstração, então usa um valor típico de carreta para derivar os gráficos. */
  const base = vehicle.costPerKm ?? 3.2;
  return {
    fuelEfficiency: Math.round((7.4 / base) * 10) / 10,
    availability: vehicle.status === 'MANUTENCAO' ? 71.2 : 93.4,
    openOrders: vehicle.status === 'MANUTENCAO' ? 1 : 0,
    lastMaintenanceAt: '2026-07-05',
    monthlyCost: ['mar', 'abr', 'mai', 'jun', 'jul', 'ago'].map((month, index) => ({
      month,
      value: Math.round((base + (5 - index) * 0.04) * 100) / 100,
    })),
    recentEvents: [
      {
        id: `${vehicle.id}-ev`,
        label: 'Sem eventos no período',
        at: '2026-08-01',
        severity: 'INFO',
      },
    ],
  };
}

export async function mockFleetExpenses(): Promise<{
  categories: ExpenseCategory[];
  costRank: VehicleCostRank[];
}> {
  await delay(450);
  return { categories: EXPENSES, costRank: COST_RANK };
}

export async function mockVehicleDetail(vehicleId: string): Promise<VehicleDetail> {
  await delay(350);
  const vehicle = buildVehicles().find((item) => item.id === vehicleId);
  const detail = DETAILS[vehicleId] ?? (vehicle ? fallbackDetail(vehicle) : undefined);
  if (!detail) throw new ApiError(404, 'Veículo não encontrado');
  return { vehicleId, ...detail };
}

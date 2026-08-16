import type { AnalyticsPeriod, CostsSummary } from '@/management/types';

import { delay } from './latency';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/**
 * ⚠️ Custos fictícios, mas internamente coerentes: o `costPerKm` de cada veículo
 * é de fato a soma das três camadas dividida pelos km rodados. Mock incoerente
 * esconde erro de fórmula na hora da integração.
 */
/**
 * Frota do período de referência (6 meses).
 *
 * Os valores são DERIVADOS de taxas por km, não digitados soltos: um carreteiro
 * faz ~2,5 km/l com diesel a ~R$ 6,20, o que dá cerca de R$ 2,40/km só de
 * combustível. Digitar total e km de forma independente produz custo/km de dois
 * dígitos — que foi exatamente o erro que esta abordagem evita.
 */
const RATES = [
  {
    vehicleId: 'veh-003',
    plate: 'RKH2B88',
    model: 'Scania R 450',
    kmDriven: 62_400,
    fuelRate: 2.51,
    maintenanceRate: 0.72,
    fixedRate: 0.19,
  },
  {
    vehicleId: 'veh-001',
    plate: 'RKH1D23',
    model: 'Mercedes-Benz Arocs',
    kmDriven: 58_900,
    fuelRate: 2.36,
    maintenanceRate: 0.68,
    fixedRate: 0.14,
  },
  {
    vehicleId: 'veh-004',
    plate: 'RKH9C10',
    model: 'DAF XF 480',
    kmDriven: 55_200,
    fuelRate: 2.29,
    maintenanceRate: 0.56,
    fixedRate: 0.19,
  },
  {
    vehicleId: 'veh-006',
    plate: 'RKH8H31',
    model: 'Iveco S-Way 540',
    kmDriven: 48_700,
    fuelRate: 2.21,
    maintenanceRate: 0.42,
    fixedRate: 0.31,
  },
  {
    vehicleId: 'veh-008',
    plate: 'RKH3K57',
    model: 'Mercedes-Benz Actros',
    kmDriven: 61_300,
    fuelRate: 2.14,
    maintenanceRate: 0.46,
    fixedRate: 0.13,
  },
  {
    vehicleId: 'veh-007',
    plate: 'RKH5J19',
    model: 'Scania R 500',
    kmDriven: 64_800,
    fuelRate: 2.02,
    maintenanceRate: 0.31,
    fixedRate: 0.14,
  },
  {
    vehicleId: 'veh-002',
    plate: 'RKH7E45',
    model: 'Volvo FH 540',
    kmDriven: 68_200,
    fuelRate: 1.94,
    maintenanceRate: 0.29,
    fixedRate: 0.12,
  },
  {
    vehicleId: 'veh-005',
    plate: 'RKH4F72',
    model: 'Volvo FH 460',
    kmDriven: 66_500,
    fuelRate: 1.83,
    maintenanceRate: 0.24,
    fixedRate: 0.12,
  },
];

const VEHICLES = RATES.map(({ fuelRate, maintenanceRate, fixedRate, ...vehicle }) => {
  const fuel = Math.round(vehicle.kmDriven * fuelRate);
  const maintenance = Math.round(vehicle.kmDriven * maintenanceRate);
  const fixed = Math.round(vehicle.kmDriven * fixedRate);
  return {
    ...vehicle,
    fuel,
    maintenance,
    fixed,
    costPerKm: Math.round(((fuel + maintenance + fixed) / vehicle.kmDriven) * 100) / 100,
  };
});

const FUELINGS = [
  {
    id: 'fue-9012',
    at: daysAgo(1),
    plate: 'RKH2B88',
    driverName: 'Marina Cordeiro',
    station: 'Posto Ipiranga — BR-116 km 201',
    liters: 380,
    pricePerLiter: 6.24,
    total: 2_371.2,
    efficiency: 1.9,
    anomaly: 'Volume 42% acima da média do veículo e km/l 32% abaixo do histórico.',
  },
  {
    id: 'fue-9008',
    at: daysAgo(2),
    plate: 'RKH7E45',
    driverName: 'Vinícius Vila Nova',
    station: 'Posto Shell — Duque de Caxias',
    liters: 268,
    pricePerLiter: 6.18,
    total: 1_656.24,
    efficiency: 2.8,
  },
  {
    id: 'fue-9004',
    at: daysAgo(3),
    plate: 'RKH1D23',
    driverName: '—',
    station: 'Posto BR — Nova Iguaçu',
    liters: 295,
    pricePerLiter: 6.44,
    total: 1_899.8,
    efficiency: 2.1,
    anomaly: 'Preço por litro 4% acima do praticado na região no mesmo dia.',
  },
  {
    id: 'fue-8997',
    at: daysAgo(4),
    plate: 'RKH5J19',
    driverName: 'Patrícia Nunes',
    station: 'Posto Ipiranga — Av. Brasil',
    liters: 240,
    pricePerLiter: 6.15,
    total: 1_476,
    efficiency: 2.5,
  },
  {
    id: 'fue-8990',
    at: daysAgo(6),
    plate: 'RKH4F72',
    driverName: 'Edson Bastos',
    station: 'Posto Shell — Japeri',
    liters: 252,
    pricePerLiter: 6.09,
    total: 1_534.68,
    efficiency: 3.1,
  },
];

/** Multiplicadores por recorte — período maior, números maiores. */
const FACTOR: Record<AnalyticsPeriod, number> = { '30D': 0.18, '3M': 0.5, '6M': 1, '12M': 2.1 };

const LAYERS_12M = [
  { month: 'set', fuel: 1.92, maintenance: 0.48, fixed: 0.61 },
  { month: 'out', fuel: 1.88, maintenance: 0.52, fixed: 0.61 },
  { month: 'nov', fuel: 1.95, maintenance: 0.44, fixed: 0.62 },
  { month: 'dez', fuel: 2.08, maintenance: 0.57, fixed: 0.62 },
  { month: 'jan', fuel: 2.14, maintenance: 0.63, fixed: 0.64 },
  { month: 'fev', fuel: 2.02, maintenance: 0.49, fixed: 0.64 },
  { month: 'mar', fuel: 1.96, maintenance: 0.46, fixed: 0.65 },
  { month: 'abr', fuel: 1.89, maintenance: 0.51, fixed: 0.65 },
  { month: 'mai', fuel: 1.84, maintenance: 0.43, fixed: 0.66 },
  { month: 'jun', fuel: 1.79, maintenance: 0.39, fixed: 0.66 },
  { month: 'jul', fuel: 1.76, maintenance: 0.41, fixed: 0.67 },
  { month: 'ago', fuel: 1.71, maintenance: 0.37, fixed: 0.67 },
];

/** Quantos meses cada recorte mostra na série de camadas. */
const MONTHS: Record<AnalyticsPeriod, number> = { '30D': 1, '3M': 3, '6M': 6, '12M': 12 };

export async function mockCostsSummary(period: AnalyticsPeriod): Promise<CostsSummary> {
  await delay(520);

  const factor = FACTOR[period];
  const vehicles = VEHICLES.map((vehicle) => ({
    ...vehicle,
    kmDriven: Math.round(vehicle.kmDriven * factor),
    fuel: Math.round(vehicle.fuel * factor),
    maintenance: Math.round(vehicle.maintenance * factor),
    fixed: Math.round(vehicle.fixed * factor),
  }));

  const fuel = vehicles.reduce((sum, v) => sum + v.fuel, 0);
  const maintenance = vehicles.reduce((sum, v) => sum + v.maintenance, 0);
  const fixed = vehicles.reduce((sum, v) => sum + v.fixed, 0);
  const kmDriven = vehicles.reduce((sum, v) => sum + v.kmDriven, 0);

  const layers = LAYERS_12M.slice(-MONTHS[period]);

  return {
    totalCostPerKm: Math.round(((fuel + maintenance + fixed) / kmDriven) * 100) / 100,
    deltaPercent: { '30D': -3.2, '3M': -4.6, '6M': -6.1, '12M': -9.2 }[period],
    fuel,
    maintenance,
    fixed,
    kmDriven,
    source: `Com base em ${Math.round(342 * factor)} abastecimentos e ${Math.round(48 * factor)} ordens de serviço`,
    layers,
    vehicles,
    fuelings: FUELINGS,
  };
}

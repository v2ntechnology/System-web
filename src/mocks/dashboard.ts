import { buildVehicleMarker, VEHICLES } from '@/mocks/fleet/vehicles';
import type {
  ActivityEvent,
  DashboardCharts,
  DashboardData,
  DashboardMetric,
  MapVehicleMarker,
} from '@/types';

const METRICS: DashboardMetric[] = [
  {
    id: 'online',
    label: 'Veículos online',
    value: '184',
    hint: 'Veículos com telemetria ativa nos últimos 15 minutos.',
    trend: { direction: 'up', changePercent: 8, isPositive: true },
  },
  {
    id: 'ontime',
    label: 'Pontualidade',
    value: '98%',
    hint: 'Entregas concluídas dentro da janela prevista no período.',
    trend: { direction: 'up', changePercent: 4, isPositive: true },
  },
  {
    id: 'cost',
    label: 'Redução de custos',
    value: '17%',
    hint: 'Economia estimada frente ao período anterior com base em consumo e rotas.',
    trend: { direction: 'up', changePercent: 5, isPositive: true },
  },
  {
    id: 'alerts',
    label: 'Alertas ativos',
    value: '12',
    hint: 'Alertas abertos ou em tratativa que exigem atenção.',
    trend: { direction: 'down', changePercent: 3, isPositive: true },
  },
];

const MARKERS: MapVehicleMarker[] = VEHICLES.filter((v) => v.lastPosition).map((v) =>
  buildVehicleMarker(v),
);

const ACTIVITY: ActivityEvent[] = [
  {
    id: 'act-1',
    vehiclePlate: 'RKH-1A23',
    city: 'São Paulo',
    state: 'SP',
    time: '2024-05-20T11:34:00-03:00',
    status: '84 km/h',
    speedKmh: 84,
    severity: 'info',
  },
  {
    id: 'act-2',
    vehiclePlate: 'RKH-7G34',
    city: 'Porto Alegre',
    state: 'RS',
    time: '2024-05-20T11:31:00-03:00',
    status: 'Excesso de velocidade',
    speedKmh: 108,
    severity: 'critical',
  },
  {
    id: 'act-3',
    vehiclePlate: 'RKH-6F12',
    city: 'Goiânia',
    state: 'GO',
    time: '2024-05-20T11:28:00-03:00',
    status: '89 km/h',
    speedKmh: 89,
    severity: 'info',
  },
  {
    id: 'act-4',
    vehiclePlate: 'RKH-8T56',
    city: 'Recife',
    state: 'PE',
    time: '2024-05-20T11:20:00-03:00',
    status: 'Alerta de manutenção',
    severity: 'high',
  },
  {
    id: 'act-5',
    vehiclePlate: 'RKH-4P78',
    city: 'Uberlândia',
    state: 'MG',
    time: '2024-05-20T11:12:00-03:00',
    status: '92 km/h',
    speedKmh: 92,
    severity: 'info',
  },
  {
    id: 'act-6',
    vehiclePlate: 'RKH-3C67',
    city: 'Belo Horizonte',
    state: 'MG',
    time: '2024-05-20T11:02:00-03:00',
    status: 'Parado — manutenção',
    speedKmh: 0,
    severity: 'medium',
  },
];

const CHARTS: DashboardCharts = {
  fleetPerformance: [
    { label: 'Seg', pontualidade: 92, entregas: 88 },
    { label: 'Ter', pontualidade: 94, entregas: 90 },
    { label: 'Qua', pontualidade: 91, entregas: 93 },
    { label: 'Qui', pontualidade: 96, entregas: 92 },
    { label: 'Sex', pontualidade: 98, entregas: 95 },
    { label: 'Sáb', pontualidade: 97, entregas: 94 },
    { label: 'Dom', pontualidade: 95, entregas: 96 },
  ],
  fuelConsumption: [
    { label: 'Seg', litros: 4200 },
    { label: 'Ter', litros: 3900 },
    { label: 'Qua', litros: 4500 },
    { label: 'Qui', litros: 4100 },
    { label: 'Sex', litros: 4800 },
    { label: 'Sáb', litros: 3600 },
    { label: 'Dom', litros: 2800 },
  ],
  onTimeDeliveries: [
    { label: 'Sem 1', prazo: 89 },
    { label: 'Sem 2', prazo: 92 },
    { label: 'Sem 3', prazo: 95 },
    { label: 'Sem 4', prazo: 98 },
  ],
  costEvolution: [
    { label: 'Jan', custo: 412 },
    { label: 'Fev', custo: 398 },
    { label: 'Mar', custo: 421 },
    { label: 'Abr', custo: 389 },
    { label: 'Mai', custo: 356 },
  ],
};

export const DASHBOARD_DATA: DashboardData = {
  metrics: METRICS,
  markers: MARKERS,
  activity: ACTIVITY,
  charts: CHARTS,
  insight: {
    id: 'insight-1',
    message:
      'A IA identificou que três veículos da linha pesada apresentaram aumento médio de 9,4% no consumo de combustível nos últimos sete dias. Recomenda-se verificar pressão dos pneus, tempo em marcha lenta e alteração de rota.',
    confidence: 0.87,
    sources: ['Telemetria', 'Abastecimentos', 'Rotas'],
  },
};

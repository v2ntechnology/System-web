import type {
  ReportDefinition,
  AnalyticsPeriod,
  ReportPreview,
  ReportRun,
  ReportSchedule,
} from '@/management/types';

import { PERIOD_LABELS } from '@/management/components/layout/period-labels';

import { ApiError, delay } from './latency';

/** Datas relativas ao relógio — mock com data fixa envelhece e mente. */
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/** ⚠️ Catálogo fictício de relatórios. */
const REPORTS: ReportDefinition[] = [
  {
    id: 'rep-cost-per-km',
    title: 'Custo por quilômetro em camadas',
    description:
      'Combustível, manutenção e custos fixos separados por veículo e por período, com a memória de cálculo.',
    category: 'CUSTOS',
    requiredModule: 'COSTS',
    generatedAt: hoursAgo(6),
    formats: ['PDF', 'XLSX', 'CSV'],
    columns: ['Placa', 'Modelo', 'Km rodados', 'Combustível', 'Manutenção', 'Fixos', 'Custo/km'],
    estimatedRows: 8,
  },
  {
    id: 'rep-fuel',
    title: 'Abastecimentos e consumo',
    description:
      'Litros, preço médio, km/l por veículo e detecção de abastecimentos fora do padrão histórico.',
    category: 'CUSTOS',
    requiredModule: 'COSTS',
    generatedAt: hoursAgo(6),
    formats: ['PDF', 'XLSX'],
    columns: ['Data', 'Placa', 'Posto', 'Litros', 'Preço/l', 'Total', 'km/l'],
    estimatedRows: 342,
  },
  {
    id: 'rep-trips',
    title: 'Viagens concluídas',
    description: 'Origem, destino, distância, duração e aderência ao prazo por viagem.',
    category: 'OPERACAO',
    requiredModule: 'TRIPS',
    generatedAt: hoursAgo(6),
    formats: ['PDF', 'XLSX', 'CSV'],
    columns: ['Viagem', 'Motorista', 'Placa', 'Origem', 'Destino', 'Km', 'Prazo'],
    estimatedRows: 214,
  },
  {
    id: 'rep-checklist',
    title: 'Checklists e pendências',
    description:
      'Itens reprovados, veículos bloqueados e tempo até a liberação, com foto e responsável.',
    category: 'OPERACAO',
    requiredModule: 'CHECKLIST',
    generatedAt: hoursAgo(30),
    formats: ['PDF', 'XLSX'],
    columns: ['Data', 'Placa', 'Motorista', 'Item reprovado', 'Bloqueou?', 'Liberado em'],
    estimatedRows: 96,
  },
  {
    id: 'rep-safety-events',
    title: 'Eventos de segurança',
    description:
      'Eventos por severidade, motorista e trecho, incluindo contestações e falsos positivos.',
    category: 'SEGURANCA',
    requiredModule: 'SAFETY',
    generatedAt: hoursAgo(6),
    formats: ['PDF', 'XLSX'],
    columns: ['Data', 'Motorista', 'Placa', 'Tipo', 'Severidade', 'Trecho', 'Contestado'],
    estimatedRows: 1_284,
  },
  {
    id: 'rep-driver-score',
    title: 'Score de segurança por motorista',
    description: 'Evolução do score, composição da nota e comparação com a média da frota.',
    category: 'SEGURANCA',
    requiredModule: 'SAFETY',
    generatedAt: hoursAgo(6),
    formats: ['PDF'],
    columns: ['Motorista', 'Score', 'Variação', 'Eventos', 'Km rodados'],
    estimatedRows: 7,
  },
  {
    id: 'rep-maintenance',
    title: 'Ordens de serviço',
    description: 'Preventivas e corretivas, custo por OS, tempo de parada e oficina responsável.',
    category: 'MANUTENCAO',
    requiredModule: 'MAINTENANCE',
    generatedAt: hoursAgo(6),
    formats: ['PDF', 'XLSX', 'CSV'],
    columns: ['OS', 'Placa', 'Tipo', 'Serviço', 'Oficina', 'Custo', 'Parada (h)'],
    estimatedRows: 48,
  },
  {
    id: 'rep-fleet-availability',
    title: 'Disponibilidade da frota',
    description: 'Horas em operação, em manutenção e ociosas por veículo ao longo do período.',
    category: 'MANUTENCAO',
    requiredModule: 'MAINTENANCE',
    generatedAt: hoursAgo(54),
    formats: ['PDF', 'XLSX'],
    columns: ['Placa', 'Horas em operação', 'Em manutenção', 'Ociosas', 'Disponibilidade'],
    estimatedRows: 8,
  },
];

/** Amostra das primeiras linhas de cada relatório. */
const PREVIEWS: Record<string, Omit<ReportPreview, 'reportId' | 'totalRows'>> = {
  'rep-cost-per-km': {
    columns: ['Placa', 'Modelo', 'Km rodados', 'Combustível', 'Manutenção', 'Fixos', 'Custo/km'],
    rows: [
      ['RKH2B88', 'Scania R 450', '62.400', 'R$ 156.624', 'R$ 44.928', 'R$ 11.856', 'R$ 3,42'],
      [
        'RKH1D23',
        'Mercedes-Benz Arocs',
        '58.900',
        'R$ 139.004',
        'R$ 40.052',
        'R$ 8.246',
        'R$ 3,18',
      ],
      ['RKH9C10', 'DAF XF 480', '55.200', 'R$ 126.408', 'R$ 30.912', 'R$ 10.488', 'R$ 3,04'],
      ['RKH8H31', 'Iveco S-Way 540', '48.700', 'R$ 107.627', 'R$ 20.454', 'R$ 15.097', 'R$ 2,94'],
      [
        'RKH3K57',
        'Mercedes-Benz Actros',
        '61.300',
        'R$ 131.182',
        'R$ 28.198',
        'R$ 7.969',
        'R$ 2,73',
      ],
    ],
    source: 'Com base em 342 abastecimentos e 48 ordens de serviço',
  },
  'rep-safety-events': {
    columns: ['Data', 'Motorista', 'Placa', 'Tipo', 'Severidade', 'Trecho', 'Contestado'],
    rows: [
      [
        '29/07',
        'Wagner Teixeira',
        'RKH8H31',
        'Excesso de velocidade',
        'Grave',
        'BR-101 km 214',
        'Não',
      ],
      ['16/07', 'Wagner Teixeira', 'RKH8H31', 'Sonolência', 'Grave', 'BR-116 km 302', 'Sim'],
      ['11/07', 'Cleber Moraes', 'RKH5J19', 'Frenagem brusca', 'Média', 'BR-040 km 88', 'Não'],
      ['04/07', 'Patrícia Nunes', 'RKH5J19', 'Curva agressiva', 'Leve', 'RJ-116 km 12', 'Não'],
      ['28/06', 'Edson Bastos', 'RKH4F72', 'Jornada excedida', 'Média', 'BR-101 km 190', 'Não'],
    ],
    source: 'Com base em 1.284 eventos de telemetria',
  },
  'rep-maintenance': {
    columns: ['OS', 'Placa', 'Tipo', 'Serviço', 'Oficina', 'Custo', 'Parada (h)'],
    rows: [
      [
        '4417',
        'RKH1D23',
        'Corretiva',
        'Troca de pastilhas de freio',
        'Oficina Central',
        'R$ 2.480',
        '14',
      ],
      ['4418', 'RKH7E45', 'Preventiva', 'Revisão de 60.000 km', 'Oficina Central', 'R$ 3.940', '8'],
      [
        '4421',
        'RKH2B88',
        'Preventiva',
        'Alinhamento e balanceamento',
        'Truck Diesel Niterói',
        'R$ 860',
        '3',
      ],
      [
        '4422',
        'RKH9C10',
        'Preventiva',
        'Substituição de filtro de ar',
        'Oficina Central',
        'R$ 320',
        '2',
      ],
    ],
    source: 'Com base em 48 ordens de serviço abertas e concluídas',
  },
};

/** Prévia genérica quando o relatório ainda não tem amostra desenhada. */
function fallbackPreview(report: ReportDefinition): Omit<ReportPreview, 'reportId' | 'totalRows'> {
  return {
    columns: report.columns,
    rows: [],
    source: `Com base nos dados de ${report.category.toLowerCase()} do período`,
  };
}

const RUNS: ReportRun[] = [
  {
    id: 'run-4821',
    reportId: 'rep-cost-per-km',
    reportTitle: 'Custo por quilômetro em camadas',
    format: 'XLSX',
    periodLabel: 'Últimos 6 meses',
    requestedBy: 'Helena Marques',
    requestedAt: hoursAgo(2),
    status: 'PRONTO',
    sizeKb: 184,
  },
  {
    id: 'run-4820',
    reportId: 'rep-safety-events',
    reportTitle: 'Eventos de segurança',
    format: 'PDF',
    periodLabel: 'Últimos 30 dias',
    requestedBy: 'Rafael Antunes',
    requestedAt: hoursAgo(5),
    status: 'PROCESSANDO',
  },
  {
    id: 'run-4818',
    reportId: 'rep-trips',
    reportTitle: 'Viagens concluídas',
    format: 'CSV',
    periodLabel: 'Últimos 12 meses',
    requestedBy: 'Helena Marques',
    requestedAt: hoursAgo(26),
    status: 'FALHOU',
    error: 'Integração Powerfleet sem sincronizar durante o período solicitado.',
  },
  {
    id: 'run-4815',
    reportId: 'rep-maintenance',
    reportTitle: 'Ordens de serviço',
    format: 'XLSX',
    periodLabel: 'Últimos 3 meses',
    requestedBy: 'Jonas Ferreira',
    requestedAt: hoursAgo(52),
    status: 'PRONTO',
    sizeKb: 96,
  },
];

const SCHEDULES: ReportSchedule[] = [
  {
    id: 'sch-01',
    reportId: 'rep-cost-per-km',
    reportTitle: 'Custo por quilômetro em camadas',
    frequency: 'MENSAL',
    format: 'XLSX',
    nextRunAt: daysAhead(27),
    recipients: ['dono@rookhub.com', 'financeiro@transnorte.com.br'],
    active: true,
  },
  {
    id: 'sch-02',
    reportId: 'rep-safety-events',
    reportTitle: 'Eventos de segurança',
    frequency: 'SEMANAL',
    format: 'PDF',
    nextRunAt: daysAhead(3),
    recipients: ['gestor@rookhub.com'],
    active: true,
  },
  {
    id: 'sch-03',
    reportId: 'rep-checklist',
    reportTitle: 'Checklists e pendências',
    frequency: 'DIARIO',
    format: 'PDF',
    nextRunAt: daysAhead(1),
    recipients: ['operador@rookhub.com'],
    active: false,
  },
];

/**
 * Indicadores do período.
 *
 * Os valores mudam com o recorte — é o ponto do seletor. Um relatório sem
 * período declarado é meia informação (RN-121).
 */
const INDICATORS: Record<
  AnalyticsPeriod,
  {
    label: string;
    availability: { month: string; availability: number }[];
    costPerKm: number;
    costDelta: number;
    criticalEvents: number;
    tripsCompleted: number;
    maintenanceCost: number;
  }
> = {
  '30D': {
    label: 'Últimos 30 dias',
    availability: [
      { month: 'sem 1', availability: 92.4 },
      { month: 'sem 2', availability: 93.1 },
      { month: 'sem 3', availability: 92.8 },
      { month: 'sem 4', availability: 93.5 },
    ],
    costPerKm: 2.75,
    costDelta: -3.2,
    criticalEvents: 11,
    tripsCompleted: 38,
    maintenanceCost: 74_120,
  },
  '3M': {
    label: 'Últimos 3 meses',
    availability: [
      { month: 'jun', availability: 90.6 },
      { month: 'jul', availability: 92.8 },
      { month: 'ago', availability: 93.5 },
    ],
    costPerKm: 2.81,
    costDelta: -4.6,
    criticalEvents: 34,
    tripsCompleted: 112,
    maintenanceCost: 208_460,
  },
  '6M': {
    label: 'Últimos 6 meses',
    availability: [
      { month: 'mar', availability: 88.4 },
      { month: 'abr', availability: 89.1 },
      { month: 'mai', availability: 91.2 },
      { month: 'jun', availability: 90.6 },
      { month: 'jul', availability: 92.8 },
      { month: 'ago', availability: 93.5 },
    ],
    costPerKm: 2.92,
    costDelta: -6.1,
    criticalEvents: 71,
    tripsCompleted: 214,
    maintenanceCost: 418_740,
  },
  '12M': {
    label: 'Últimos 12 meses',
    availability: [
      { month: 'set', availability: 86.2 },
      { month: 'nov', availability: 87.4 },
      { month: 'jan', availability: 88.9 },
      { month: 'mar', availability: 88.4 },
      { month: 'mai', availability: 91.2 },
      { month: 'jul', availability: 92.8 },
      { month: 'ago', availability: 93.5 },
    ],
    costPerKm: 3.04,
    costDelta: -9.2,
    criticalEvents: 148,
    tripsCompleted: 441,
    maintenanceCost: 812_300,
  },
};

export async function mockReports(): Promise<ReportDefinition[]> {
  await delay(500);
  return REPORTS;
}

export async function mockReportIndicators(period: AnalyticsPeriod) {
  await delay(400);
  return INDICATORS[period];
}

export async function mockReportPreview(
  reportId: string,
  period: AnalyticsPeriod,
): Promise<ReportPreview> {
  await delay(450);
  const report = REPORTS.find((item) => item.id === reportId);
  if (!report) throw new ApiError(404, 'Relatório não encontrado');

  const preview = PREVIEWS[reportId] ?? fallbackPreview(report);
  /* A contagem acompanha o recorte — período maior, mais linhas. */
  const factor = { '30D': 0.18, '3M': 0.5, '6M': 1, '12M': 2.1 }[period];

  return {
    reportId,
    ...preview,
    totalRows: Math.round(report.estimatedRows * factor),
    source: `${preview.source} · ${PERIOD_LABELS[period]}`,
  };
}

export async function mockReportRuns(): Promise<ReportRun[]> {
  await delay(420);
  return RUNS;
}

export async function mockReportSchedules(): Promise<ReportSchedule[]> {
  await delay(420);
  return SCHEDULES;
}

import type { AnalyticsPeriod, CostPerKmPoint } from '@/management/types';

/**
 * Base econômica mockada da frota — **fonte única** dos números financeiros.
 *
 * Tudo aqui é expresso em **R$ por quilômetro**, e o valor absoluto sai de
 * `km × R$/km`. Não é preciosismo: é o que garante que a DRE, o custo por km em
 * camadas e o ranking de rentabilidade nunca se contradigam. Dado mockado
 * incoerente esconde bug de formatação na hora da integração.
 *
 * As três primeiras camadas (`fuel`, `maintenance`, `fixed`) são exatamente as do
 * RN-055 e alimentam o gráfico de camadas do painel. As outras três (`people`,
 * `tires`, `fines`) existem só na DRE do dono — por isso o custo por km da DRE
 * (~R$ 3,73) é maior que o das camadas (~R$ 2,75): são escopos diferentes, e a
 * tela declara qual está mostrando.
 *
 * ⚠️ Dados fictícios. Descartados quando o backend estiver plugado.
 */
export interface MonthEconomics {
  /** Ano-mês ISO — chave estável, já que o rótulo curto repete entre anos. */
  id: string;
  /** Rótulo curto do eixo, ex.: "jan". */
  month: string;
  kmDriven: number;
  revenuePerKm: number;
  /* Camadas do RN-055. */
  fuelPerKm: number;
  maintenancePerKm: number;
  fixedPerKm: number;
  /* Categorias exclusivas da DRE. */
  peoplePerKm: number;
  tiresPerKm: number;
  finesPerKm: number;
}

/**
 * Alíquota efetiva sobre o faturamento (ISS, PIS, COFINS).
 *
 * Fica explícita porque separa receita bruta de receita líquida — e a margem do
 * dono é calculada sobre a líquida, nunca sobre a bruta.
 */
export const DEDUCTION_RATE = 0.0865;

/**
 * 18 meses de histórico.
 *
 * São 18 e não 12 de propósito: um recorte de 12 meses precisa de outros 12 para
 * trás para calcular variação. Sem isso o "vs. período anterior" seria inventado.
 *
 * A história que os números contam: a transportadora saía do vermelho no início
 * da série, afundou no pico de dezembro/janeiro (13º, manutenção e diesel caro) e
 * recuperou margem cortando combustível e manutenção por km.
 */
export const MONTHS: MonthEconomics[] = [
  {
    id: '2025-03',
    month: 'mar',
    kmDriven: 880_000,
    revenuePerKm: 4.3,
    fuelPerKm: 2.05,
    maintenancePerKm: 0.55,
    fixedPerKm: 0.6,
    peoplePerKm: 0.82,
    tiresPerKm: 0.16,
    finesPerKm: 0.062,
  },
  {
    id: '2025-04',
    month: 'abr',
    kmDriven: 886_000,
    revenuePerKm: 4.33,
    fuelPerKm: 2.02,
    maintenancePerKm: 0.58,
    fixedPerKm: 0.6,
    peoplePerKm: 0.82,
    tiresPerKm: 0.16,
    finesPerKm: 0.058,
  },
  {
    id: '2025-05',
    month: 'mai',
    kmDriven: 892_000,
    revenuePerKm: 4.35,
    fuelPerKm: 1.99,
    maintenancePerKm: 0.53,
    fixedPerKm: 0.6,
    peoplePerKm: 0.81,
    tiresPerKm: 0.15,
    finesPerKm: 0.055,
  },
  {
    id: '2025-06',
    month: 'jun',
    kmDriven: 896_000,
    revenuePerKm: 4.38,
    fuelPerKm: 1.97,
    maintenancePerKm: 0.51,
    fixedPerKm: 0.61,
    peoplePerKm: 0.81,
    tiresPerKm: 0.15,
    finesPerKm: 0.053,
  },
  {
    id: '2025-07',
    month: 'jul',
    kmDriven: 900_000,
    revenuePerKm: 4.4,
    fuelPerKm: 1.95,
    maintenancePerKm: 0.49,
    fixedPerKm: 0.61,
    peoplePerKm: 0.8,
    tiresPerKm: 0.15,
    finesPerKm: 0.057,
  },
  {
    id: '2025-08',
    month: 'ago',
    kmDriven: 902_000,
    revenuePerKm: 4.41,
    fuelPerKm: 1.94,
    maintenancePerKm: 0.5,
    fixedPerKm: 0.61,
    peoplePerKm: 0.8,
    tiresPerKm: 0.15,
    finesPerKm: 0.054,
  },

  {
    id: '2025-09',
    month: 'set',
    kmDriven: 905_000,
    revenuePerKm: 4.42,
    fuelPerKm: 1.92,
    maintenancePerKm: 0.48,
    fixedPerKm: 0.61,
    peoplePerKm: 0.8,
    tiresPerKm: 0.15,
    finesPerKm: 0.055,
  },
  {
    id: '2025-10',
    month: 'out',
    kmDriven: 918_000,
    revenuePerKm: 4.44,
    fuelPerKm: 1.88,
    maintenancePerKm: 0.52,
    fixedPerKm: 0.61,
    peoplePerKm: 0.8,
    tiresPerKm: 0.15,
    finesPerKm: 0.05,
  },
  {
    id: '2025-11',
    month: 'nov',
    kmDriven: 940_000,
    revenuePerKm: 4.47,
    fuelPerKm: 1.95,
    maintenancePerKm: 0.44,
    fixedPerKm: 0.62,
    peoplePerKm: 0.81,
    tiresPerKm: 0.16,
    finesPerKm: 0.047,
  },
  /* Dezembro e janeiro: 13º salário, pico de manutenção e diesel no topo. */
  {
    id: '2025-12',
    month: 'dez',
    kmDriven: 986_000,
    revenuePerKm: 4.55,
    fuelPerKm: 2.08,
    maintenancePerKm: 0.57,
    fixedPerKm: 0.62,
    peoplePerKm: 0.88,
    tiresPerKm: 0.17,
    finesPerKm: 0.059,
  },
  {
    id: '2026-01',
    month: 'jan',
    kmDriven: 862_000,
    revenuePerKm: 4.62,
    fuelPerKm: 2.14,
    maintenancePerKm: 0.63,
    fixedPerKm: 0.64,
    peoplePerKm: 0.84,
    tiresPerKm: 0.17,
    finesPerKm: 0.072,
  },
  {
    id: '2026-02',
    month: 'fev',
    kmDriven: 874_000,
    revenuePerKm: 4.58,
    fuelPerKm: 2.02,
    maintenancePerKm: 0.49,
    fixedPerKm: 0.64,
    peoplePerKm: 0.81,
    tiresPerKm: 0.15,
    finesPerKm: 0.056,
  },
  {
    id: '2026-03',
    month: 'mar',
    kmDriven: 928_000,
    revenuePerKm: 4.55,
    fuelPerKm: 1.96,
    maintenancePerKm: 0.46,
    fixedPerKm: 0.65,
    peoplePerKm: 0.8,
    tiresPerKm: 0.15,
    finesPerKm: 0.046,
  },
  {
    id: '2026-04',
    month: 'abr',
    kmDriven: 941_000,
    revenuePerKm: 4.52,
    fuelPerKm: 1.89,
    maintenancePerKm: 0.51,
    fixedPerKm: 0.65,
    peoplePerKm: 0.8,
    tiresPerKm: 0.15,
    finesPerKm: 0.048,
  },
  {
    id: '2026-05',
    month: 'mai',
    kmDriven: 952_000,
    revenuePerKm: 4.51,
    fuelPerKm: 1.84,
    maintenancePerKm: 0.43,
    fixedPerKm: 0.66,
    peoplePerKm: 0.8,
    tiresPerKm: 0.14,
    finesPerKm: 0.041,
  },
  {
    id: '2026-06',
    month: 'jun',
    kmDriven: 958_000,
    revenuePerKm: 4.52,
    fuelPerKm: 1.79,
    maintenancePerKm: 0.39,
    fixedPerKm: 0.66,
    peoplePerKm: 0.8,
    tiresPerKm: 0.14,
    finesPerKm: 0.038,
  },
  {
    id: '2026-07',
    month: 'jul',
    kmDriven: 964_000,
    revenuePerKm: 4.53,
    fuelPerKm: 1.76,
    maintenancePerKm: 0.41,
    fixedPerKm: 0.67,
    peoplePerKm: 0.81,
    tiresPerKm: 0.14,
    finesPerKm: 0.042,
  },
  {
    id: '2026-08',
    month: 'ago',
    kmDriven: 972_000,
    revenuePerKm: 4.53,
    fuelPerKm: 1.71,
    maintenancePerKm: 0.37,
    fixedPerKm: 0.67,
    peoplePerKm: 0.81,
    tiresPerKm: 0.14,
    finesPerKm: 0.034,
  },
];

/** Quantos meses cada recorte agrega. */
export const PERIOD_MONTHS: Record<AnalyticsPeriod, number> = {
  '30D': 1,
  '3M': 3,
  '6M': 6,
  '12M': 12,
};

/**
 * A janela do período e a janela imediatamente anterior, do mesmo tamanho.
 *
 * A anterior é o que permite dizer "vs. período anterior" sem chutar. Quando não
 * há histórico suficiente ela volta vazia, e quem consome precisa tratar.
 */
export function periodWindows(period: AnalyticsPeriod) {
  const size = PERIOD_MONTHS[period];
  const end = MONTHS.length;
  const current = MONTHS.slice(end - size, end);
  const previous = MONTHS.slice(Math.max(0, end - size * 2), end - size);
  return { current, previous, size };
}

/** Os 12 meses mais recentes — janela de tendência dos gráficos. */
export function trendMonths() {
  return MONTHS.slice(-12);
}

/** Camadas do custo por km (RN-055) nos 12 meses mais recentes. */
export function costPerKmLayers(): CostPerKmPoint[] {
  return trendMonths().map((entry) => ({
    month: entry.month,
    fuel: entry.fuelPerKm,
    maintenance: entry.maintenancePerKm,
    fixed: entry.fixedPerKm,
  }));
}

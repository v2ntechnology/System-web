import type {
  AnalyticsPeriod,
  DriverHighlight,
  FleetProfitability,
  IncomeStatement,
  IncomeStatementLine,
  OperationalCostCategory,
  OperationalCostCategoryId,
  OwnerApproval,
  OwnerInsight,
  OwnerSummary,
  RankingPeriod,
  ResultPoint,
} from '@/management/types';

import avatarSample from '@imgs/imgFace.jpg';

import { DEDUCTION_RATE, periodWindows, trendMonths, type MonthEconomics } from './fleet-economics';
import { ApiError, delay } from './latency';

/**
 * Substitutos dos endpoints da visão do dono.
 *
 * Nada aqui é digitado à mão duas vezes: todo valor vem de `fleet-economics.ts`,
 * agregado pelo período pedido. Trocar um R$/km lá reescreve a DRE, o resumo
 * analítico e o ranking de rentabilidade de uma vez — que é exatamente o que o
 * backend real vai fazer.
 *
 * ⚠️ Dados fictícios, exclusivos de desenvolvimento.
 */

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  '30D': 'últimos 30 dias',
  '3M': 'últimos 3 meses',
  '6M': 'últimos 6 meses',
  '12M': 'últimos 12 meses',
};

/* -------------------------------------------------------------------------- */
/* Agregação                                                                   */
/* -------------------------------------------------------------------------- */

const CATEGORY_META: {
  id: OperationalCostCategoryId;
  label: string;
  perKm: (entry: MonthEconomics) => number;
}[] = [
  { id: 'FUEL', label: 'Combustível', perKm: (e) => e.fuelPerKm },
  { id: 'PEOPLE', label: 'Pessoal e encargos', perKm: (e) => e.peoplePerKm },
  { id: 'FIXED', label: 'Custos fixos', perKm: (e) => e.fixedPerKm },
  { id: 'MAINTENANCE', label: 'Manutenção', perKm: (e) => e.maintenancePerKm },
  { id: 'TIRES', label: 'Pneus', perKm: (e) => e.tiresPerKm },
  { id: 'FINES', label: 'Multas e infrações', perKm: (e) => e.finesPerKm },
];

interface Aggregate {
  months: number;
  kmDriven: number;
  revenue: number;
  deductions: number;
  netRevenue: number;
  totalCost: number;
  netResult: number;
  netMarginPercent: number;
  costPerKm: number;
  /** Total em R$ por categoria, na ordem de `CATEGORY_META`. */
  byCategory: Record<OperationalCostCategoryId, number>;
}

function aggregate(window: MonthEconomics[]): Aggregate {
  const kmDriven = window.reduce((acc, e) => acc + e.kmDriven, 0);
  const revenue = window.reduce((acc, e) => acc + e.kmDriven * e.revenuePerKm, 0);
  const deductions = revenue * DEDUCTION_RATE;
  const netRevenue = revenue - deductions;

  const byCategory = Object.fromEntries(
    CATEGORY_META.map((meta) => [
      meta.id,
      window.reduce((acc, e) => acc + e.kmDriven * meta.perKm(e), 0),
    ]),
  ) as Record<OperationalCostCategoryId, number>;

  const totalCost = CATEGORY_META.reduce((acc, meta) => acc + byCategory[meta.id], 0);
  const netResult = netRevenue - totalCost;

  return {
    months: window.length,
    kmDriven,
    revenue,
    deductions,
    netRevenue,
    netResult,
    totalCost,
    // Margem sobre a receita LÍQUIDA — sobre a bruta o número sai inflado.
    netMarginPercent: netRevenue === 0 ? 0 : (netResult / netRevenue) * 100,
    costPerKm: kmDriven === 0 ? 0 : totalCost / kmDriven,
    byCategory,
  };
}

/** Variação percentual entre dois totais. Sem base anterior, devolve 0. */
function deltaPercent(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function buildCategories(current: Aggregate, previous: Aggregate | null) {
  return CATEGORY_META.map<OperationalCostCategory>((meta) => {
    const value = current.byCategory[meta.id];
    return {
      id: meta.id,
      label: meta.label,
      value,
      deltaPercent: previous ? deltaPercent(value, previous.byCategory[meta.id]) : 0,
      costPerKm: current.kmDriven === 0 ? 0 : value / current.kmDriven,
      sharePercent: current.totalCost === 0 ? 0 : (value / current.totalCost) * 100,
    };
  }).sort((a, b) => b.value - a.value);
}

function buildLines(
  current: Aggregate,
  previous: Aggregate | null,
  categories: OperationalCostCategory[],
): IncomeStatementLine[] {
  const share = (value: number) =>
    current.netRevenue === 0 ? 0 : (value / current.netRevenue) * 100;

  return [
    {
      id: 'receita-bruta',
      label: 'Receita bruta de fretes',
      kind: 'RECEITA',
      value: current.revenue,
      sharePercent: share(current.revenue),
      deltaPercent: previous ? deltaPercent(current.revenue, previous.revenue) : 0,
    },
    {
      id: 'deducoes',
      label: 'Impostos sobre o faturamento',
      kind: 'DEDUCAO',
      value: current.deductions,
      sharePercent: share(current.deductions),
      deltaPercent: previous ? deltaPercent(current.deductions, previous.deductions) : 0,
    },
    {
      id: 'receita-liquida',
      label: 'Receita líquida',
      kind: 'RESULTADO',
      value: current.netRevenue,
      sharePercent: 100,
      deltaPercent: previous ? deltaPercent(current.netRevenue, previous.netRevenue) : 0,
    },
    {
      id: 'custo-operacional',
      label: 'Custo operacional',
      kind: 'CUSTO',
      value: current.totalCost,
      sharePercent: share(current.totalCost),
      deltaPercent: previous ? deltaPercent(current.totalCost, previous.totalCost) : 0,
      children: categories.map((category) => ({
        label: category.label,
        value: category.value,
        deltaPercent: category.deltaPercent,
      })),
    },
    {
      id: 'resultado',
      label: 'Resultado líquido',
      kind: 'RESULTADO',
      value: current.netResult,
      sharePercent: share(current.netResult),
      /*
       * Percentual só quando a base anterior é positiva. Com base negativa a
       * conta perde sentido: de −322 mil para +1,3 mi o percentual sai negativo
       * e mente sobre a direção. Aí vai a frase.
       */
      deltaPercent:
        previous && previous.netResult > 0
          ? deltaPercent(current.netResult, previous.netResult)
          : 0,
      deltaNote:
        previous && previous.netResult <= 0
          ? current.netResult > 0
            ? 'virou lucro'
            : 'seguiu no prejuízo'
          : undefined,
    },
  ];
}

function buildSeries(): ResultPoint[] {
  return trendMonths().map((entry) => {
    const month = aggregate([entry]);
    return {
      month: entry.month,
      revenue: month.revenue,
      cost: month.totalCost,
      netMarginPercent: month.netMarginPercent,
    };
  });
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const brlExact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/* -------------------------------------------------------------------------- */
/* Resumo analítico textual                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Achados em texto corrido (visão do dono).
 *
 * Derivados dos agregados, nunca escritos à mão: se o número muda, a frase muda
 * junto. Um resumo que descreve um período que não é o exibido é pior que
 * nenhum resumo.
 */
function buildInsights(
  period: AnalyticsPeriod,
  current: Aggregate,
  previous: Aggregate | null,
  categories: OperationalCostCategory[],
): OwnerInsight[] {
  const label = PERIOD_LABEL[period];
  const source = `Fechamento contábil e telemetria · ${label}`;
  const insights: OwnerInsight[] = [];

  /* 1. O resultado do período, dito na primeira pessoa do negócio. */
  const marginPoints = previous ? current.netMarginPercent - previous.netMarginPercent : 0;
  insights.push(
    current.netResult >= 0
      ? {
          id: 'resultado',
          tone: marginPoints >= 0 ? 'GANHO' : 'ATENCAO',
          title: `Resultado positivo de ${brl.format(current.netResult)}`,
          text: previous
            ? `A margem líquida ficou em ${pct(current.netMarginPercent)} da receita, ${
                marginPoints >= 0 ? 'acima' : 'abaixo'
              } dos ${pct(previous.netMarginPercent)} do período anterior. Cada quilômetro rodado custou ${brlExact.format(
                current.costPerKm,
              )} e rendeu ${brlExact.format(current.revenue / current.kmDriven)}.`
            : `A margem líquida ficou em ${pct(current.netMarginPercent)} da receita, com custo de ${brlExact.format(current.costPerKm)} por quilômetro rodado.`,
          impact: current.netResult,
          source,
          action: { label: 'Abrir a DRE', to: '/gestao/resultado' },
        }
      : {
          id: 'resultado',
          tone: 'PERDA',
          title: `Prejuízo de ${brl.format(Math.abs(current.netResult))}`,
          text: `O custo operacional consumiu ${pct(
            (current.totalCost / current.netRevenue) * 100,
          )} da receita líquida. Para empatar, seria preciso cortar ${brlExact.format(
            Math.abs(current.netResult) / current.kmDriven,
          )} por quilômetro ou repassar esse valor no frete.`,
          impact: current.netResult,
          source,
          action: { label: 'Abrir a DRE', to: '/gestao/resultado' },
        },
  );

  /* 2. A categoria que mais melhorou — onde a gestão funcionou. */
  const improved = [...categories]
    .filter((category) => category.deltaPercent < 0)
    .sort((a, b) => a.deltaPercent - b.deltaPercent)[0];

  if (improved && previous) {
    const saved = previous.byCategory[improved.id] - improved.value;
    insights.push({
      id: `ganho-${improved.id}`,
      tone: 'GANHO',
      /*
       * "Queda de X%" e não "caiu X%": o rótulo da categoria pode ser plural
       * ("Custos fixos", "Multas e infrações") e a frase com verbo quebraria a
       * concordância. Substantivo não concorda com o sujeito.
       */
      title: `${improved.label}: queda de ${pct(Math.abs(improved.deltaPercent))}`,
      text: `Economia de ${brl.format(saved)} contra o período anterior — ${brlExact.format(
        improved.costPerKm,
      )} por quilômetro. É a categoria que mais melhorou e responde por ${pct(
        improved.sharePercent,
      )} do custo total.`,
      impact: saved,
      source,
      action: { label: 'Ver custos por categoria', to: '/gestao/resultado' },
    });
  }

  /* 3. A categoria que mais piorou — onde o dinheiro está vazando. */
  const worsened = [...categories]
    .filter((category) => category.deltaPercent > 0)
    .sort((a, b) => b.deltaPercent - a.deltaPercent)[0];

  if (worsened && previous) {
    const lost = worsened.value - previous.byCategory[worsened.id];
    insights.push({
      id: `perda-${worsened.id}`,
      tone: worsened.sharePercent > 15 ? 'PERDA' : 'ATENCAO',
      title: `${worsened.label}: alta de ${pct(worsened.deltaPercent)}`,
      text: `São ${brl.format(lost)} a mais que no período anterior, ${pct(
        worsened.sharePercent,
      )} do custo total. O gestor precisa justificar a variação antes do próximo fechamento.`,
      impact: -lost,
      source,
      action: { label: 'Cobrar parecer do gestor', to: '/gestao/aprovacoes' },
    });
  }

  /*
   * 4. Multas: dinheiro que não compra nenhum quilômetro.
   *
   * Só entra se não tiver aparecido como maior alta ou maior queda — o mesmo
   * custo descrito duas vezes na mesma lista faz o resumo parecer quebrado.
   */
  const finesAlreadyCited = improved?.id === 'FINES' || worsened?.id === 'FINES';
  const fines = finesAlreadyCited
    ? undefined
    : categories.find((category) => category.id === 'FINES');

  if (fines) {
    insights.push({
      id: 'multas',
      tone: fines.deltaPercent > 0 ? 'PERDA' : 'ATENCAO',
      title: `${brl.format(fines.value)} em multas e infrações`,
      text: `Equivale a ${brlExact.format(fines.costPerKm)} por quilômetro e a ${pct(
        (fines.value / Math.max(current.netResult, 1)) * 100,
      )} do resultado do período. Diferente de combustível, é custo que não compra nenhum quilômetro.`,
      impact: -fines.value,
      source,
      action: { label: 'Ver desempenho dos motoristas', to: '/gestao/desempenho' },
    });
  }

  return insights;
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

/** Substituto do `GET /v1/owner/summary`. */
export async function mockOwnerSummary(period: AnalyticsPeriod): Promise<OwnerSummary> {
  await delay(650);

  const { current, previous } = periodWindows(period);
  const now = aggregate(current);
  const before = previous.length > 0 ? aggregate(previous) : null;
  const categories = buildCategories(now, before);

  return {
    periodLabel: PERIOD_LABEL[period],
    revenue: now.revenue,
    netResult: now.netResult,
    netMarginPercent: now.netMarginPercent,
    netMarginDeltaPoints: before ? now.netMarginPercent - before.netMarginPercent : 0,
    costPerKm: now.costPerKm,
    kmDriven: now.kmDriven,
    source: `Fechamento contábil e telemetria · ${PERIOD_LABEL[period]}`,
    insights: buildInsights(period, now, before, categories),
    categories,
    series: buildSeries(),
    pendingApprovals: APPROVALS.filter((item) => item.status === 'PENDENTE').length,
  };
}

/** Substituto do `GET /v1/owner/income-statement`. */
export async function mockIncomeStatement(period: AnalyticsPeriod): Promise<IncomeStatement> {
  await delay(700);

  const { current, previous } = periodWindows(period);
  const now = aggregate(current);
  const before = previous.length > 0 ? aggregate(previous) : null;
  const categories = buildCategories(now, before);

  return {
    periodLabel: PERIOD_LABEL[period],
    revenue: now.revenue,
    netRevenue: now.netRevenue,
    deductions: now.deductions,
    totalCost: now.totalCost,
    netResult: now.netResult,
    netMarginPercent: now.netMarginPercent,
    netMarginDeltaPoints: before ? now.netMarginPercent - before.netMarginPercent : 0,
    kmDriven: now.kmDriven,
    costPerKm: now.costPerKm,
    source: `Fechamento contábil, notas de frete e telemetria · ${PERIOD_LABEL[period]}`,
    lines: buildLines(now, before, categories),
    categories,
    series: buildSeries(),
  };
}

/* -------------------------------------------------------------------------- */
/* Rentabilidade por veículo                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Desvio de cada veículo em relação à média da frota.
 *
 * O total da frota continua saindo da base econômica; o que muda por placa é o
 * quanto ela puxa a média para cima ou para baixo. Assim a soma dos veículos
 * conversa com a DRE em vez de brigar com ela.
 */
const VEHICLE_PROFILE: {
  vehicleId: string;
  plate: string;
  model: string;
  /** Peso na quilometragem da frota. Os pesos somam 1. */
  kmShare: number;
  /** Multiplicador da receita por km da frota. */
  revenueFactor: number;
  /** Multiplicador do custo por km da frota. */
  costFactor: number;
}[] = [
  {
    vehicleId: 'veh-001',
    plate: 'RKH4A12',
    model: 'Scania R 450',
    kmShare: 0.152,
    revenueFactor: 1.09,
    costFactor: 0.88,
  },
  {
    vehicleId: 'veh-002',
    plate: 'RKH7E45',
    model: 'Volvo FH 540',
    kmShare: 0.148,
    revenueFactor: 1.06,
    costFactor: 0.9,
  },
  {
    vehicleId: 'veh-003',
    plate: 'RKH2B88',
    model: 'Scania R 450',
    kmShare: 0.141,
    revenueFactor: 1.03,
    costFactor: 0.94,
  },
  {
    vehicleId: 'veh-004',
    plate: 'RKH9C10',
    model: 'DAF XF',
    kmShare: 0.135,
    revenueFactor: 1.0,
    costFactor: 0.99,
  },
  {
    vehicleId: 'veh-005',
    plate: 'RKH5F77',
    model: 'Volvo FH 460',
    kmShare: 0.128,
    revenueFactor: 0.98,
    costFactor: 1.02,
  },
  {
    vehicleId: 'veh-006',
    plate: 'RKH1D23',
    model: 'Mercedes-Benz Arocs',
    kmShare: 0.112,
    revenueFactor: 0.95,
    costFactor: 1.12,
  },
  /*
   * O RKH3G56 é o pior da frota de propósito: é o veículo do parecer em
   * Aprovações, que afirma "18% acima do custo por km da frota" e "a menor
   * margem". O `costFactor` 1.18 é literalmente esse número.
   */
  {
    vehicleId: 'veh-007',
    plate: 'RKH3G56',
    model: 'Iveco S-Way',
    kmShare: 0.098,
    revenueFactor: 0.92,
    costFactor: 1.18,
  },
  {
    vehicleId: 'veh-008',
    plate: 'RKH8H34',
    model: 'Mercedes-Benz Actros',
    kmShare: 0.086,
    revenueFactor: 0.93,
    costFactor: 1.14,
  },
];

/** Substituto do `GET /v1/owner/fleet-profitability`. */
export async function mockFleetProfitability(
  period: AnalyticsPeriod,
): Promise<FleetProfitability[]> {
  await delay(600);

  const { current } = periodWindows(period);
  const now = aggregate(current);
  const fleetRevenuePerKm = now.revenue / now.kmDriven;
  const fleetCostPerKm = now.costPerKm;

  return VEHICLE_PROFILE.map((profile) => {
    const kmDriven = Math.round(now.kmDriven * profile.kmShare);
    const revenuePerKm = fleetRevenuePerKm * profile.revenueFactor;
    const costPerKm = fleetCostPerKm * profile.costFactor;
    const revenue = kmDriven * revenuePerKm;
    /* A dedução também pesa por veículo — senão a margem sai otimista. */
    const netRevenue = revenue * (1 - DEDUCTION_RATE);
    const cost = kmDriven * costPerKm;

    return {
      vehicleId: profile.vehicleId,
      plate: profile.plate,
      model: profile.model,
      revenue,
      cost,
      result: netRevenue - cost,
      marginPercent: ((netRevenue - cost) / netRevenue) * 100,
      kmDriven,
      revenuePerKm,
      costPerKm,
      position: 0,
    };
  })
    .sort((a, b) => b.result - a.result)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

/* -------------------------------------------------------------------------- */
/* Gamificação — destaques de motorista                                        */
/* -------------------------------------------------------------------------- */

const HIGHLIGHTS: Record<RankingPeriod, DriverHighlight[]> = {
  MES: [
    {
      driverId: 'drv-001',
      name: 'Vinícius Vila Nova',
      avatarUrl: avatarSample,
      position: 1,
      score: 97,
      scoreDelta: 3,
      kmDriven: 11_240,
      fuelEfficiency: 3.1,
      onTimeDeliveryRate: 98,
      criticalEvents: 0,
      badges: ['Zero eventos críticos', 'Melhor consumo do mês', '100% dos checklists em dia'],
    },
    {
      driverId: 'drv-002',
      name: 'Marina Cordeiro',
      position: 2,
      score: 94,
      scoreDelta: 5,
      kmDriven: 12_880,
      fuelEfficiency: 2.9,
      onTimeDeliveryRate: 96,
      criticalEvents: 0,
      badges: ['Maior evolução de score', 'Zero multas'],
    },
    {
      driverId: 'drv-003',
      name: 'Edson Bastos',
      position: 3,
      score: 91,
      scoreDelta: -1,
      kmDriven: 13_450,
      fuelEfficiency: 2.7,
      onTimeDeliveryRate: 94,
      criticalEvents: 1,
      badges: ['Mais quilômetros rodados'],
    },
    {
      driverId: 'drv-004',
      name: 'Patrícia Nunes',
      position: 4,
      score: 88,
      scoreDelta: 2,
      kmDriven: 10_960,
      fuelEfficiency: 2.8,
      onTimeDeliveryRate: 92,
      criticalEvents: 1,
      badges: ['Zero multas'],
    },
    {
      driverId: 'drv-005',
      name: 'Wagner Teixeira',
      position: 5,
      score: 85,
      scoreDelta: -4,
      kmDriven: 12_110,
      fuelEfficiency: 2.5,
      onTimeDeliveryRate: 89,
      criticalEvents: 3,
      badges: [],
    },
  ],
  /*
   * No ano o pódio muda: a média é ponderada pelos km rodados, então quem
   * dirigiu pouco e bem lidera o mês, não o ano.
   */
  ANO: [
    {
      driverId: 'drv-002',
      name: 'Marina Cordeiro',
      position: 1,
      score: 95,
      scoreDelta: 7,
      kmDriven: 148_300,
      fuelEfficiency: 2.9,
      onTimeDeliveryRate: 97,
      criticalEvents: 2,
      badges: ['Destaque do ano', 'Zero eventos graves em 12 meses', 'Melhor pontualidade'],
    },
    {
      driverId: 'drv-003',
      name: 'Edson Bastos',
      position: 2,
      score: 93,
      scoreDelta: 4,
      kmDriven: 161_900,
      fuelEfficiency: 2.8,
      onTimeDeliveryRate: 95,
      criticalEvents: 5,
      badges: ['Mais quilômetros do ano'],
    },
    {
      driverId: 'drv-001',
      name: 'Vinícius Vila Nova',
      avatarUrl: avatarSample,
      position: 3,
      score: 92,
      scoreDelta: 6,
      kmDriven: 118_400,
      fuelEfficiency: 3.0,
      onTimeDeliveryRate: 96,
      criticalEvents: 3,
      badges: ['Melhor consumo do ano'],
    },
    {
      driverId: 'drv-004',
      name: 'Patrícia Nunes',
      position: 4,
      score: 89,
      scoreDelta: 3,
      kmDriven: 132_700,
      fuelEfficiency: 2.7,
      onTimeDeliveryRate: 93,
      criticalEvents: 6,
      badges: [],
    },
    {
      driverId: 'drv-005',
      name: 'Wagner Teixeira',
      position: 5,
      score: 84,
      scoreDelta: -2,
      kmDriven: 145_200,
      fuelEfficiency: 2.5,
      onTimeDeliveryRate: 88,
      criticalEvents: 14,
      badges: [],
    },
  ],
};

/** Substituto do `GET /v1/owner/driver-highlights`. */
export async function mockDriverHighlights(period: RankingPeriod): Promise<DriverHighlight[]> {
  await delay(550);
  return HIGHLIGHTS[period];
}

/* -------------------------------------------------------------------------- */
/* Aprovações do dono                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Fila de decisões do dono.
 *
 * Mutável de propósito: aprovar e recusar no mock precisa refletir na lista, ou
 * a tela não exercita o estado pós-decisão.
 */
const APPROVALS: OwnerApproval[] = [
  {
    id: 'apr-001',
    kind: 'LIBERACAO_VEICULO',
    title: 'Liberar RKH1D23 após ocorrência grave',
    summary:
      'Checklist de devolução reprovou com vazamento no sistema de freio e o veículo entrou em bloqueio automático. A oficina trocou as pastilhas e o cilindro mestre, e o reteste passou. Ocorrência grave exige aprovação formal do proprietário para a próxima saída.',
    severity: 'GRAVE',
    status: 'PENDENTE',
    requestedBy: 'Rafael Antunes',
    requestedAt: '2026-08-05T18:20:00-03:00',
    plate: 'RKH1D23',
    driverName: 'Wagner Teixeira',
    financialImpact: -18_400,
    actionPlan: [
      'Troca de pastilhas e cilindro mestre concluída na Oficina Central',
      'Reteste do checklist de freio aprovado em 05/08',
      'Motorista reciclado em condução defensiva antes da próxima viagem',
      'Inspeção extra do eixo traseiro agendada para 30 dias',
    ],
    evidence: [
      { label: 'Dias parado', value: '3 dias' },
      { label: 'Custo da manutenção', value: 'R$ 18.400' },
      { label: 'Receita perdida', value: 'R$ 42.100' },
      { label: 'Eventos críticos do motorista', value: '3 nos últimos 30 dias' },
    ],
  },
  {
    id: 'apr-002',
    kind: 'PARECER_CRITICO',
    title: 'Parecer: alta de manutenção no Iveco S-Way',
    summary:
      'O RKH3G56 acumulou três corretivas em 60 dias e opera 18% acima do custo por km da frota. O diagnóstico aponta desgaste prematuro de embreagem por perfil de rota, não por condução. A recomendação é remanejar o veículo para trechos planos ou antecipar a substituição.',
    severity: 'MEDIA',
    status: 'PENDENTE',
    requestedBy: 'Rafael Antunes',
    requestedAt: '2026-08-04T10:05:00-03:00',
    plate: 'RKH3G56',
    financialImpact: -31_800,
    actionPlan: [
      'Remanejar o veículo para rotas de baixa declividade por 90 dias',
      'Reavaliar o custo por km ao fim do trimestre',
      'Cotar substituição caso a corretiva se repita',
    ],
    evidence: [
      { label: 'Corretivas em 60 dias', value: '3 ordens' },
      { label: 'Custo por km', value: '18% acima da frota' },
      { label: 'Disponibilidade', value: '82%' },
      { label: 'Margem do veículo', value: 'a menor da frota' },
    ],
  },
  {
    id: 'apr-003',
    kind: 'INVESTIMENTO',
    title: 'Compra antecipada de 24 pneus',
    summary:
      'O fornecedor confirmou reajuste de 9% a partir de setembro. Antecipar a compra do lote de recapagem travaria o preço atual e cobriria a troca prevista para o quarto trimestre. Valor acima da alçada do gestor.',
    severity: 'LEVE',
    status: 'PENDENTE',
    requestedBy: 'Camila Prado',
    requestedAt: '2026-08-03T15:40:00-03:00',
    financialImpact: -96_000,
    evidence: [
      { label: 'Valor do lote', value: 'R$ 96.000' },
      { label: 'Economia estimada', value: 'R$ 8.600' },
      { label: 'Cobertura', value: '4º trimestre' },
      { label: 'Alçada do gestor', value: 'até R$ 50.000' },
    ],
  },
  {
    id: 'apr-004',
    kind: 'LIBERACAO_VEICULO',
    title: 'Liberar RKH8H34 após reprovação de pneus',
    summary:
      'Checklist apontou profundidade de sulco abaixo do limite legal em dois pneus do eixo de tração. Substituição concluída e conferida pelo operador de pátio.',
    severity: 'GRAVE',
    status: 'APROVADA',
    requestedBy: 'Rafael Antunes',
    requestedAt: '2026-07-28T09:10:00-03:00',
    plate: 'RKH8H34',
    driverName: 'Patrícia Nunes',
    financialImpact: -7_200,
    actionPlan: [
      'Substituição dos dois pneus do eixo de tração',
      'Conferência do operador de pátio',
    ],
    evidence: [
      { label: 'Dias parado', value: '1 dia' },
      { label: 'Custo', value: 'R$ 7.200' },
      { label: 'Sulco medido', value: '1,2 mm' },
    ],
    decision: {
      by: 'Helena Marques',
      at: '2026-07-28T14:30:00-03:00',
      note: 'Liberado. Manter a conferência de sulco no checklist semanal deste veículo.',
    },
  },
  {
    id: 'apr-005',
    kind: 'PARECER_CRITICO',
    title: 'Parecer: excesso de velocidade reincidente',
    summary:
      'Motorista com 14 eventos de excesso de velocidade em 12 meses, apesar de duas advertências. O gestor propôs suspensão de bônus e reciclagem obrigatória.',
    severity: 'GRAVE',
    status: 'RECUSADA',
    requestedBy: 'Rafael Antunes',
    requestedAt: '2026-07-22T11:00:00-03:00',
    driverName: 'Wagner Teixeira',
    financialImpact: -4_300,
    actionPlan: ['Suspensão do bônus por 3 meses', 'Reciclagem obrigatória em condução defensiva'],
    evidence: [
      { label: 'Eventos em 12 meses', value: '14' },
      { label: 'Advertências aplicadas', value: '2' },
      { label: 'Multas no período', value: 'R$ 4.300' },
    ],
    decision: {
      by: 'Helena Marques',
      at: '2026-07-23T08:15:00-03:00',
      note: 'Reciclagem sim, suspensão de bônus não. Reavaliar em 60 dias com os dados da telemetria.',
    },
  },
];

/** Substituto do `GET /v1/owner/approvals`. */
export async function mockOwnerApprovals(): Promise<OwnerApproval[]> {
  await delay(600);
  return APPROVALS.map((item) => ({ ...item }));
}

/**
 * Coloca um caso novo na fila do dono.
 *
 * Chamado pelo painel de liberações do gestor quando uma ocorrência **grave**
 * escala. É o mesmo array que a tela do dono lê — no backend isso é uma única
 * tabela, e o mock imita o comportamento em vez de manter duas listas que
 * divergem na primeira decisão.
 */
export function enqueueOwnerApproval(
  approval: Omit<OwnerApproval, 'id' | 'status'>,
): OwnerApproval {
  const created: OwnerApproval = {
    ...approval,
    id: `apr-${String(APPROVALS.length + 1).padStart(3, '0')}`,
    status: 'PENDENTE',
  };
  APPROVALS.unshift(created);
  return created;
}

/** Quantas decisões esperam o dono agora — usado pelo painel do gestor. */
export function countPendingOwnerApprovals() {
  return APPROVALS.filter((item) => item.status === 'PENDENTE').length;
}

export interface DecisionPayload {
  approvalId: string;
  approve: boolean;
  note: string;
}

/** Substituto do `POST /v1/owner/approvals/{id}/decision`. */
export async function mockDecideApproval({
  approvalId,
  approve,
  note,
}: DecisionPayload): Promise<OwnerApproval> {
  await delay(800);

  const target = APPROVALS.find((item) => item.id === approvalId);

  if (!target) {
    throw new ApiError(404, 'Decisão não encontrada', 'Esta solicitação não existe mais.');
  }

  if (target.status !== 'PENDENTE') {
    throw new ApiError(
      409,
      'Decisão já registrada',
      'Alguém já decidiu esta solicitação. Recarregue a lista.',
    );
  }

  if (note.trim().length < 10) {
    throw new ApiError(422, 'Justificativa obrigatória', 'Descreva o motivo da decisão.');
  }

  target.status = approve ? 'APROVADA' : 'RECUSADA';
  target.decision = {
    by: 'Helena Marques',
    at: new Date().toISOString(),
    note: note.trim(),
  };

  return { ...target };
}

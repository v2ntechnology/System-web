import { GaugeIcon, InfoIcon, MoneyIcon, RouteIcon, ShieldAlertIcon } from '@/components/icons';
import { useState } from 'react';

import { SimpleBarChart, TrendAreaChart, TrendLineChart } from '@/components/shared/charts';
import { DateRangeSelector, type DateRangePreset } from '@/components/shared/filters';
import {
  HeroStats,
  LightCard,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { PlanGuard } from '@/components/shared/guards';
import { DASHBOARD_DATA } from '@/mocks/dashboard';
import { type ChartPoint } from '@/types';

const COST_BY_CATEGORY: ChartPoint[] = [
  { label: 'Combustível', valor: 356000 },
  { label: 'Manutenção', valor: 128000 },
  { label: 'Multas', valor: 24000 },
  { label: 'Pedágio', valor: 41000 },
  { label: 'Pessoal', valor: 210000 },
];

const SAFETY_TREND: ChartPoint[] = [
  { label: 'Jan', incidentes: 18 },
  { label: 'Fev', incidentes: 14 },
  { label: 'Mar', incidentes: 12 },
  { label: 'Abr', incidentes: 9 },
  { label: 'Mai', incidentes: 6 },
];

const PRODUCTIVITY: ChartPoint[] = [
  { label: 'Sem 1', viagens: 42 },
  { label: 'Sem 2', viagens: 48 },
  { label: 'Sem 3', viagens: 51 },
  { label: 'Sem 4', viagens: 57 },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRangePreset>('30d');

  /*
   * ⚠️ Números fixos, como já eram nos `InfoCard`: esta tela ainda desenha em
   * cima do mock, e trocar isso é assunto de dados, não de layout.
   *
   * ⚠️ E, desde 09/09/2026, ela DIZ isso na tela. O motivo é concreto: o
   * "Consumo médio" daqui marcava 2,9 km/l enquanto `/gestao/custos` mostrava
   * 4,13 para a mesma frota no mesmo período, e nada avisava qual dos dois era
   * o real. Quatro números com cara de medidos, sem fonte nenhuma, valem menos
   * que quatro números declarados como exemplo.
   *
   * Ligar de a pouco NÃO resolve: dos quatro, só o consumo tem fonte direta
   * hoje (a métrica `consumo` de `/v1/fleet/operations`); "Custo por km" depende
   * do lançamento de despesa, que ainda não existe. Um número real ao lado de
   * três inventados é pior, porque empresta credibilidade ao conjunto. Quando o
   * custo tiver origem, a tela liga inteira e esta nota sai junto.
   */
  const stats: HeroStat[] = [
    {
      key: 'custo-km',
      label: 'Custo por km',
      value: 'R$ 3,42',
      hint: 'no período escolhido',
      icon: MoneyIcon,
    },
    {
      key: 'viagens',
      label: 'Viagens no período',
      value: '198',
      hint: 'concluídas',
      icon: RouteIcon,
    },
    {
      key: 'incidentes',
      label: 'Incidentes de segurança',
      value: '6',
      hint: 'registrados no período',
      icon: ShieldAlertIcon,
      tone: 'warn',
    },
    {
      key: 'consumo',
      label: 'Consumo médio',
      value: '2,9 km/L',
      hint: 'média da frota',
      icon: GaugeIcon,
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Analytics"
        description="Painéis analíticos de custos, produtividade, segurança e consumo."
      />

      <HeroStats items={stats} />

      {/* ⚠️ O aviso vem ANTES dos gráficos e depois dos números, que é onde o
          olho passa: quem leu "2,9 km/L" precisa saber o que aquilo é antes de
          tirar conclusão. Ver a nota do `stats`. */}
      <div className="w-full px-4 pt-6 sm:px-6 xl:px-10">
        <p className="text-on-surface-variant text-body-md flex items-start gap-2">
          <InfoIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Os números e gráficos desta tela são de <strong>demonstração</strong> e não vêm da
            telemetria. O consumo real da frota está em Custos, na área de gestão.
          </span>
        </p>
      </div>

      <PagePanel className="space-y-6">
        {/* O seletor de período desceu da faixa: ele recorta o conteúdo, e a
            faixa é o cabeçalho da tela, não a barra de controles. */}
        <div className="flex justify-end">
          <DateRangeSelector value={range} onChange={setRange} />
        </div>

        <PlanGuard module="analytics">
          <div className="grid gap-4 lg:grid-cols-2">
            <LightCard
              title="Evolução dos custos"
              description="Custo operacional total (R$ mil) por mês"
            >
              <TrendAreaChart
                data={DASHBOARD_DATA.charts.costEvolution}
                series={[{ key: 'custo', label: 'Custo (R$ mil)', color: 'var(--color-primary)' }]}
              />
            </LightCard>

            <LightCard title="Custos por categoria" description="Distribuição de custos no período">
              <SimpleBarChart
                data={COST_BY_CATEGORY}
                dataKey="valor"
                label="Valor (R$)"
                color="var(--color-accent)"
              />
            </LightCard>

            <LightCard title="Segurança" description="Incidentes registrados por mês">
              <TrendLineChart
                data={SAFETY_TREND}
                series={[
                  { key: 'incidentes', label: 'Incidentes', color: 'var(--color-destructive)' },
                ]}
              />
            </LightCard>

            <LightCard title="Produtividade" description="Viagens concluídas por semana">
              <SimpleBarChart
                data={PRODUCTIVITY}
                dataKey="viagens"
                label="Viagens"
                color="var(--color-info)"
              />
            </LightCard>
          </div>
        </PlanGuard>
      </PagePanel>
    </div>
  );
}

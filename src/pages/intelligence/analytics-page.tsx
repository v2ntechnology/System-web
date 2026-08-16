import { useState } from 'react';

import {
  ChartCard,
  SimpleBarChart,
  TrendAreaChart,
  TrendLineChart,
} from '@/components/shared/charts';
import { InfoCard } from '@/components/shared/cards';
import { DateRangeSelector, type DateRangePreset } from '@/components/shared/filters';
import { PageHeader } from '@/components/layout/page-header';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Painéis analíticos de custos, produtividade, segurança e consumo."
        actions={<DateRangeSelector value={range} onChange={setRange} />}
      />

      <PlanGuard module="analytics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Custo por km" value="R$ 3,42" accent="info" />
          <InfoCard label="Viagens no período" value="198" accent="success" />
          <InfoCard label="Incidentes de segurança" value="6" accent="warning" />
          <InfoCard label="Consumo médio" value="2,9 km/L" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Evolução dos custos"
            description="Custo operacional total (R$ mil) por mês"
          >
            <TrendAreaChart
              data={DASHBOARD_DATA.charts.costEvolution}
              series={[{ key: 'custo', label: 'Custo (R$ mil)', color: 'var(--color-primary)' }]}
            />
          </ChartCard>

          <ChartCard title="Custos por categoria" description="Distribuição de custos no período">
            <SimpleBarChart
              data={COST_BY_CATEGORY}
              dataKey="valor"
              label="Valor (R$)"
              color="var(--color-accent)"
            />
          </ChartCard>

          <ChartCard title="Segurança" description="Incidentes registrados por mês">
            <TrendLineChart
              data={SAFETY_TREND}
              series={[
                { key: 'incidentes', label: 'Incidentes', color: 'var(--color-destructive)' },
              ]}
            />
          </ChartCard>

          <ChartCard title="Produtividade" description="Viagens concluídas por semana">
            <SimpleBarChart
              data={PRODUCTIVITY}
              dataKey="viagens"
              label="Viagens"
              color="var(--color-info)"
            />
          </ChartCard>
        </div>
      </PlanGuard>
    </div>
  );
}
